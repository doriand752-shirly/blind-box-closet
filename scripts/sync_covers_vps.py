"""Upload series covers + update cover_image_url / hero_image_url from catalogs."""
from __future__ import annotations

import json
import os
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
LOCAL_SERIES = ROOT / "server" / "media" / "series"
REMOTE_SERIES = "/opt/blind-box-closet/media/series"
PASSWORD = os.environ.get("VPS_PASSWORD")
if not PASSWORD:
    raise SystemExit("Set VPS_PASSWORD")


def run_sql(client: paramiko.SSHClient, sql: str) -> int:
    safe = sql.replace('"', '\\"')
    cmd = (
        "cd /opt/blind-box-closet/server && "
        f'docker compose exec -T db psql -U bbc -d blindboxcloset -c "{safe}"'
    )
    _stdin, stdout, stderr = client.exec_command(cmd, timeout=90)
    code = stdout.channel.recv_exit_status()
    if code != 0:
        print("sql fail", stderr.read().decode("utf-8", "replace")[:240])
    return code


def main():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect("85.17.145.134", username="root", password=PASSWORD, timeout=30)
    sftp = client.open_sftp()
    client.exec_command(f"mkdir -p {REMOTE_SERIES}")[1].channel.recv_exit_status()

    if LOCAL_SERIES.exists():
        files = [p for p in LOCAL_SERIES.iterdir() if p.is_file()]
        print("uploading series covers", len(files))
        for p in files:
            sftp.put(str(p), f"{REMOTE_SERIES}/{p.name}")

    catalogs = [
        ROOT / "server/data/smiski-catalog.json",
        ROOT / "server/data/sonny-angel-catalog.json",
        ROOT / "server/data/labubu-catalog.json",
    ]
    for cat_path in catalogs:
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
        else:
            run_sql(
                client,
                "UPDATE brands SET hero_image_url = ("
                "SELECT s.cover_image_url FROM series s WHERE s.brand_id = brands.id "
                "AND s.cover_image_url IS NOT NULL AND s.cover_image_url NOT LIKE '%%smiski-unknown%%' "
                "ORDER BY s.sort_order LIMIT 1"
                f") WHERE slug = '{brand}';",
            )

    run_sql(client, "UPDATE brands SET hero_image_url = NULL WHERE status = 'coming_soon';")
    # Ensure Dorian is admin
    run_sql(
        client,
        "UPDATE users SET is_admin = true WHERE "
        "lower(coalesce(email,'')) = 'dorian172@outlook.com' "
        "OR lower(coalesce(display_name,'')) LIKE '%%dorian%%';",
    )

    sftp.close()
    client.close()
    print("covers sync done")


if __name__ == "__main__":
    main()
