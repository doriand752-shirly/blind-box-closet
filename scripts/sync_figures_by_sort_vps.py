"""Sync Smiski figure names + image_url by series slug + sort_order. Preserve series covers."""
from __future__ import annotations

import json
import os
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
LOCAL = ROOT / "server" / "media" / "figures"
REMOTE = "/opt/blind-box-closet/media/figures"
PASSWORD = os.environ.get("VPS_PASSWORD")
if not PASSWORD:
    raise SystemExit("Set VPS_PASSWORD")


def run_sql(client: paramiko.SSHClient, sql: str) -> int:
    safe = sql.replace('"', '\\"')
    cmd = (
        "cd /opt/blind-box-closet/server && "
        f'docker compose exec -T db psql -U bbc -d blindboxcloset -c "{safe}"'
    )
    _i, o, e = client.exec_command(cmd, timeout=90)
    code = o.channel.recv_exit_status()
    if code != 0:
        print("sql fail", e.read().decode("utf-8", "replace")[:240])
    return code


def main() -> None:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect("85.17.145.134", username="root", password=PASSWORD, timeout=30)
    sftp = client.open_sftp()
    client.exec_command(f"mkdir -p {REMOTE}")[1].channel.recv_exit_status()
    files = [p for p in LOCAL.iterdir() if p.is_file()]
    print("upload figures", len(files))
    for p in files:
        sftp.put(str(p), f"{REMOTE}/{p.name}")

    cat = json.loads((ROOT / "server/data/smiski-catalog.json").read_text(encoding="utf-8"))
    updated = 0
    for series in cat["series"]:
        slug = series["slug"].replace("'", "''")
        for fig in series["figures"]:
            name = fig["name_en"].replace("'", "''")
            sort_order = int(fig.get("sort_order") or 0)
            src = fig.get("image_source")
            img_sql = ""
            if src and "smiski-unknown" not in str(src) and "/media/figures/" in str(src):
                url = str(src).replace("'", "''")
                img_sql = f", image_url = '{url}'"
            sql = (
                "UPDATE figures f SET name_en = '%s'%s FROM series s "
                "JOIN brands b ON b.id = s.brand_id "
                "WHERE f.series_id = s.id AND b.slug = 'smiski' AND s.slug = '%s' "
                "AND f.sort_order = %s;"
            ) % (name, img_sql, slug, sort_order)
            if run_sql(client, sql) == 0:
                updated += 1

        cover = series.get("cover_image_url")
        if cover and "/media/series/" in str(cover):
            url = str(cover).replace("'", "''")
            run_sql(
                client,
                "UPDATE series s SET cover_image_url = '%s' FROM brands b "
                "WHERE s.brand_id = b.id AND b.slug = 'smiski' AND s.slug = '%s';"
                % (url, slug),
            )

    hero = cat["brand"].get("hero_image_url")
    if hero and "/media/series/" in str(hero):
        run_sql(
            client,
            "UPDATE brands SET hero_image_url = '%s' WHERE slug = 'smiski';"
            % str(hero).replace("'", "''"),
        )

    # also upload series covers
    series_dir = ROOT / "server/media/series"
    if series_dir.exists():
        remote_s = "/opt/blind-box-closet/media/series"
        client.exec_command(f"mkdir -p {remote_s}")[1].channel.recv_exit_status()
        for p in series_dir.iterdir():
            if p.is_file():
                sftp.put(str(p), f"{remote_s}/{p.name}")

    sftp.close()
    client.close()
    print("updated rows", updated)


if __name__ == "__main__":
    main()
