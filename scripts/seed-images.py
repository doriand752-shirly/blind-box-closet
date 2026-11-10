"""Download Smiski product images from smiski.com when available and push to VPS media."""
from __future__ import annotations

import json
import os
import re
import time
import urllib.request
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "server" / "data" / "smiski-catalog.json"
OUT = ROOT / "server" / "media" / "figures"
OUT.mkdir(parents=True, exist_ok=True)

# Official EN product pages (best-effort)
SERIES_PAGES = {
    "series-1": "https://smiski.com/e/products/series-1/",
    "series-2": "https://smiski.com/e/products/series-2/",
    "series-3": "https://smiski.com/e/products/series-3/",
    "series-4": "https://smiski.com/e/products/series-4/",
    "bath": "https://smiski.com/e/products/bath-series/",
    "toilet": "https://smiski.com/e/products/toilet-series/",
    "living": "https://smiski.com/e/products/living-series/",
    "bed": "https://smiski.com/e/products/bed-series/",
    "yoga": "https://smiski.com/e/products/yoga-series/",
    "cheer": "https://smiski.com/e/products/cheer-series/",
    "museum": "https://smiski.com/e/products/museum-series/",
    "work": "https://smiski.com/e/products/work-series/",
    "dressing": "https://smiski.com/e/products/dressing-series/",
    "exercising": "https://smiski.com/e/products/exercising-series/",
    "moving": "https://smiski.com/e/products/moving-series/",
    "hippers": "https://smiski.com/e/products/hippers/",
    "sunday": "https://smiski.com/e/products/sunday-series/",
    "birthday": "https://smiski.com/e/products/birthday-series/",
    "construction": "https://smiski.com/e/products/construction-series/",
}

IMG_RE = re.compile(r'https://smiski\.com/wp-content/uploads/[^"\']+\.(?:png|jpg|jpeg|webp)', re.I)


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "BlindBoxClosetBot/1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", "replace")


def download(url: str, dest: Path):
    req = urllib.request.Request(url, headers={"User-Agent": "BlindBoxClosetBot/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        dest.write_bytes(r.read())


def main():
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    mapping = {}  # series_slug -> list of image urls found on page

    for slug, page in SERIES_PAGES.items():
        try:
            html = fetch(page)
            urls = list(dict.fromkeys(IMG_RE.findall(html)))
            # Prefer product figure shots over logos
            urls = [u for u in urls if "logo" not in u.lower()]
            mapping[slug] = urls
            print(slug, len(urls), "images")
            time.sleep(0.4)
        except Exception as e:
            print("fail", slug, e)

    # Assign sequentially to non-secret figures
    local_files = []
    for series in catalog["series"]:
        slug = series["slug"]
        urls = mapping.get(slug) or []
        if not urls:
            continue
        regulars = [f for f in series["figures"] if not f.get("is_secret")]
        for i, fig in enumerate(regulars):
            if i >= len(urls):
                break
            url = urls[i]
            ext = Path(url).suffix.split("?")[0] or ".jpg"
            fname = f"{slug}-{i+1}{ext}"
            dest = OUT / fname
            try:
                if not dest.exists():
                    download(url, dest)
                    time.sleep(0.2)
                fig["image_source"] = url
                local_files.append((slug, fig["name_en"], dest))
                print("saved", dest.name)
            except Exception as e:
                print("dl fail", url, e)

    CATALOG.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # Upload to VPS and update DB image_url for matching names
    if not local_files:
        print("No images downloaded")
        return

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    password = os.environ.get("VPS_PASSWORD")
    if not password:
        raise SystemExit("Set VPS_PASSWORD env var")
    client.connect("85.17.145.134", username="root", password=password, timeout=30)
    sftp = client.open_sftp()
    remote_media = "/opt/blind-box-closet/media/figures"
    stdin, stdout, stderr = client.exec_command(f"mkdir -p {remote_media}")
    stdout.channel.recv_exit_status()

    for slug, name_en, dest in local_files:
        remote = f"{remote_media}/{dest.name}"
        sftp.put(str(dest), remote)
        url = f"http://85.17.145.134:8787/media/figures/{dest.name}"
        # escape single quotes in name
        safe = name_en.replace("'", "''")
        sql = (
            "UPDATE figures SET image_url = '%s' "
            "WHERE name_en = '%s' AND series_id IN ("
            "SELECT id FROM series WHERE slug = '%s')"
        ) % (url, safe, slug)
        cmd = f"cd /opt/blind-box-closet/server && docker compose exec -T db psql -U bbc -d blindboxcloset -c \"{sql}\""
        stdin, stdout, stderr = client.exec_command(cmd, timeout=60)
        code = stdout.channel.recv_exit_status()
        out = stdout.read().decode("utf-8", "replace")
        err = stderr.read().decode("utf-8", "replace")
        print(name_en, "->", "ok" if code == 0 else err or out)

    # Also set series cover to first figure image when available
    for slug, urls in mapping.items():
        if not urls:
            continue
        # find first local for slug
        first = next((p for s, n, p in local_files if s == slug), None)
        if not first:
            continue
        url = f"http://85.17.145.134:8787/media/figures/{first.name}"
        sql = "UPDATE series SET cover_image_url = '%s' WHERE slug = '%s'" % (url, slug)
        cmd = f"cd /opt/blind-box-closet/server && docker compose exec -T db psql -U bbc -d blindboxcloset -c \"{sql}\""
        stdin, stdout, stderr = client.exec_command(cmd, timeout=60)
        stdout.channel.recv_exit_status()

    sftp.close()
    client.close()
    print("Done", len(local_files), "images")


if __name__ == "__main__":
    main()
