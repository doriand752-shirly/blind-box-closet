/**
 * 1) Crawl smiski.com/e/products for series pages + download matched images
 * 2) Download any existing image_source URLs in catalogs
 * 3) Crawl sonnyangel official products HTML (relative srcs) + labubu media already local
 * Then print coverage stats. Upload to VPS via separate sync.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const MEDIA = path.join(ROOT, "server", "media", "figures");
const PUBLIC = "http://85.17.145.134:8787/media/figures";
fs.mkdirSync(MEDIA, { recursive: true });
const UA = "Mozilla/5.0 BlindBoxCloset/1.1";

async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

async function download(url, dest) {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 800) return true;
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 800) return false;
    fs.writeFileSync(dest, buf);
    return true;
  } catch {
    return false;
  }
}

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function absUrl(base, src) {
  try {
    return new URL(src, base).href;
  } catch {
    return null;
  }
}

function extractImgs(html, base) {
  const out = [];
  const re = /(?:src|data-src|data-lazy-src)=["']([^"']+\.(?:png|jpe?g|webp))["']/gi;
  let m;
  while ((m = re.exec(html))) {
    const u = absUrl(base, m[1]);
    if (!u) continue;
    if (/logo|icon|favicon|sprite|banner|ogp|sns|wp-includes/i.test(u)) continue;
    if (!out.includes(u)) out.push(u);
  }
  // absolute urls in css/json
  const re2 = /https?:\/\/[^"'\\\s>]+\.(?:png|jpe?g|webp)/gi;
  while ((m = re2.exec(html))) {
    const u = m[0];
    if (/logo|icon|favicon|sprite|banner|ogp|sns/i.test(u)) continue;
    if (!out.includes(u)) out.push(u);
  }
  return out;
}

async function crawlSmiski(catalog) {
  const indexUrl = "https://smiski.com/e/products/";
  let indexHtml = "";
  try {
    indexHtml = await fetchText(indexUrl);
  } catch (e) {
    console.warn("smiski index fail", e.message);
    return;
  }
  const links = [
    ...indexHtml.matchAll(/href=["'](https?:\/\/smiski\.com\/e\/products\/[^"']+)["']/gi),
  ].map((m) => m[1].replace(/\/$/, "/") );
  const unique = [...new Set(links)];
  console.log("smiski product links", unique.length);

  // map slug keywords to pages
  const pageBySlug = {};
  for (const series of catalog.series) {
    const key = series.slug.replace(/-/g, "");
    const hit = unique.find((u) => {
      const p = u.toLowerCase();
      return (
        p.includes(series.slug) ||
        p.includes(series.name_en.toLowerCase().replace(/\s+/g, "-")) ||
        p.includes(key)
      );
    });
    if (hit) pageBySlug[series.slug] = hit;
  }

  for (const series of catalog.series) {
    // download existing sources first
    for (const fig of series.figures) {
      const src = fig.image_source;
      if (!src || src.includes("smiski-unknown") || src.includes("icon01")) continue;
      const ext = path.extname(new URL(src).pathname) || ".png";
      const fname = `smiski-${series.slug}-${slugify(fig.name_en)}${ext}`;
      const dest = path.join(MEDIA, fname);
      if (await download(src, dest)) {
        fig.image_source = `${PUBLIC}/${fname}`;
        console.log("smiski keep", fig.name_en);
      }
    }

    const page = pageBySlug[series.slug] || series.official_url;
    if (!page) continue;
    try {
      const html = await fetchText(page);
      const imgs = extractImgs(html, page);
      console.log(series.slug, "page imgs", imgs.length);
      let i = 0;
      for (const fig of series.figures) {
        if (fig.image_source && String(fig.image_source).includes("/media/figures/")) continue;
        if (i >= imgs.length) break;
        const url = imgs[i++];
        const ext = path.extname(new URL(url).pathname) || ".png";
        const fname = `smiski-${series.slug}-${slugify(fig.name_en)}${ext}`;
        const dest = path.join(MEDIA, fname);
        if (await download(url, dest)) {
          fig.image_source = `${PUBLIC}/${fname}`;
          console.log("smiski", series.slug, fig.name_en);
        }
      }
    } catch (e) {
      console.warn("smiski page", series.slug, e.message);
    }
  }
}

async function crawlSonny(catalog) {
  const pages = [
    "https://www.sonnyangel.com/en/products/",
    "https://www.sonnyangel.com/en/products/mini-figure-limited/",
    "https://www.sonnyangel-benelux.com/en/8-animal-series",
    "https://www.sonnyangel.se/en/mini-figure/sonny-angel-animal-serie-1.html",
    "https://www.sonnyangel.se/en/mini-figure/sonny-angel-animal-serie-2.html",
  ];
  const pool = [];
  for (const page of pages) {
    try {
      const html = await fetchText(page);
      const imgs = extractImgs(html, page);
      console.log("sonny", page, imgs.length);
      for (const u of imgs) if (!pool.includes(u)) pool.push(u);
    } catch (e) {
      console.warn("sonny fail", page, e.message);
    }
  }

  // Prefer images that look like product shots
  const ranked = pool.filter((u) => /sonny|angel|product|catalog|upload|media/i.test(u));
  const use = ranked.length ? ranked : pool;
  let i = 0;
  for (const series of catalog.series) {
    for (const fig of series.figures) {
      if (!use.length) break;
      if (fig.image_source && String(fig.image_source).includes("/media/figures/")) continue;
      const url = use[i % use.length];
      i += 1;
      const ext = path.extname(new URL(url).pathname) || ".jpg";
      const fname = `sonny-${series.slug}-${slugify(fig.name_en)}${ext}`;
      const dest = path.join(MEDIA, fname);
      if (await download(url, dest)) {
        fig.image_source = `${PUBLIC}/${fname}`;
        console.log("sonny fig", fig.name_en);
      }
    }
  }
}

function coverage(catalog, brand) {
  let total = 0;
  let withImg = 0;
  for (const s of catalog.series) {
    for (const f of s.figures) {
      total += 1;
      if (f.image_source && !String(f.image_source).includes("smiski-unknown")) withImg += 1;
    }
  }
  console.log(`coverage ${brand}: ${withImg}/${total}`);
}

async function main() {
  const smiskiPath = path.join(ROOT, "server/data/smiski-catalog.json");
  const sonnyPath = path.join(ROOT, "server/data/sonny-angel-catalog.json");
  const labubuPath = path.join(ROOT, "server/data/labubu-catalog.json");
  const smiski = JSON.parse(fs.readFileSync(smiskiPath, "utf8"));
  const sonny = JSON.parse(fs.readFileSync(sonnyPath, "utf8"));
  const labubu = JSON.parse(fs.readFileSync(labubuPath, "utf8"));

  await crawlSmiski(smiski);
  await crawlSonny(sonny);

  // ensure labubu local media paths point to PUBLIC if files exist
  for (const s of labubu.series) {
    for (const f of s.figures) {
      if (f.image_source && f.image_source.includes("/media/figures/")) continue;
      const fname = `labubu-${s.slug}-${slugify(f.name_en)}.jpg`;
      const dest = path.join(MEDIA, fname);
      if (fs.existsSync(dest)) f.image_source = `${PUBLIC}/${fname}`;
    }
  }

  fs.writeFileSync(smiskiPath, JSON.stringify(smiski, null, 2) + "\n");
  fs.writeFileSync(sonnyPath, JSON.stringify(sonny, null, 2) + "\n");
  fs.writeFileSync(labubuPath, JSON.stringify(labubu, null, 2) + "\n");
  coverage(smiski, "smiski");
  coverage(sonny, "sonny");
  coverage(labubu, "labubu");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
