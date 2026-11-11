/**
 * Rebuild Smiski figure lists + images from the Blind Box Tracker cache (data source only).
 * Figure names and images come together from the same figure card, so images always match names.
 * Series metadata (names, product_form, official cover icons) stays as in smiski-catalog.json.
 * Series that BBT does not list (e.g. hanging-christmas) are left untouched.
 *
 * Usage: node scripts/bbt_crawl.mjs smiskis && node scripts/import_bbt_smiski.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const CAT = path.join(ROOT, "server/data/smiski-catalog.json");
const MEDIA = path.join(ROOT, "server/media/figures");
const PUBLIC = "http://85.17.145.134:8787/media/figures";
const BBT = "https://www.blindboxtracker.com";
const UA = "BlindBoxCloset/1.1 (data import)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const BBT_TO_SLUG = {
  "smiski-series-1": "series-1",
  "smiski-series-2": "series-2",
  "smiski-series-3": "series-3",
  "smiski-series-4": "series-4",
  "smiski-series-toilet": "toilet",
  "smiski-series-bath": "bath",
  "smiski-series-living": "living",
  "smiski-series-bed": "bed",
  "smiski-series-yoga": "yoga",
  "smiski-series-cheer": "cheer",
  "smiski-series-museum": "museum",
  "smiski-series-work": "work",
  "smiski-series-dressing": "dressing",
  "smiski-series-exercising": "exercising",
  "smiski-series-moving": "moving",
  "smiski-series-hippers": "hippers",
  "smiski-series-sunday": "sunday",
  "smiski-series-birthday": "birthday",
  "smiski-series-construction": "construction",
  "smiski-series-strap-accessory-series-one": "strap-accessory-1",
  "smiski-series-strap-accessory-series-two": "strap-accessory-2",
  "smiski-series-strap-accessory-series-three": "strap-accessory-3",
  "smiski-series-strap-accessory-series-four": "strap-accessory-4",
  "smiski-touch-light-vol-2": "touch-light-2",
  "smiski-plush": "plush",
  "smiski-cushion-pouch": "cushion-pouch",
  "smiski-embroidery-sticker-vol-2": "embroidery-sticker-2",
  "smiski-plush-key-chain": "plush-key-chain",
  "smiski-zipperbite-vol-2": "zipperbite-2",
  "smiski-embroidery-sticker": "embroidery-sticker",
  "smiski-touch-light": "touch-light",
  "smiski-zipperbite": "zipperbite",
  "smiski-rainbomb": "rainbomb",
  "smiski-bobbing-head": "bobbing-head",
  "smiski-ringcolle": "ringcolle",
  "smiski-bath-ball-2": "bath-ball-2",
  "smiski-bath-ball": "bath-ball",
  "smiski-key-chain": "key-chain",
  "smiski-toothbrush-stand": "toothbrush-stand",
  "smiski-sensor-light": "sensor-light",
};

const slugify = (s) =>
  String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

async function download(url, dest) {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 800) return true;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > 800) {
          fs.writeFileSync(dest, buf);
          return true;
        }
      }
    } catch {
      /* retry */
    }
    await sleep(600 * (i + 1));
  }
  return false;
}

function cleanName(raw) {
  let n = raw
    .replace(/^smiski\s+/i, "")
    .replace(/\s+smiski$/i, "")
    .replace(/\s+touch light$/i, " Light")
    .trim();
  if (/^secret$/i.test(n)) n = "Secret";
  return n.replace(/Vela’zquez/, "Velázquez").replace(/Fuzin&Raijin/, "Fuzin & Raijin");
}

async function main() {
  const cache = JSON.parse(fs.readFileSync(path.join(ROOT, ".cache/bbt/smiskis.json"), "utf8"));
  const catalog = JSON.parse(fs.readFileSync(CAT, "utf8"));
  const bySlug = new Map(catalog.series.map((s) => [s.slug, s]));
  fs.mkdirSync(MEDIA, { recursive: true });

  const used = new Set();
  let total = 0;
  let failed = 0;
  for (const b of cache.series) {
    const slug = BBT_TO_SLUG[b.slug];
    const s = slug && bySlug.get(slug);
    if (!s) {
      console.log("skip (no mapping)", b.slug);
      continue;
    }
    const names = new Map();
    const figures = [];
    for (const [i, f] of b.figures.entries()) {
      let name = cleanName(f.name);
      const seen = names.get(name) || 0;
      names.set(name, seen + 1);
      if (seen) name += ` ${seen + 1}`;
      const ext = path.extname(f.image.split("?")[0]) || ".webp";
      const file = `smiski-${slug}-${slugify(name)}${ext}`;
      const ok = await download(BBT + f.image, path.join(MEDIA, file));
      if (!ok) failed++;
      else used.add(file);
      figures.push({
        name_en: name,
        name_ja: null,
        is_secret: !!f.secret,
        is_limited: false,
        is_bonus: false,
        is_duo: false,
        sort_order: i + 1,
        image_source: ok ? `${PUBLIC}/${file}` : null,
      });
      total++;
      await sleep(30);
    }
    s.figures = figures;
    console.log(`${slug}: ${figures.length} figures`);
  }
  fs.writeFileSync(CAT, JSON.stringify(catalog, null, 2) + "\n");
  console.log(`done: ${total} figures, ${failed} failed`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
