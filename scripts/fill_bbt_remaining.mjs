/**
 * Second pass: fuzzy name match + BBT asset folder probing for remaining gaps.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const CAT = path.join(ROOT, "server/data/smiski-catalog.json");
const MEDIA = path.join(ROOT, "server/media/figures");
const PUBLIC = "http://85.17.145.134:8787/media/figures";
const UA = "BlindBoxCloset/1.1";
const BASE = "https://www.blindboxtracker.com/assets/collections/smiskis";
fs.mkdirSync(MEDIA, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const FOLDERS = {
  "touch-light-2": ["touch_light_vol_2", "touch_light_2", "touchlight2"],
  "embroidery-sticker-2": [
    "embroidery_sticker_vol_2",
    "embroidery_sticker_2",
    "embroidery2",
  ],
  "zipperbite-2": ["zipperbite_vol_2", "zipperbite_2", "zipperbite2"],
  ringcolle: ["ringcolle", "ringcolle_smiski_ring", "ring"],
  living: ["living"],
};

function needs(f) {
  const u = f.image_source || "";
  return !u || /smiski-unknown|placeholder/i.test(u);
}
function norm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/&amp;/g, "and")
    .replace(/^smiski\s+/i, "")
    .replace(/^little\s+/i, "little")
    .replace(/[^a-z0-9]+/g, "");
}
function stems(name) {
  const n = norm(name);
  const out = new Set([n]);
  for (const suf of [
    "sticker",
    "light",
    "touchlight",
    "ring",
    "zipper",
    "keychain",
    "plush",
  ]) {
    if (n.endsWith(suf)) out.add(n.slice(0, -suf.length));
  }
  // catalog "kneelinglight" <-> bbt "kneeling"
  out.add(n.replace(/(sticker|light|ring|touchlight)$/g, ""));
  return [...out].filter(Boolean);
}

async function tryUrl(url) {
  try {
    const res = await fetch(url, { method: "HEAD", headers: { "User-Agent": UA } });
    return res.ok;
  } catch {
    return false;
  }
}

async function download(url, dest) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return false;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 800) return false;
  fs.writeFileSync(dest, buf);
  return true;
}

function nameCandidates(fig) {
  const base = stems(fig.name_en);
  const extras = [];
  for (const b of base) {
    extras.push(b, `smiski${b}`, `little${b}`, `littlesmiski${b}`);
  }
  // Pulling Zipper -> pullingzipper, pulling_a_zipper style stripped already
  return [...new Set([...base, ...extras])];
}

const catalog = JSON.parse(fs.readFileSync(CAT, "utf8"));
let gained = 0;

// Pass A: re-fetch series pages with fuzzy match
const PAGES = {
  "touch-light-2": "https://www.blindboxtracker.com/collections/smiskis/smiski-touch-light-vol-2/",
  "embroidery-sticker-2":
    "https://www.blindboxtracker.com/collections/smiskis/smiski-embroidery-sticker-vol-2/",
  "zipperbite-2": "https://www.blindboxtracker.com/collections/smiskis/smiski-zipperbite-vol-2/",
  ringcolle: "https://www.blindboxtracker.com/collections/smiskis/smiski-ringcolle/",
};

for (const [slug, page] of Object.entries(PAGES)) {
  const series = catalog.series.find((s) => s.slug === slug);
  if (!series) continue;
  const html = await (await fetch(page, { headers: { "User-Agent": UA } })).text();
  await sleep(350);
  const figs = [];
  const re =
    /<img\s+src="(\/assets\/collections\/smiskis\/[^"]+)"\s+alt="([^"]*)"[\s\S]{0,500}?<h3>([^<]*)<\/h3>/gi;
  let m;
  while ((m = re.exec(html))) {
    figs.push({ src: m[1], alt: m[2], name: m[3].trim() });
  }
  console.log(slug, "bbt figs", figs.length, figs.map((f) => f.name).join(", "));
  for (const bf of figs) {
    const keys = new Set([...stems(bf.name), ...stems(bf.alt)]);
    const hit = series.figures.find(
      (f) => needs(f) && stems(f.name_en).some((s) => keys.has(s) || [...keys].some((k) => s.includes(k) || k.includes(s))),
    );
    if (!hit) continue;
    const fname = `smiski-${slug}-${norm(hit.name_en)}${path.extname(bf.src) || ".webp"}`;
    const dest = path.join(MEDIA, fname);
    if (await download(`https://www.blindboxtracker.com${bf.src}`, dest)) {
      hit.image_source = `${PUBLIC}/${fname}`;
      gained += 1;
      console.log("fuzzy+", hit.name_en);
    }
    await sleep(120);
  }
}

// Pass B: probe asset folders for still-missing
for (const series of catalog.series) {
  const missing = (series.figures || []).filter(needs);
  if (!missing.length) continue;
  const folders = FOLDERS[series.slug] || [
    series.slug.replace(/-/g, "_"),
    series.slug,
  ];
  for (const fig of missing) {
    let done = false;
    for (const folder of folders) {
      for (const cand of nameCandidates(fig)) {
        for (const ext of [".webp", ".png", ".jpg"]) {
          const url = `${BASE}/${folder}/${cand}${ext}`;
          if (!(await tryUrl(url))) continue;
          await sleep(80);
          const fname = `smiski-${series.slug}-${norm(fig.name_en)}${ext}`;
          const dest = path.join(MEDIA, fname);
          if (await download(url, dest)) {
            fig.image_source = `${PUBLIC}/${fname}`;
            gained += 1;
            console.log("probe+", series.slug, fig.name_en, url);
            done = true;
            break;
          }
        }
        if (done) break;
      }
      if (done) break;
    }
    await sleep(60);
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
console.log(JSON.stringify({ gainedPass2: gained, stillMissing: still, left }, null, 2));
