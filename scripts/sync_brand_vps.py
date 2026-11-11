"""Sync one or more brands (media + catalog + seed script) to the VPS and reseed in strict mode.

Usage: python scripts/sync_brand_vps.py sonny-angel labubu
Requires VPS_PASSWORD. Removes stale `<prefix>-*` files on the VPS that are no longer referenced locally.
"""
from __future__ import annotations

import io
import os
import sys
import tarfile
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
LOCAL = ROOT / "server" / "media" / "figures"
REMOTE = "/opt/blind-box-closet"
PREFIX = {"smiski": "smiski", "sonny-angel": "sonny", "labubu": "labubu"}
HOST = os.environ.get("VPS_IP", "85.17.145.134")
PASSWORD = os.environ.get("VPS_PASSWORD")
if not PASSWORD:
    raise SystemExit("Set VPS_PASSWORD")


def run(client, cmd, timeout=900):
    print("$", cmd[:160])
    _in, out, err = client.exec_command(cmd, timeout=timeout)
    o = out.read().decode("utf-8", "replace")
    e = err.read().decode("utf-8", "replace")
    code = out.channel.recv_exit_status()
    if o.strip():
        print(o.encode("ascii", "replace").decode("ascii")[-1500:])
    if e.strip():
        print(e.encode("ascii", "replace").decode("ascii")[-800:])
    if code != 0:
        raise RuntimeError(f"failed ({code})")
    return o


def main():
    brands = sys.argv[1:]
    if not brands:
        raise SystemExit("brands required")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username="root", password=PASSWORD, timeout=30)
    sftp = client.open_sftp()

    # 1. media (tar upload, one transfer)
    buf = io.BytesIO()
    names = []
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for b in brands:
            for p in sorted(LOCAL.glob(f"{PREFIX[b]}-*")):
                tar.add(p, arcname=p.name)
                names.append(p.name)
    buf.seek(0)
    print("media files:", len(names), "archive bytes:", buf.getbuffer().nbytes)
    sftp.putfo(buf, "/tmp/brand-media.tar.gz")
    run(client, f"mkdir -p {REMOTE}/media/figures")
    for b in brands:
        run(client, f"find {REMOTE}/media/figures -maxdepth 1 -name '{PREFIX[b]}-*' -delete")
    run(client, f"tar -xzf /tmp/brand-media.tar.gz -C {REMOTE}/media/figures")

    # 1b. prune: remove every remote figure file that does not exist locally (old junk).
    local_names = {p.name for p in LOCAL.glob("*") if p.is_file()}
    remote_names = run(client, f"ls -1 {REMOTE}/media/figures").split()
    stale = [n for n in remote_names if n not in local_names]
    print("stale remote files:", len(stale))
    for i in range(0, len(stale), 80):
        quoted = " ".join("'" + n.replace("'", "") + "'" for n in stale[i : i + 80])
        run(client, f"cd {REMOTE}/media/figures && rm -f -- {quoted}")

    # 2. catalogs + seed script
    for rel in [
        "server/scripts/seed.ts",
        *[f"server/data/{b}-catalog.json" for b in brands],
    ]:
        sftp.put(str(ROOT / rel), f"{REMOTE}/{rel}")

    # 3. strict reseed for these brands only
    strict = ",".join(brands)
    run(
        client,
        f"cd {REMOTE}/server && SEED_ONLY_BRANDS={strict} SEED_STRICT_BRANDS={strict} npx tsx scripts/seed.ts",
        timeout=900,
    )
    sftp.close()
    client.close()
    print("done")


if __name__ == "__main__":
    main()

