/**
 * Align mismatched Smiski extras names with Blind Box Tracker + attach available images.
 * Only renames figures that currently have no image_source.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const CAT = path.join(ROOT, "server/data/smiski-catalog.json");
const MEDIA = path.join(ROOT, "server/media/figures");
const PUBLIC = "http://85.17.145.134:8787/media/figures";
const UA = "BlindBoxCloset/1.1";
fs.mkdirSync(MEDIA, { recursive: true });

function needs(f) {
  return !(f.image_source || "").trim() || /smiski-unknown/i.test(f.image_source || "");
}
function norm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

async function download(url, dest) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return false;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 800) return false;
  fs.writeFileSync(dest, buf);
  return true;
}

async function fetchPageFigures(url) {
  const html = await (await fetch(url, { headers: { "User-Agent": UA } })).text();
  const out = [];
  const re =
    /src="(\/assets\/collections\/smiskis\/[^"]+)"\s+alt="([^"]*)"[\s\S]{0,500}?<h3>([^<]*)<\/h3>/gi;
  let m;
  while ((m = re.exec(html))) {
    out.push({
      src: `https://www.blindboxtracker.com${m[1]}`,
      name: m[3].replace(/&amp;/g, "&").trim(),
    });
  }
  return out;
}

const ALIGN = {
  "zipperbite-2": "https://www.blindboxtracker.com/collections/smiskis/smiski-zipperbite-vol-2/",
  "touch-light-2": "https://www.blindboxtracker.com/collections/smiskis/smiski-touch-light-vol-2/",
  "embroidery-sticker-2":
    "https://www.blindboxtracker.com/collections/smiskis/smiski-embroidery-sticker-vol-2/",
  ringcolle: "https://www.blindboxtracker.com/collections/smiskis/smiski-ringcolle/",
};

const catalog = JSON.parse(fs.readFileSync(CAT, "utf8"));
let renamed = 0;
let gained = 0;

for (const [slug, page] of Object.entries(ALIGN)) {
  const series = catalog.series.find((s) => s.slug === slug);
  if (!series) continue;
  const bbt = await fetchPageFigures(page);
  console.log(slug, "bbt", bbt.map((b) => b.name).join(" | "));
  const missing = series.figures.filter(needs);
  // Prefer exact rename targets when catalog clearly wrong
  for (const bf of bbt) {
    const clean = bf.name.replace(/^Smiski\s+/i, "").replace(/^Little\s+Smiski\s*/i, "Little ");
    // already have this name with image?
    const existing = series.figures.find((f) => norm(f.name_en) === norm(clean));
    if (existing && !needs(existing)) continue;
    let target = existing && needs(existing) ? existing : null;
    if (!target) {
      // pick next missing slot that doesn't collide with a BBT name we're about to set
      target = missing.find(
        (f) =>
          needs(f) &&
          !bbt.some((b) => norm(b.name.replace(/^Smiski\s+/i, "")) === norm(f.name_en)),
      );
    }
    if (!target) {
      console.log("  no slot for", clean);
      continue;
    }
    if (target.name_en !== clean) {
      console.log("  rename", target.name_en, "->", clean);
      target.name_en = clean;
      renamed += 1;
    }
    const fname = `smiski-${slug}-${norm(clean)}${path.extname(new URL(bf.src).pathname) || ".webp"}`;
    const dest = path.join(MEDIA, fname);
    if (await download(bf.src, dest)) {
      target.image_source = `${PUBLIC}/${fname}`;
      gained += 1;
      console.log("  image", clean);
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
console.log(JSON.stringify({ renamed, gained, stillMissing: still, left }, null, 2));
