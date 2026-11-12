"""Build the app icon, splash and Android adaptive assets from the logo.

Source: assets/brand/logo.png (the only brand mark).

Run from the repo root: python scripts/build_brand_assets.py
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
BRAND = ROOT / "assets" / "brand"
ASSETS = ROOT / "assets"
SOURCE = BRAND / "logo.png"

SIZE = 1024
# Cream of the logo. Keep in sync with splash and adaptiveIcon in app.json.
WALL = (246, 239, 225)


def report(path: Path) -> None:
    print(f"wrote {path.relative_to(ROOT).as_posix()} ({path.stat().st_size} bytes)")


def rounded_mask(size: int, radius: int) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    return mask


def feather_mask(size: int, feather: int) -> Image.Image:
    """Opaque square whose edges fade to transparent over `feather` pixels."""
    inner = Image.new("L", (size, size), 0)
    ImageDraw.Draw(inner).rectangle(
        (feather, feather, size - 1 - feather, size - 1 - feather), fill=255
    )
    return inner.filter(ImageFilter.GaussianBlur(feather / 2))


def build_icon(art: Image.Image) -> None:
    """iOS / Expo icon: full bleed, opaque (iOS applies its own corner mask)."""
    art.save(ASSETS / "icon.png", "PNG", optimize=True)
    report(ASSETS / "icon.png")


def build_splash(art: Image.Image) -> None:
    """Splash: the icon as a rounded tile with a soft shadow, on transparency.

    The tile sits on the cream splash background set in app.json, so the
    artwork's own wall colour never has to match it exactly.
    """
    tile_size = 640
    radius = int(tile_size * 0.225)
    tile = art.resize((tile_size, tile_size), Image.Resampling.LANCZOS).convert("RGBA")
    tile.putalpha(rounded_mask(tile_size, radius))

    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    offset = (SIZE - tile_size) // 2

    shadow_alpha = Image.new("L", (SIZE, SIZE), 0)
    shadow_alpha.paste(rounded_mask(tile_size, radius), (offset, offset + 18))
    shadow_alpha = shadow_alpha.filter(ImageFilter.GaussianBlur(28)).point(lambda v: int(v * 0.22))
    shadow = Image.new("RGBA", (SIZE, SIZE), (58, 42, 31, 0))
    shadow.putalpha(shadow_alpha)

    canvas.alpha_composite(shadow)
    canvas.alpha_composite(tile, (offset, offset))
    canvas.save(ASSETS / "splash-icon.png", "PNG", optimize=True)
    report(ASSETS / "splash-icon.png")


def build_android(art: Image.Image) -> None:
    """Adaptive icon: artwork inside the 66% safe zone, edges faded into WALL."""
    inner = int(SIZE * 0.70)
    scaled = art.resize((inner, inner), Image.Resampling.LANCZOS).convert("RGBA")
    scaled.putalpha(feather_mask(inner, feather=int(inner * 0.06)))

    foreground = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    offset = (SIZE - inner) // 2
    foreground.alpha_composite(scaled, (offset, offset))
    foreground.save(ASSETS / "android-icon-foreground.png", "PNG", optimize=True)
    report(ASSETS / "android-icon-foreground.png")

    Image.new("RGB", (SIZE, SIZE), WALL).save(
        ASSETS / "android-icon-background.png", "PNG", optimize=True
    )
    report(ASSETS / "android-icon-background.png")


def build_favicon(art: Image.Image) -> None:
    size = 48
    fav = art.resize((size, size), Image.Resampling.LANCZOS).convert("RGBA")
    fav.putalpha(rounded_mask(size, int(size * 0.225)))
    fav.save(ASSETS / "favicon.png", "PNG", optimize=True)
    report(ASSETS / "favicon.png")


def main() -> None:
    art = Image.open(SOURCE).convert("RGB")
    if art.size != (SIZE, SIZE):
        art = art.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    build_icon(art)
    build_splash(art)
    build_android(art)
    build_favicon(art)


if __name__ == "__main__":
    main()
