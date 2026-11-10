"""Seed figure images from Blind Box Tracker public assets, then upload to VPS."""
from __future__ import annotations

import json
import os
import re
import time
import urllib.error
import urllib.request
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "server" / "media" / "figures"
OUT.mkdir(parents=True, exist_ok=True)
BASE = "https://www.blindboxtracker.com/assets/collections/smiskis"

# Map our catalog slug -> BBT folder guesses
FOLDER_GUESSES = {
    "series-1": ["series_one", "series1", "series_1"],
    "series-2": ["series_two", "series2", "series_2"],
    "series-3": ["series_three", "series3", "series_3"],
    "series-4": ["series_four", "series4", "series_4"],
    "bath": ["bath", "bath_series"],
    "toilet": ["toilet", "toilet_series"],
    "living": ["living", "living_series"],
    "bed": ["bed", "bed_series"],
    "yoga": ["yoga", "yoga_series"],
    "cheer": ["cheer", "cheer_series"],
    "museum": ["museum", "museum_series"],
    "work": ["work", "at_work", "work_series"],
    "dressing": ["dressing", "dressing_series"],
    "exercising": ["exercising", "exercising_series"],
    "moving": ["moving", "moving_series"],
    "hippers": ["hippers", "smiski_hippers"],
    "sunday": ["sunday", "sunday_series"],
    "birthday": ["birthday", "birthday_series"],
    "construction": ["construction", "construction_series"],
    "strap-accessory-1": ["strap_accessory_series_1", "strap1", "strap_accessories_1"],
    "strap-accessory-2": ["strap_accessory_series_2", "strap2"],
    "strap-accessory-3": ["strap_accessory_series_3", "strap3"],
    "strap-accessory-4": ["strap_accessory_series_4", "strap4"],
    "bath-ball": ["bath_ball", "bathball"],
    "bath-ball-2": ["bath_ball_2", "bathball2"],
    "hanging-christmas": ["hanging_figure_christmas", "hanging_christmas"],
}


def slugify_name(name: str) -> list[str]:
    base = re.sub(r"[^a-z0-9]+", "", name.lower())
    alts = [base]
    # common variants
    alts.append(base.replace("smiski", ""))
    alts.append("smiski" + base.replace("smiski", ""))
    alts.append(base.replace("little", "littlesmiski"))
    if not base.startswith("smiski"):
        alts.append("smiski" + base)
    # spaced to underscore style leftovers already stripped
    return list(dict.fromkeys([a for a in alts if a]))


def exists(url: str) -> bool:
    try:
        req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=12) as r:
            return 200 <= r.status < 300
    except Exception:
        return False


def download(url: str, dest: Path):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=40) as r:
        dest.write_bytes(r.read())


def main():
    catalog = json.loads((ROOT / "server" / "data" / "smiski-catalog.json").read_text(encoding="utf-8"))
    folder_cache: dict[str, str] = {}
    assignments: list[tuple[str, str, Path, str]] = []

    # resolve folders
    for slug, guesses in FOLDER_GUESSES.items():
        for g in guesses:
            probe = f"{BASE}/{g}/"
            # probe with a known pattern from series_one
            # just mark folder if any later hit works; store first guess for now
            folder_cache[slug] = g
            break

    # Better: discover folder by trying first figure of each series against folder guesses
    for series in catalog["series"]:
        slug = series["slug"]
        guesses = FOLDER_GUESSES.get(slug, [slug.replace("-", "_"), slug])
        first = next((f for f in series["figures"] if not f.get("is_secret")), series["figures"][0])
        found_folder = None
        for folder in guesses:
            for name_slug in slugify_name(first["name_en"]):
                for ext in (".webp", ".png", ".jpg"):
                    url = f"{BASE}/{folder}/{name_slug}{ext}"
                    if exists(url):
                        found_folder = folder
                        break
                if found_folder:
                    break
            if found_folder:
                break
        if found_folder:
            folder_cache[slug] = found_folder
            print("folder", slug, "->", found_folder)
        else:
            print("no folder", slug)

    for series in catalog["series"]:
        slug = series["slug"]
        folder = folder_cache.get(slug)
        if not folder:
            continue
        for fig in series["figures"]:
            url = None
            for name_slug in slugify_name(fig["name_en"]):
                for ext in (".webp", ".png", ".jpg"):
                    candidate = f"{BASE}/{folder}/{name_slug}{ext}"
                    if exists(candidate):
                        url = candidate
                        break
                if url:
                    break
            if not url:
                print("  miss", slug, fig["name_en"])
                continue
            ext = Path(url).suffix
            fname = f"{slug}-{re.sub(r'[^a-z0-9]+', '', fig['name_en'].lower())[:48]}{ext}"
            dest = OUT / fname
            try:
                if not dest.exists() or dest.stat().st_size < 500:
                    download(url, dest)
                    time.sleep(0.05)
                assignments.append((slug, fig["name_en"], dest, url))
                print("  ok", fig["name_en"])
            except Exception as e:
                print("  fail", fig["name_en"], e)

    # upload
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    password = os.environ.get("VPS_PASSWORD")
    if not password:
        raise SystemExit("Set VPS_PASSWORD env var")
    client.connect("85.17.145.134", username="root", password=password, timeout=30)
    sftp = client.open_sftp()
    remote_dir = "/opt/blind-box-closet/media/figures"
    client.exec_command(f"mkdir -p {remote_dir}")[1].channel.recv_exit_status()

    updated = 0
    covers: dict[str, str] = {}
    for slug, name_en, dest, _url in assignments:
        remote = f"{remote_dir}/{dest.name}"
        sftp.put(str(dest), remote)
        url = f"http://85.17.145.134:8787/media/figures/{dest.name}"
        covers.setdefault(slug, dest.name)
        safe = name_en.replace("'", "''")
        sql = (
            "UPDATE figures f SET image_url = '%s' FROM series s "
            "WHERE f.series_id = s.id AND s.slug = '%s' AND f.name_en = '%s';"
        ) % (url, slug, safe)
        cmd = (
            "cd /opt/blind-box-closet/server && "
            'docker compose exec -T db psql -U bbc -d blindboxcloset -c "%s"' % sql
        )
        code = client.exec_command(cmd, timeout=60)[1].channel.recv_exit_status()
        if code == 0:
            updated += 1

    for slug, fname in covers.items():
        url = f"http://85.17.145.134:8787/media/figures/{fname}"
        sql = "UPDATE series SET cover_image_url = '%s' WHERE slug = '%s';" % (url, slug)
        cmd = (
            "cd /opt/blind-box-closet/server && "
            'docker compose exec -T db psql -U bbc -d blindboxcloset -c "%s"' % sql
        )
        client.exec_command(cmd, timeout=60)[1].channel.recv_exit_status()

    sftp.close()
    client.close()
    print("Done", len(assignments), "files, updated", updated)


if __name__ == "__main__":
    main()
