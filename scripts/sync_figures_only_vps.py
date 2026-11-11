"""Upload figure media and update figures.image_url only (never overwrite series covers)."""
from __future__ import annotations

import json
import os
import time
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
LOCAL = ROOT / "server" / "media" / "figures"
REMOTE_DIR = "/opt/blind-box-closet/media/figures"
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
        print("sql fail", stderr.read().decode("utf-8", "replace")[:240])
    return code


def main() -> None:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect("85.17.145.134", username="root", password=PASSWORD, timeout=30)
    sftp = client.open_sftp()
    client.exec_command(f"mkdir -p {REMOTE_DIR}")[1].channel.recv_exit_status()

    files = [p for p in LOCAL.iterdir() if p.is_file()]
    print("uploading figures", len(files))
    for i, path in enumerate(files):
        sftp.put(str(path), f"{REMOTE_DIR}/{path.name}")
        if i % 40 == 0:
            print(" ", i, path.name)

    updated = 0
    cat = json.loads((ROOT / "server/data/smiski-catalog.json").read_text(encoding="utf-8"))
    for series in cat["series"]:
        for fig in series["figures"]:
            src = fig.get("image_source")
            if not src or "smiski-unknown" in str(src) or "/media/figures/" not in str(src):
                continue
            name = fig["name_en"].replace("'", "''")
            slug = series["slug"].replace("'", "''")
            url = str(src).replace("'", "''")
            sql = (
                "UPDATE figures f SET image_url = '%s' FROM series s "
                "JOIN brands b ON b.id = s.brand_id "
                "WHERE f.series_id = s.id AND b.slug = 'smiski' AND s.slug = '%s' AND f.name_en = '%s';"
            ) % (url, slug, name)
            if run_sql(client, sql) == 0:
                updated += 1
            time.sleep(0.005)

    # re-assert official series covers + hero from catalog (do not use figure shots)
    for series in cat["series"]:
        cover = series.get("cover_image_url")
        if not cover or "smiski-unknown" in str(cover):
            continue
        if "/media/series/" not in str(cover):
            continue
        slug = series["slug"].replace("'", "''")
        url = str(cover).replace("'", "''")
        run_sql(
            client,
            "UPDATE series s SET cover_image_url = '%s' FROM brands b "
            "WHERE s.brand_id = b.id AND b.slug = 'smiski' AND s.slug = '%s';" % (url, slug),
        )
    hero = cat["brand"].get("hero_image_url")
    if hero and "/media/series/" in str(hero):
        run_sql(
            client,
            "UPDATE brands SET hero_image_url = '%s' WHERE slug = 'smiski';"
            % str(hero).replace("'", "''"),
        )

    sftp.close()
    client.close()
    print("figures updated", updated)


if __name__ == "__main__":
    main()
