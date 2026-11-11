"""Deploy auth/index + series media + cover/hero SQL updates."""
from __future__ import annotations

import json
import os
from pathlib import Path

import paramiko

ROOT = Path(r"C:\Users\doria\Smiski")
PASSWORD = os.environ.get("VPS_PASSWORD")
if not PASSWORD:
    raise SystemExit("Set VPS_PASSWORD")


def run_sql(client: paramiko.SSHClient, sql: str) -> int:
    safe = sql.replace('"', '\\"')
    cmd = (
        "cd /opt/blind-box-closet/server && "
        f'docker compose exec -T db psql -U bbc -d blindboxcloset -c "{safe}"'
    )
    _i, stdout, stderr = client.exec_command(cmd, timeout=90)
    code = stdout.channel.recv_exit_status()
    if code != 0:
        print("sql fail", stderr.read().decode("utf-8", "replace")[:300])
    return code


def main() -> None:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect("85.17.145.134", username="root", password=PASSWORD, timeout=30)
    sftp = client.open_sftp()

    for local, remote in [
        (ROOT / "server/src/index.ts", "/opt/blind-box-closet/server/src/index.ts"),
        (ROOT / "server/src/auth.ts", "/opt/blind-box-closet/server/src/auth.ts"),
    ]:
        sftp.put(str(local), remote)
        print("put", local.name)

    remote_dir = "/opt/blind-box-closet/media/series"
    client.exec_command(f"mkdir -p {remote_dir}")[1].channel.recv_exit_status()
    local_dir = ROOT / "server/media/series"
    files = [p for p in local_dir.iterdir() if p.is_file()]
    for p in files:
        sftp.put(str(p), f"{remote_dir}/{p.name}")
    print("uploaded series covers", len(files))

    for cat_path in [
        ROOT / "server/data/smiski-catalog.json",
        ROOT / "server/data/sonny-angel-catalog.json",
        ROOT / "server/data/labubu-catalog.json",
    ]:
        data = json.loads(cat_path.read_text(encoding="utf-8"))
        brand = data["brand"]["slug"]
        for series in data["series"]:
            cover = series.get("cover_image_url")
            if not cover or "smiski-unknown" in str(cover):
                continue
            slug = series["slug"].replace("'", "''")
            url = str(cover).replace("'", "''")
            run_sql(
                client,
                "UPDATE series s SET cover_image_url = '%s' FROM brands b "
                "WHERE s.brand_id = b.id AND b.slug = '%s' AND s.slug = '%s';"
                % (url, brand, slug),
            )
        hero = data["brand"].get("hero_image_url")
        if hero and "smiski-unknown" not in str(hero):
            run_sql(
                client,
                "UPDATE brands SET hero_image_url = '%s' WHERE slug = '%s';"
                % (str(hero).replace("'", "''"), brand),
            )

    run_sql(
        client,
        "UPDATE users SET is_admin = true WHERE "
        "lower(coalesce(email,'')) = 'dorian172@outlook.com' "
        "OR lower(coalesce(display_name,'')) LIKE '%%dorian%%';",
    )

    _i, stdout, _e = client.exec_command(
        "systemctl restart blind-box-closet.service; sleep 2; systemctl is-active blind-box-closet.service"
    )
    print(stdout.read().decode("ascii", "replace").strip())
    sftp.close()
    client.close()
    print("deploy done")


if __name__ == "__main__":
    main()
