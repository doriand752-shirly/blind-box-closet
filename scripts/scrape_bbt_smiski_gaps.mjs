/**
 * Fill missing Smiski figure images from Blind Box Tracker series pages.
 * Does NOT overwrite series cover icons. Respectful delays + BlindBoxCloset UA.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const CAT = path.join(ROOT, "server/data/smiski-catalog.json");
const MEDIA = path.join(ROOT, "server/media/figures");
const PUBLIC = "http://85.17.145.134:8787/media/figures";
const UA = "BlindBoxCloset/1.1 (+https://github.com/doriand752-shirly/blind-box-closet)";
const INDEX = "https://www.blindboxtracker.com/collections/smiskis/";
fs.mkdirSync(MEDIA, { recursive: true });

const PATH_TO_SLUG = {
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
  "smiski-hanging-figure-christmas": "hanging-christmas",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function norm(name) {
  return String(name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^smiski\s+/i, "")
    .replace(/[^a-z0-9]+/g, "");
}

function needsImage(fig) {
  const u = fig.image_source || fig.image_url || "";
  return !u || /smiski-unknown|placeholder/i.test(u);
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

async function download(url, dest) {
  const abs = url.startsWith("http") ? url : `https://www.blindboxtracker.com${url}`;
  const res = await fetch(abs, { headers: { "User-Agent": UA } });
  if (!res.ok) return false;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 800) return false;
  fs.writeFileSync(dest, buf);
  return true;
}

function parseSeriesLinks(html) {
  const links = [...html.matchAll(/href="(\/collections\/smiskis\/[^"#?]+\/)"/g)].map((m) => m[1]);
  return [...new Set(links)].filter((l) => l !== "/collections/smiskis/");
}

function parseFigures(html) {
  const out = [];
  const re =
    /<article class="figure-card[^"]*"[^>]*>[\s\S]*?<img\s+src="([^"]+)"\s+alt="([^"]*)"[\s\S]*?<h3>([^<]*)<\/h3>/gi;
  let m;
  while ((m = re.exec(html))) {
    out.push({
      src: m[1],
      alt: m[2],
      name: m[3].trim(),
      secret: /secret-figure/i.test(m[0]) || /^secret$/i.test(m[3].trim()),
    });
  }
  // fallback looser
  if (!out.length) {
    const loose =
      /src="(\/assets\/collections\/smiskis\/[^"]+)"\s+alt="([^"]*)"[\s\S]{0,400}?<h3>([^<]*)<\/h3>/gi;
    while ((m = loose.exec(html))) {
      out.push({
        src: m[1],
        alt: m[2],
        name: m[3].trim(),
        secret: /^secret$/i.test(m[3].trim()),
      });
    }
  }
  return out;
}

function matchFigure(seriesFigs, bbtFig) {
  const n = norm(bbtFig.name);
  const alt = norm(bbtFig.alt);
  if (bbtFig.secret || n === "secret") {
    return seriesFigs.find((f) => f.is_secret && needsImage(f));
  }
  let hit =
    seriesFigs.find((f) => needsImage(f) && (norm(f.name_en) === n || norm(f.name_en) === alt)) ||
    seriesFigs.find(
      (f) =>
        needsImage(f) &&
        (norm(f.name_en).includes(n) ||
          n.includes(norm(f.name_en)) ||
          norm(f.name_en).includes(alt) ||
          alt.includes(norm(f.name_en))),
    );
  return hit || null;
}

function fileSlug(seriesSlug, name) {
  return `smiski-${seriesSlug}-${norm(name) || "figure"}`.slice(0, 80);
}

const catalog = JSON.parse(fs.readFileSync(CAT, "utf8"));
const bySlug = new Map(catalog.series.map((s) => [s.slug, s]));

console.log("fetch index…");
const indexHtml = await fetchText(INDEX);
await sleep(400);
const seriesLinks = parseSeriesLinks(indexHtml);
console.log("series pages", seriesLinks.length);

let gained = 0;
const unmatchedNames = [];
const nameDiffs = [];

for (const link of seriesLinks) {
  const key = link.replace(/\/$/, "").split("/").pop();
  const slug = PATH_TO_SLUG[key];
  if (!slug) {
    console.warn("unmapped BBT series", key);
    continue;
  }
  const series = bySlug.get(slug);
  if (!series) {
    console.warn("catalog missing", slug);
    continue;
  }

  const url = `https://www.blindboxtracker.com${link}`;
  let html;
  try {
    html = await fetchText(url);
  } catch (e) {
    console.warn("page fail", slug, e.message);
    await sleep(600);
    continue;
  }
  await sleep(350);

  const bbtFigs = parseFigures(html);
  const catalogNames = new Set((series.figures || []).map((f) => norm(f.name_en)));
  for (const bf of bbtFigs) {
    if (bf.secret) continue;
    const nn = norm(bf.name);
    if (nn && !catalogNames.has(nn) && ![...catalogNames].some((c) => c.includes(nn) || nn.includes(c))) {
      nameDiffs.push({ series: slug, bbt: bf.name });
    }
  }

  const missingBefore = (series.figures || []).filter(needsImage).length;
  if (!missingBefore) {
    console.log("skip complete", slug);
    continue;
  }

  console.log("fill", slug, "missing", missingBefore, "bbt", bbtFigs.length);
  for (const bf of bbtFigs) {
    const fig = matchFigure(series.figures || [], bf);
    if (!fig) {
      unmatchedNames.push({ series: slug, bbt: bf.name });
      continue;
    }
    const base = fileSlug(slug, fig.name_en || bf.name);
    const ext = path.extname(bf.src.split("?")[0]) || ".webp";
    const fname = `${base}${ext}`;
    const dest = path.join(MEDIA, fname);
    const ok = await download(bf.src, dest);
    await sleep(120);
    if (!ok) {
      console.warn("dl fail", bf.src);
      continue;
    }
    fig.image_source = `${PUBLIC}/${fname}`;
    gained += 1;
    console.log(" +", fig.name_en, "<-", fname);
  }
}

fs.writeFileSync(CAT, JSON.stringify(catalog, null, 2) + "\n");

let stillMissing = 0;
for (const s of catalog.series) {
  for (const f of s.figures || []) if (needsImage(f)) stillMissing += 1;
}

console.log(
  JSON.stringify(
    {
      gainedFromBbt: gained,
      stillMissing,
      nameDiffSample: nameDiffs.slice(0, 20),
      unmatchedSample: unmatchedNames.slice(0, 20),
    },
    null,
    2,
  ),
);
