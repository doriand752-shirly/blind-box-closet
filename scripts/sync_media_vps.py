"""Upload local server/media/figures to VPS and update Postgres image_url from catalogs."""
from __future__ import annotations

import json
import os
import time
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
LOCAL = ROOT / "server" / "media" / "figures"
REMOTE_DIR = "/opt/blind-box-closet/media/figures"
PUBLIC = "http://85.17.145.134:8787/media/figures"
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
        err = stderr.read().decode("utf-8", "replace")[:240]
        print("sql fail", err)
    return code


def main():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect("85.17.145.134", username="root", password=PASSWORD, timeout=30)
    sftp = client.open_sftp()
    client.exec_command(f"mkdir -p {REMOTE_DIR}")[1].channel.recv_exit_status()

    files = list(LOCAL.glob("*"))
    print("uploading", len(files), "files")
    for i, path in enumerate(files):
        if not path.is_file():
            continue
        sftp.put(str(path), f"{REMOTE_DIR}/{path.name}")
        if i % 25 == 0:
            print("  uploaded", i, path.name)

    catalogs = [
        ROOT / "server/data/smiski-catalog.json",
        ROOT / "server/data/sonny-angel-catalog.json",
        ROOT / "server/data/labubu-catalog.json",
    ]
    updated = 0
    for cat_path in catalogs:
        data = json.loads(cat_path.read_text(encoding="utf-8"))
        brand_slug = data["brand"]["slug"]
        for series in data["series"]:
            cover = None
            for fig in series["figures"]:
                src = fig.get("image_source")
                if not src or "smiski-unknown" in str(src):
                    continue
                if "/media/figures/" in str(src):
                    url = src
                else:
                    continue
                name = fig["name_en"].replace("'", "''")
                slug = series["slug"].replace("'", "''")
                sql = (
                    "UPDATE figures f SET image_url = '%s' FROM series s "
                    "JOIN brands b ON b.id = s.brand_id "
                    "WHERE f.series_id = s.id AND b.slug = '%s' AND s.slug = '%s' AND f.name_en = '%s';"
                ) % (url, brand_slug, slug, name)
                if run_sql(client, sql) == 0:
                    updated += 1
                    cover = cover or url
                time.sleep(0.01)
            if cover:
                sql = (
                    "UPDATE series s SET cover_image_url = '%s' FROM brands b "
                    "WHERE s.brand_id = b.id AND b.slug = '%s' AND s.slug = '%s';"
                ) % (cover, brand_slug, series["slug"].replace("'", "''"))
                run_sql(client, sql)

        # brand hero = first cover
        run_sql(
            client,
            "UPDATE brands SET hero_image_url = ("
            "SELECT s.cover_image_url FROM series s WHERE s.brand_id = brands.id "
            "AND s.cover_image_url IS NOT NULL ORDER BY s.sort_order LIMIT 1"
            f") WHERE slug = '{brand_slug}';",
        )

    # never leave coming-soon brands on smiski-unknown
    run_sql(
        client,
        "UPDATE brands SET hero_image_url = NULL WHERE status = 'coming_soon';",
    )

    sftp.close()
    client.close()
    print("done updated figures=", updated)


if __name__ == "__main__":
    main()
