"""Render App Store marketing screenshots from HTML mockups via Edge headless."""
from __future__ import annotations

import json
import subprocess
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "store" / "screenshots"
CACHE = ROOT / ".cache" / "shot-html"
EDGE = Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe")
API = "http://85.17.145.134:8787"
LOGO = (ROOT / "assets" / "brand" / "logo-mark.png").as_uri()

SIZES = {
    "iphone67": (1290, 2796),
    "ipad129": (2048, 2732),
}

SHOTS = [
    {
        "id": "01-home",
        "kicker": "TES COLLECTIONS",
        "title": "Tes blind boxes,\nbien rangées.",
        "body": "Smiski, Sonny Angel, Labubu — progression en un coup d’œil.",
    },
    {
        "id": "02-checklist",
        "kicker": "CHECKLIST",
        "title": "Coche. Note.\nÉchange.",
        "body": "Possédé, quantité, wishlist et doublons, série par série.",
    },
    {
        "id": "03-progress",
        "kicker": "PROGRESSION",
        "title": "Chaque série\na son score.",
        "body": "Main et Extras séparés. Recherche et filtres inclus.",
    },
]


def get_json(path: str):
    with urllib.request.urlopen(API + path, timeout=30) as r:
        return json.loads(r.read().decode())


def download(url: str, dest: Path) -> str | None:
    if not url:
        return None
    try:
        dest.parent.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(url, timeout=30) as r:
            dest.write_bytes(r.read())
        return dest.resolve().as_uri()
    except Exception as e:
        print("skip", url, e)
        return None


def hex_to_frame(phone: bool) -> str:
    w, h = (390, 844) if phone else (820, 1090)
    r = 48 if phone else 28
    return w, h, r


def html_for(shot: dict, device: str, brands: list, figures: list) -> str:
    phone = device.startswith("iphone")
    fw, fh, radius = hex_to_frame(phone)
    canvas_w, canvas_h = SIZES[device]

    brand_cards = ""
    palette = {
        "smiski": ("#D5DDC2", "#7D8F5E"),
        "sonny-angel": ("#F4D4CA", "#CF8C7A"),
        "labubu": ("#D7C5D8", "#A286A8"),
    }
    for b in brands[:3]:
        card, bar = palette.get(b["slug"], ("#EDE6DC", "#7A6A5C"))
        hero = b.get("hero") or ""
        owned = {"smiski": "30 / 145", "labubu": "0 / 113", "sonny-angel": "0 / 884"}.get(
            b["slug"], "0 / 0"
        )
        brand_cards += f"""
        <div class="brand" style="background:linear-gradient(135deg,{card},#FBF8F2)">
          <div>
            <div class="brand-name">{b['name']}{'s' if not b['name'].endswith('s') else ''}</div>
            <div class="bar"><i style="width:28%;background:{bar}"></i></div>
            <div class="count">{owned}</div>
          </div>
          {"<img src='" + hero + "' alt='' />" if hero else "<div class='ph'></div>"}
        </div>"""

    fig_tiles = ""
    for f in figures[:9]:
        img = f.get("image_url") or ""
        name = f.get("name_en") or ""
        fig_tiles += f"""
        <div class="fig">
          <div class="tile">{'<img src="' + img + '" alt="" />' if img else ''}<span class="check">✓</span></div>
          <div class="fname">{name}</div>
        </div>"""

    if shot["id"].startswith("01"):
        phone_body = f"""
          <div class="app-top">Collections</div>
          <div class="app-sub">Tes marques en un coup d’œil.</div>
          {brand_cards}
        """
    elif shot["id"].startswith("02"):
        phone_body = f"""
          <div class="app-top">Smiskis</div>
          <div class="app-sub">30 / 145 · 21%</div>
          <div class="seg"><b>Main</b><span>Extras</span></div>
          <div class="filters"><b>Tous</b><span>Possédés</span><span>Échange</span></div>
          <div class="series">Series 1 <em>0/11</em></div>
          <div class="grid">{fig_tiles}</div>
        """
    else:
        phone_body = f"""
          <div class="app-top">Smiskis</div>
          <div class="app-sub">30 / 145 · 21%</div>
          <div class="big-progress">
            <div class="pct">21%</div>
            <div class="label">de ta collection Main</div>
            <div class="bar big"><i style="width:21%;background:#7D8F5E"></i></div>
          </div>
          {brand_cards}
        """

    return f"""<!doctype html>
<html><head><meta charset="utf-8"/>
<style>
  @font-face {{ font-family: Nunito; src: local("Nunito"), local("Segoe UI"); }}
  html,body {{ margin:0; width:{canvas_w}px; height:{canvas_h}px; overflow:hidden; }}
  body {{
    font-family: Nunito, "Segoe UI", system-ui, sans-serif;
    background:
      radial-gradient(circle at 20% 15%, #F4D4CA 0%, transparent 42%),
      radial-gradient(circle at 85% 20%, #D7C5D8 0%, transparent 40%),
      radial-gradient(circle at 70% 85%, #B5BE9F 0%, transparent 45%),
      linear-gradient(165deg, #F7F3EC 0%, #F4E8D8 55%, #EEF1E4 100%);
    color:#3A2A1F;
    position:relative;
  }}
  .logo {{
    position:absolute; top:72px; left:72px; width:96px; height:96px;
    border-radius:22px; box-shadow:0 12px 30px rgba(58,42,31,.12);
  }}
  .copy {{
    position:absolute; top:{"210px" if phone else "160px"}; left:72px; right:{"48%" if phone else "46%"};
  }}
  .kicker {{ letter-spacing:2px; font-weight:800; font-size:22px; color:#7A6A5C; margin-bottom:18px; }}
  h1 {{ margin:0; font-size:{"64px" if phone else "72px"}; line-height:1.05; letter-spacing:-1.2px; white-space:pre-line; }}
  .body {{ margin-top:22px; font-size:28px; line-height:1.35; color:#7A6A5C; max-width:520px; }}
  .device {{
    position:absolute; right:{"48px" if phone else "70px"}; bottom:{"70px" if phone else "80px"};
    width:{fw}px; height:{fh}px; border-radius:{radius}px;
    background:#FBF8F2; border:10px solid #3A2A1F;
    box-shadow:0 30px 60px rgba(58,42,31,.22); overflow:hidden;
    padding:18px 16px 16px; box-sizing:border-box;
  }}
  .notch {{
    width:120px; height:28px; border-radius:16px; background:#3A2A1F;
    margin:0 auto 14px; {"display:block" if phone else "display:none"};
  }}
  .app-top {{ font-weight:800; font-size:28px; letter-spacing:-.4px; }}
  .app-sub {{ color:#7A6A5C; margin:4px 0 14px; font-size:15px; }}
  .brand {{
    display:flex; align-items:center; justify-content:space-between;
    border-radius:22px; padding:14px 16px; margin-bottom:12px; min-height:86px;
  }}
  .brand-name {{ font-weight:800; font-size:22px; }}
  .bar {{ height:8px; background:rgba(255,255,255,.55); border-radius:99px; margin:12px 0 6px; overflow:hidden; width:140px; }}
  .bar i {{ display:block; height:100%; border-radius:99px; }}
  .bar.big {{ width:100%; height:12px; }}
  .count {{ color:#7A6A5C; font-weight:700; font-size:14px; }}
  .brand img, .ph {{ width:78px; height:86px; object-fit:contain; }}
  .ph {{ background:rgba(255,255,255,.45); border-radius:12px; }}
  .seg, .filters {{ display:flex; gap:8px; margin-bottom:10px; }}
  .seg b, .filters b {{ background:#fff; border-radius:14px; padding:8px 12px; font-size:13px; }}
  .seg span, .filters span {{ background:transparent; border-radius:14px; padding:8px 12px; font-size:13px; color:#7A6A5C; }}
  .series {{ background:#fff; border-radius:16px; padding:12px 14px; font-weight:800; margin-bottom:10px; display:flex; justify-content:space-between; }}
  .series em {{ font-style:normal; color:#7A6A5C; font-weight:700; }}
  .grid {{ display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }}
  .tile {{ aspect-ratio:1; background:#F3EEE6; border-radius:14px; position:relative; overflow:hidden; border:2px solid rgba(95,107,69,.22); }}
  .tile img {{ width:100%; height:100%; object-fit:contain; }}
  .check {{ position:absolute; top:6px; right:6px; width:18px; height:18px; border-radius:6px; background:#3A2A1F; color:#fff; font-size:11px; display:grid; place-items:center; }}
  .fname {{ font-size:10px; text-align:center; margin-top:4px; min-height:24px; font-weight:700; }}
  .big-progress {{ background:#fff; border-radius:22px; padding:18px; margin-bottom:14px; }}
  .pct {{ font-size:42px; font-weight:800; }}
  .label {{ color:#7A6A5C; margin-bottom:10px; }}
</style></head>
<body>
  <img class="logo" src="{LOGO}" alt="" />
  <div class="copy">
    <div class="kicker">{shot["kicker"]}</div>
    <h1>{shot["title"]}</h1>
    <div class="body">{shot["body"]}</div>
  </div>
  <div class="device">
    <div class="notch"></div>
    {phone_body}
  </div>
</body></html>"""


def capture(html_path: Path, out_path: Path, w: int, h: int) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        str(EDGE),
        "--headless=new",
        "--disable-gpu",
        f"--window-size={w},{h}",
        "--hide-scrollbars",
        f"--screenshot={out_path}",
        html_path.resolve().as_uri(),
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    print(f"wrote {out_path.relative_to(ROOT)} ({out_path.stat().st_size} bytes)")


def main() -> None:
    CACHE.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    brands = get_json("/catalog/brands")["brands"]
    # Prefer Smiski first for the mock
    brands = sorted(brands, key=lambda b: {"smiski": 0, "labubu": 1, "sonny-angel": 2}.get(b["slug"], 9))
    media = CACHE / "media"
    for b in brands:
        local = download(b.get("hero") or "", media / f"brand-{b['slug']}.img")
        if local:
            b["hero"] = local
    checklist = get_json("/catalog/brands/smiski/checklist?bucket=main")
    figures = checklist.get("figures") or []
    for i, f in enumerate(figures[:12]):
        local = download(f.get("image_url") or "", media / f"fig-{i}.img")
        if local:
            f["image_url"] = local

    for device, (w, h) in SIZES.items():
        for shot in SHOTS:
            html = html_for(shot, device, brands, figures)
            html_path = CACHE / f"{device}-{shot['id']}.html"
            html_path.write_text(html, encoding="utf-8")
            out = OUT / device / f"{shot['id']}.png"
            capture(html_path, out, w, h)


if __name__ == "__main__":
    main()
