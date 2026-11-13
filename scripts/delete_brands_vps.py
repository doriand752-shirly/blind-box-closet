"""Delete brands from VPS DB + their media files.

Usage: python scripts/delete_brands_vps.py sonny-angel labubu chiikawa
Requires VPS_PASSWORD.
"""
from __future__ import annotations

import json
import os
import sys

import paramiko

PREFIX = {
    "smiski": "smiski",
    "sonny-angel": "sonny",
    "labubu": "labubu",
    "hirono": "hirono",
    "skullpanda": "skullpanda",
    "chiikawa": "chiikawa",
    "dimoo": "dimoo",
    "mofusand": "mofusand",
    "animal-bakery": "animalbakery",
}
HOST = os.environ.get("VPS_IP", "85.17.145.134")
PASSWORD = os.environ.get("VPS_PASSWORD")
if not PASSWORD:
    raise SystemExit("Set VPS_PASSWORD")
REMOTE = "/opt/blind-box-closet"


def run(client, cmd, timeout=300):
    print("$", cmd[:200])
    _in, out, err = client.exec_command(cmd, timeout=timeout)
    o = out.read().decode("utf-8", "replace")
    e = err.read().decode("utf-8", "replace")
    code = out.channel.recv_exit_status()
    if o.strip():
        print(o[-1500:])
    if e.strip():
        print(e[-800:])
    if code != 0:
        raise RuntimeError(f"failed ({code}): {e or o}")
    return o


def main():
    brands = sys.argv[1:]
    if not brands:
        raise SystemExit("brands required")
    for b in brands:
        if b not in PREFIX:
            raise SystemExit(f"unknown brand {b}")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username="root", password=PASSWORD, timeout=30)
    sftp = client.open_sftp()

    script = (
        'import "dotenv/config";\n'
        'import { pool, query } from "../src/db";\n'
        f"const slugs = {json.dumps(brands)};\n"
        "const r = await query(\n"
        '  "DELETE FROM brands WHERE slug = ANY($1::text[]) RETURNING slug",\n'
        "  [slugs],\n"
        ");\n"
        'console.log("deleted", r.rows.map((x) => x.slug).join(",") || "(none)");\n'
        "await pool.end();\n"
    )
    remote_script = f"{REMOTE}/server/scripts/_delete-brands-tmp.mjs"
    with sftp.file(remote_script, "w") as f:
        f.write(script)

    try:
        run(client, f"cd {REMOTE}/server && npx tsx scripts/_delete-brands-tmp.mjs", timeout=120)
    finally:
        run(client, f"rm -f {remote_script}")

    for b in brands:
        run(client, f"find {REMOTE}/media/figures -maxdepth 1 -name '{PREFIX[b]}-*' -delete")

    sftp.close()
    client.close()
    print("done")


if __name__ == "__main__":
    main()
