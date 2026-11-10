"""Deploy Blind Box Closet API to VPS and seed catalog."""
from __future__ import annotations

import os
import tarfile
import tempfile
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
SERVER = ROOT / "server"

HOST = os.environ.get("VPS_IP", "85.17.145.134")
USER = os.environ.get("VPS_USER", "root")
PASS = os.environ.get("VPS_PASSWORD")
if not PASS:
    raise SystemExit("Set VPS_PASSWORD env var before deploying")
REMOTE = "/opt/blind-box-closet"


def ssh_connect():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASS, timeout=30)
    return client


def run(client: paramiko.SSHClient, cmd: str, timeout: int = 600):
    print(f"$ {cmd}")
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        print(out.encode("ascii", "replace").decode("ascii"))
    if err.strip():
        print(err.encode("ascii", "replace").decode("ascii"))
    if code != 0:
        raise RuntimeError(f"Command failed ({code}): {cmd}")
    return out


def make_archive() -> Path:
    tmp = Path(tempfile.mkdtemp()) / "bbc-server.tar.gz"
    with tarfile.open(tmp, "w:gz") as tar:
        for path in SERVER.rglob("*"):
            if not path.is_file():
                continue
            rel = path.relative_to(SERVER)
            parts = rel.parts
            if "node_modules" in parts or "media" in parts or parts[-1] == ".env":
                continue
            tar.add(path, arcname=str(Path("server") / rel))
        # include privacy for optional hosting
        privacy = ROOT / "privacy" / "privacy.html"
        if privacy.exists():
            tar.add(privacy, arcname="privacy/privacy.html")
        service = SERVER / "deploy" / "blind-box-closet.service"
        nginx = SERVER / "deploy" / "nginx-bbc.conf"
        tar.add(service, arcname="deploy/blind-box-closet.service")
        tar.add(nginx, arcname="deploy/nginx-bbc.conf")
    return tmp


def main():
    archive = make_archive()
    print(f"Archive: {archive} ({archive.stat().st_size} bytes)")

    client = ssh_connect()
    sftp = client.open_sftp()

    run(client, f"mkdir -p {REMOTE}/server {REMOTE}/media {REMOTE}/deploy")
    remote_tar = "/tmp/bbc-server.tar.gz"
    print("Uploading…")
    sftp.put(str(archive), remote_tar)
    run(client, f"tar -xzf {remote_tar} -C {REMOTE}")
    run(client, f"cp {REMOTE}/deploy/blind-box-closet.service /etc/systemd/system/")

    env = f"""PORT=8787
HOST=0.0.0.0
DATABASE_URL=postgres://bbc:bbc@127.0.0.1:5433/blindboxcloset
JWT_SECRET=bbc-{os.urandom(16).hex()}
APPLE_CLIENT_ID=com.blindboxcloset.app
APPLE_AUTH_OPTIONAL=1
ADMIN_EMAILS=dorian172@outlook.com
PUBLIC_BASE_URL=http://{HOST}:8787
MEDIA_ROOT={REMOTE}/media
"""
    with sftp.file(f"{REMOTE}/server/.env", "w") as f:
        f.write(env)

    # deps: docker, node, postgres
    run(
        client,
        "command -v docker >/dev/null || (curl -fsSL https://get.docker.com | sh)",
        timeout=900,
    )
    run(
        client,
        "command -v node >/dev/null || (curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y nodejs)",
        timeout=900,
    )
    run(
        client,
        f"cd {REMOTE}/server && docker compose up -d",
        timeout=300,
    )
    run(client, "sleep 4")
    run(client, f"cd {REMOTE}/server && npm install", timeout=600)
    run(client, f"cd {REMOTE}/server && npx tsx scripts/seed.ts", timeout=300)
    run(client, "ufw allow 8787/tcp || true")
    run(client, "systemctl daemon-reload")
    run(client, "systemctl enable --now blind-box-closet.service")
    run(client, "systemctl restart blind-box-closet.service")
    run(client, "sleep 2; curl -s http://127.0.0.1:8787/health || true")

    sftp.close()
    client.close()
    print("Deploy complete.")


if __name__ == "__main__":
    main()
