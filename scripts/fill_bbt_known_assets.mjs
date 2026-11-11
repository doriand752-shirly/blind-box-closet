import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const CAT = path.join(ROOT, "server/data/smiski-catalog.json");
const MEDIA = path.join(ROOT, "server/media/figures");
const PUBLIC = "http://85.17.145.134:8787/media/figures";
const UA = "BlindBoxCloset/1.1";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function needs(f) {
  const u = f.image_source || "";
  return !u || /smiski-unknown|placeholder/i.test(u);
}
function norm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/&amp;/g, "and")
    .replace(/^smiski[\s_]*/i, "")
    .replace(/^little[\s_]*/i, "")
    .replace(/[^a-z0-9]+/g, "");
}
function stem(s) {
  return norm(s).replace(/(sticker|light|touchlight|ring|zipper)$/g, "");
}

const KNOWN = {
  "embroidery-sticker-2": [
    ["peeking", "https://www.blindboxtracker.com/assets/collections/smiskis/embroidery_sticker_vol2/smiski_peeking.webp"],
    ["pushing", "https://www.blindboxtracker.com/assets/collections/smiskis/embroidery_sticker_vol2/smiski_pushing.webp"],
    ["little", "https://www.blindboxtracker.com/assets/collections/smiskis/embroidery_sticker_vol2/smiski_little.webp"],
  ],
  "touch-light-2": [
    ["lounging", "https://www.blindboxtracker.com/assets/collections/smiskis/touch_light_vol2/smiski_lounging_touch_light.webp"],
  ],
  "zipperbite-2": [
    ["lotuspose", "https://www.blindboxtracker.com/assets/collections/smiskis/zipperbite_vol2/smiski_lotus_pose.webp"],
    ["fallingdown", "https://www.blindboxtracker.com/assets/collections/smiskis/zipperbite_vol2/smiski_falling_down.webp"],
  ],
};

// Also discover ringcolle from saved HTML if present
const ringHtmlPath = `${process.env.TEMP}/bbt-ring.html`;
if (fs.existsSync(ringHtmlPath)) {
  const h = fs.readFileSync(ringHtmlPath, "utf8");
  const pairs = [];
  const re =
    /src="(\/assets\/collections\/smiskis\/[^"]+)"\s+alt="([^"]*)"[\s\S]{0,400}?<h3>([^<]*)<\/h3>/gi;
  let m;
  while ((m = re.exec(h))) {
    pairs.push([stem(m[3] || m[2]), `https://www.blindboxtracker.com${m[1]}`]);
  }
  if (pairs.length) KNOWN.ringcolle = pairs;
}

async function download(url, dest) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return false;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 800) return false;
  fs.writeFileSync(dest, buf);
  return true;
}

const catalog = JSON.parse(fs.readFileSync(CAT, "utf8"));
let gained = 0;

for (const [slug, assets] of Object.entries(KNOWN)) {
  const series = catalog.series.find((s) => s.slug === slug);
  if (!series) continue;
  for (const [key, url] of assets) {
    const hit =
      series.figures.find((f) => needs(f) && stem(f.name_en) === key) ||
      series.figures.find((f) => needs(f) && (stem(f.name_en).includes(key) || key.includes(stem(f.name_en))));
    if (!hit) {
      console.log("no match", slug, key);
      continue;
    }
    const ext = path.extname(new URL(url).pathname) || ".webp";
    const fname = `smiski-${slug}-${norm(hit.name_en)}${ext}`;
    const dest = path.join(MEDIA, fname);
    if (await download(url, dest)) {
      hit.image_source = `${PUBLIC}/${fname}`;
      gained += 1;
      console.log("+", slug, hit.name_en, "<-", key);
    }
    await sleep(150);
  }
}

// Probe remaining with correct folder names
const PROBE = {
  "touch-light-2": "touch_light_vol2",
  "embroidery-sticker-2": "embroidery_sticker_vol2",
  "zipperbite-2": "zipperbite_vol2",
  ringcolle: "ringcolle",
};
const guessNames = (fig) => {
  const s = stem(fig.name_en);
  const n = norm(fig.name_en);
  return [
    `smiski_${s}`,
    s,
    `smiski_${n}`,
    n,
    `smiski_${s}_touch_light`,
    `little_smiski_${s}`,
  ];
};

for (const series of catalog.series) {
  const folder = PROBE[series.slug];
  if (!folder) continue;
  for (const fig of series.figures.filter(needs)) {
    for (const cand of guessNames(fig)) {
      let ok = false;
      for (const ext of [".webp", ".png", ".jpg"]) {
        const url = `https://www.blindboxtracker.com/assets/collections/smiskis/${folder}/${cand}${ext}`;
        try {
          const head = await fetch(url, { method: "HEAD", headers: { "User-Agent": UA } });
          if (!head.ok) continue;
          const fname = `smiski-${series.slug}-${norm(fig.name_en)}${ext}`;
          if (await download(url, path.join(MEDIA, fname))) {
            fig.image_source = `${PUBLIC}/${fname}`;
            gained += 1;
            console.log("probe+", series.slug, fig.name_en, cand);
            ok = true;
            break;
          }
        } catch {
          /* ignore */
        }
        await sleep(40);
      }
      if (ok) break;
    }
  }
}

fs.writeFileSync(CAT, JSON.stringify(catalog, null, 2) + "\n");
let still = 0;
const left = [];
for (const s of catalog.series) {
  for (const f of s.figures || []) {
    if (needs(f)) {
      still += 1;
      left.push(`${s.slug}:${f.name_en}`);
    }
  }
}
console.log(JSON.stringify({ gained, stillMissing: still, left }, null, 2));
