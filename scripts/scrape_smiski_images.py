"""Scrape official Smiski product images and map them to DB figures on the VPS."""
from __future__ import annotations

import json
import os
import re
import time
import urllib.request
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "server" / "media" / "figures"
OUT.mkdir(parents=True, exist_ok=True)

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
    "strap-accessory-1": "https://smiski.com/e/products/strap-accessories-series-1/",
    "strap-accessory-2": "https://smiski.com/e/products/strap-accessories-series-2/",
    "strap-accessory-3": "https://smiski.com/e/products/strap-accessories-series-3/",
    "strap-accessory-4": "https://smiski.com/e/products/strap-accessories-series-4/",
    "bath-ball": "https://smiski.com/e/products/bath-ball/",
    "bath-ball-2": "https://smiski.com/e/products/bath-ball-2/",
    "hanging-christmas": "https://smiski.com/e/products/hanging-figure-christmas-style/",
    "key-chain": "https://smiski.com/e/products/key-chain/",
    "toothbrush-stand": "https://smiski.com/e/products/toothbrush-stand/",
    "zipperbite": "https://smiski.com/e/products/zipperbite/",
    "zipperbite-2": "https://smiski.com/e/products/zipperbite-2/",
    "touch-light": "https://smiski.com/e/products/touch-light/",
    "touch-light-2": "https://smiski.com/e/products/touch-light-2/",
    "sensor-light": "https://smiski.com/e/products/sensor-light/",
    "plush": "https://smiski.com/e/products/plush/",
    "plush-key-chain": "https://smiski.com/e/products/plush-key-chain/",
    "embroidery-sticker": "https://smiski.com/e/products/embroidery-sticker/",
    "embroidery-sticker-2": "https://smiski.com/e/products/embroidery-sticker-2/",
    "rainbomb": "https://smiski.com/e/products/rainbomb/",
    "bobbing-head": "https://smiski.com/e/products/bobbing-head/",
    "ringcolle": "https://smiski.com/e/products/ringcolle/",
    "cushion-pouch": "https://smiski.com/e/products/cushion-pouch/",
}

IMG_RE = re.compile(
    r'(https://smiski\.com/wp-content/uploads/[^"\'\s>]+\.(?:png|jpg|jpeg|webp))',
    re.I,
)
H2_RE = re.compile(
    r'<h[45][^>]*>\s*(?:Smiski\s+)?([^<]+?)\s*</h[45]>',
    re.I,
)


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 BlindBoxCloset/1.0"})
    with urllib.request.urlopen(req, timeout=40) as r:
        return r.read().decode("utf-8", "replace")


def download(url: str, dest: Path):
    if dest.exists() and dest.stat().st_size > 1000:
        return
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 BlindBoxCloset/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        dest.write_bytes(r.read())


def normalize(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", name.lower())


def extract_named_images(html: str) -> list[tuple[str, str]]:
    """Return (figure_name, image_url) pairs when possible."""
    pairs: list[tuple[str, str]] = []
    # Split around headings and find first image after each
    parts = re.split(r"(<h[45][^>]*>.*?</h[45]>)", html, flags=re.I | re.S)
    current_name = None
    for part in parts:
        hm = H2_RE.search(part)
        if hm:
            current_name = re.sub(r"\s+", " ", hm.group(1)).strip()
            current_name = re.sub(r"^Smiski\s+", "", current_name, flags=re.I)
            continue
        if current_name:
            imgs = [
                u
                for u in IMG_RE.findall(part)
                if "logo" not in u.lower() and "icon" not in u.lower() and "favicon" not in u.lower()
            ]
            if imgs:
                pairs.append((current_name, imgs[0]))
                current_name = None
    return pairs


def extract_all_images(html: str) -> list[str]:
    urls = []
    for u in IMG_RE.findall(html):
        low = u.lower()
        if any(x in low for x in ("logo", "icon", "favicon", "banner", "ogp", "sns")):
            continue
        if u not in urls:
            urls.append(u)
    return urls


def main():
    catalog = json.loads((ROOT / "server" / "data" / "smiski-catalog.json").read_text(encoding="utf-8"))
    series_by_slug = {s["slug"]: s for s in catalog["series"]}
    assignments: list[tuple[str, str, Path]] = []  # slug, name_en, local_path

    for slug, page in SERIES_PAGES.items():
        series = series_by_slug.get(slug)
        if not series:
            print("skip unknown slug", slug)
            continue
        try:
            html = fetch(page)
        except Exception as e:
            print("fail page", slug, e)
            continue

        named = extract_named_images(html)
        all_imgs = extract_all_images(html)
        print(slug, "named=", len(named), "imgs=", len(all_imgs))

        used = set()
        # 1) match by name
        for fig in series["figures"]:
            if fig.get("is_secret") and not any("secret" in (n.lower()) for n, _ in named):
                continue
            target = normalize(fig["name_en"])
            match_url = None
            for n, url in named:
                nn = normalize(n)
                if target in nn or nn in target or target.replace("smiski", "") == nn.replace("smiski", ""):
                    match_url = url
                    break
            if not match_url:
                continue
            ext = Path(match_url.split("?")[0]).suffix or ".png"
            fname = f"{slug}-{normalize(fig['name_en'])[:40]}{ext}"
            dest = OUT / fname
            try:
                download(match_url, dest)
                assignments.append((slug, fig["name_en"], dest))
                used.add(match_url)
                fig["image_source"] = match_url
                print("  matched", fig["name_en"], "->", fname)
            except Exception as e:
                print("  dl fail", fig["name_en"], e)
            time.sleep(0.15)

        # 2) fill remaining non-secret sequentially with leftover images
        leftovers = [u for u in all_imgs if u not in used]
        regulars = [
            f
            for f in series["figures"]
            if not f.get("is_secret") and not any(a[1] == f["name_en"] and a[0] == slug for a in assignments)
        ]
        for i, fig in enumerate(regulars):
            if i >= len(leftovers):
                break
            url = leftovers[i]
            ext = Path(url.split("?")[0]).suffix or ".png"
            fname = f"{slug}-{i+1:02d}{ext}"
            dest = OUT / fname
            try:
                download(url, dest)
                assignments.append((slug, fig["name_en"], dest))
                fig["image_source"] = url
                print("  sequential", fig["name_en"], "->", fname)
            except Exception as e:
                print("  dl fail", fig["name_en"], e)
            time.sleep(0.15)
        time.sleep(0.3)

    (ROOT / "server" / "data" / "smiski-catalog.json").write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    # Upload + SQL update on VPS
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
    for slug, name_en, dest in assignments:
        remote = f"{remote_dir}/{dest.name}"
        sftp.put(str(dest), remote)
        url = f"http://85.17.145.134:8787/media/figures/{dest.name}"
        safe = name_en.replace("'", "''")
        sql = (
            "UPDATE figures f SET image_url = '%s' "
            "FROM series s WHERE f.series_id = s.id AND s.slug = '%s' AND f.name_en = '%s';"
        ) % (url, slug, safe)
        cmd = (
            "cd /opt/blind-box-closet/server && "
            "docker compose exec -T db psql -U bbc -d blindboxcloset -c \"%s\"" % sql
        )
        stdin, stdout, stderr = client.exec_command(cmd, timeout=60)
        code = stdout.channel.recv_exit_status()
        if code == 0:
            updated += 1
        else:
            print("sql fail", name_en, stderr.read().decode("utf-8", "replace")[:200])

        # cover = first image of series
    covers = {}
    for slug, name_en, dest in assignments:
        covers.setdefault(slug, dest.name)
    for slug, fname in covers.items():
        url = f"http://85.17.145.134:8787/media/figures/{fname}"
        sql = "UPDATE series SET cover_image_url = '%s' WHERE slug = '%s';" % (url, slug)
        cmd = (
            "cd /opt/blind-box-closet/server && "
            "docker compose exec -T db psql -U bbc -d blindboxcloset -c \"%s\"" % sql
        )
        client.exec_command(cmd, timeout=60)[1].channel.recv_exit_status()

    sftp.close()
    client.close()
    print("Done assignments=", len(assignments), "updated=", updated)


if __name__ == "__main__":
    main()
