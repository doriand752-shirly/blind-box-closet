/**
 * Apply official Smiski product icon URLs → series.cover_image_url + brand hero.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const MEDIA = path.join(ROOT, "server", "media", "series");
const PUBLIC = "http://85.17.145.134:8787/media/series";
const CAT = path.join(ROOT, "server/data/smiski-catalog.json");
fs.mkdirSync(MEDIA, { recursive: true });

const ICONS = {
  construction:
    "https://smiski.com/e/wp-content/uploads/2026/11/smiski_product_icon_construction.png",
  birthday: "https://smiski.com/e/wp-content/uploads/2026/06/smiski_birthday_icon.png",
  sunday: "https://smiski.com/wp-content/uploads/2026/01/smiski.com_product_icon_sunday.png",
  hippers: "https://smiski.com/wp-content/uploads/2026/01/smiski.com_product_icon_hippers.png",
  moving: "https://smiski.com/wp-content/uploads/2024/09/smiski.com_product_icon.png",
  exercising: "https://smiski.com/wp-content/uploads/2024/01/Exercising_Series_icon.png",
  dressing: "https://smiski.com/wp-content/uploads/2023/05/dressing_series_icon.png",
  work: "https://smiski.com/wp-content/uploads/2022/11/smiski.com_product_iconatwork.png",
  museum: "https://smiski.com/wp-content/uploads/2022/11/smiski.com_product_iconmuseum.png",
  cheer: "https://smiski.com/wp-content/uploads/2022/11/smiski.com_product_iconcheer.png",
  yoga: "https://smiski.com/wp-content/uploads/2022/11/smiski.com_product_iconyoga.png",
  bed: "https://smiski.com/wp-content/uploads/2022/11/smiski.com_product_iconbed.png",
  living: "https://smiski.com/wp-content/uploads/2022/11/smiski.com_product_iconliving.png",
  bath: "https://smiski.com/wp-content/uploads/2023/09/smiski.com_product_iconbath.png",
  toilet: "https://smiski.com/wp-content/uploads/2023/06/smiski.com_product_icontoilet.png",
  "series-4": "https://smiski.com/wp-content/uploads/2022/11/smiski.com_product_icon04.png",
  "series-3": "https://smiski.com/wp-content/uploads/2022/11/smiski.com_product_icon03.png",
  "series-2": "https://smiski.com/wp-content/uploads/2022/11/smiski.com_product_icon02.png",
  "series-1": "https://smiski.com/wp-content/uploads/2022/12/smiski.com_product_icon01_v2.png",
  "hanging-christmas":
    "https://smiski.com/e/wp-content/uploads/2026/11/smiski_christmas_2026_icon.png",
  "strap-accessory-4":
    "https://smiski.com/e/wp-content/uploads/2026/10/smiski.com_product_icon_strap_series4.png",
  "strap-accessory-3":
    "https://smiski.com/e/wp-content/uploads/2026/06/smiski_strap03_icon.png",
  "touch-light-2":
    "https://smiski.com/wp-content/uploads/2026/01/smiski.com_product_icon_touchlight2.png",
  plush: "https://smiski.com/wp-content/uploads/2026/01/smiski.com_product_icon_plush.png",
  "strap-accessory-2":
    "https://smiski.com/wp-content/uploads/2026/01/smiski.com_product_icon_strap2.png",
  "cushion-pouch":
    "https://smiski.com/wp-content/uploads/2026/01/smiski.com_product_icon_cushionpouch.png",
  "embroidery-sticker-2":
    "https://smiski.com/wp-content/uploads/2026/01/smiski.com_product_icon_EM02.png",
  "plush-key-chain":
    "https://smiski.com/wp-content/uploads/2026/01/smiski.com_product_icon_plushkeychain.png",
  "zipperbite-2": "https://smiski.com/wp-content/uploads/2026/01/smiski.com_product_icon_ZB2.png",
  "embroidery-sticker":
    "https://smiski.com/wp-content/uploads/2026/01/smiski.com_product_icon_EM01.png",
  "strap-accessory-1":
    "https://smiski.com/wp-content/uploads/2025/08/smiski.com_product_icon_strap01.png",
  "touch-light":
    "https://smiski.com/wp-content/uploads/2025/08/smiski.com_product_icon_touchlight.png",
  zipperbite: "https://smiski.com/wp-content/uploads/2023/06/smiski.com_product_icon.png",
  rainbomb: "https://smiski.com/wp-content/uploads/2023/06/smiski.com_product_iconrainbomb.png",
  "bobbing-head":
    "https://smiski.com/wp-content/uploads/2023/06/smiski.com_product_iconbobbinghead.png",
  "bath-ball-2":
    "https://smiski.com/wp-content/uploads/2023/06/smiski.com_product_iconbathball2.png",
  "bath-ball": "https://smiski.com/wp-content/uploads/2023/06/smiski.com_product_iconbathball.png",
  "key-chain": "https://smiski.com/wp-content/uploads/2023/06/smiski.com_product_iconkeychain.png",
  "toothbrush-stand":
    "https://smiski.com/wp-content/uploads/2023/06/smiski.com_product_icontooth.png",
  "sensor-light": "https://smiski.com/wp-content/uploads/2023/06/smiski.com_product_iconlight.jpg",
};

async function download(url, dest) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 BlindBoxCloset/1.1" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 800) throw new Error(`too small ${buf.length} ${url}`);
  fs.writeFileSync(dest, buf);
  return buf.length;
}

const catalog = JSON.parse(fs.readFileSync(CAT, "utf8"));
const bySlug = new Map(catalog.series.map((s) => [s.slug, s]));
const ok = [];
const fail = [];
const missingInCatalog = [];

for (const [slug, url] of Object.entries(ICONS)) {
  const series = bySlug.get(slug);
  if (!series) {
    missingInCatalog.push(slug);
    continue;
  }
  const ext = path.extname(new URL(url).pathname) || ".png";
  const fname = `cover-smiski-${slug}${ext}`;
  const dest = path.join(MEDIA, fname);
  try {
    const bytes = await download(url, dest);
    series.cover_image_url = `${PUBLIC}/${fname}`;
    ok.push({ slug, fname, bytes, url });
    console.log("OK", slug, bytes, fname);
  } catch (e) {
    fail.push({ slug, url, error: e.message });
    console.error("FAIL", slug, e.message);
  }
}

const s1 = bySlug.get("series-1");
if (s1?.cover_image_url) {
  catalog.brand.hero_image_url = s1.cover_image_url;
  console.log("hero", catalog.brand.hero_image_url);
}

fs.writeFileSync(CAT, JSON.stringify(catalog, null, 2) + "\n");

const uncovered = catalog.series
  .filter((s) => !ICONS[s.slug])
  .map((s) => s.slug);

console.log(
  JSON.stringify(
    {
      applied: ok.length,
      failed: fail,
      missingInCatalog,
      uncoveredInCatalog: uncovered,
      reflectorCharm: "not in catalog — skipped",
    },
    null,
    2,
  ),
);
