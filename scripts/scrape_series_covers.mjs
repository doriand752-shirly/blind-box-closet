/**
 * Prefer series-level cover art (bottom_*.png / banner / box) for Smiski,
 * then set Sonny/Labubu brand heroes from first good series cover.
 * Downloads to server/media/series and updates catalog JSON cover fields.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const MEDIA = path.join(ROOT, "server", "media", "series");
const PUBLIC = "http://85.17.145.134:8787/media/series";
fs.mkdirSync(MEDIA, { recursive: true });
const UA = "Mozilla/5.0 BlindBoxCloset/1.1";

const SMISKI_PAGES = {
  "series-1": "https://smiski.com/e/products/series-1/",
  "series-2": "https://smiski.com/e/products/series-2/",
  "series-3": "https://smiski.com/e/products/series-3/",
  "series-4": "https://smiski.com/e/products/series-4/",
  bath: "https://smiski.com/e/products/bath-series/",
  toilet: "https://smiski.com/e/products/toilet-series/",
  living: "https://smiski.com/e/products/living/",
  bed: "https://smiski.com/e/products/bed-series/",
  yoga: "https://smiski.com/e/products/yoga-series/",
  cheer: "https://smiski.com/e/products/cheerseries/",
  museum: "https://smiski.com/e/products/museumseries/",
  work: "https://smiski.com/e/products/work-series/",
  dressing: "https://smiski.com/e/products/dressing-series/",
  exercising: "https://smiski.com/e/products/exercising-series/",
  moving: "https://smiski.com/e/products/moving-series/",
  hippers: "https://smiski.com/e/products/hippers-series/",
  sunday: "https://smiski.com/e/products/sunday-series/",
  birthday: "https://smiski.com/e/products/birthday-series/",
  construction: "https://smiski.com/e/products/construction-series/",
  "hanging-christmas": "https://smiski.com/e/products/smiski-hangingfigure-christmas/",
};

const KNOWN_BOTTOM = {
  "series-1": "https://smiski.com/e/wp-content/uploads/2016/03/bottom_s1.png",
  "series-2": "https://smiski.com/e/wp-content/uploads/2016/03/bottom_s2.png",
  "series-3": "https://smiski.com/e/wp-content/uploads/2016/03/bottom_s3.png",
  "series-4": "https://smiski.com/e/wp-content/uploads/2016/03/bottom_s4.png",
};

async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

async function download(url, dest) {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 1500) return true;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return false;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1500) return false;
  fs.writeFileSync(dest, buf);
  return true;
}

function extractCoverCandidates(html, base) {
  const urls = [];
  const re = /https?:\/\/[^"'\\\s>]+\.(?:png|jpe?g|webp)/gi;
  let m;
  while ((m = re.exec(html))) {
    const u = m[0];
    if (/logo|icon|favicon|sprite|banner-ad|ogp|sns|wp-includes/i.test(u)) continue;
    urls.push(u);
  }
  const rel = /(?:src|data-src)=["']([^"']+\.(?:png|jpe?g|webp))["']/gi;
  while ((m = rel.exec(html))) {
    try {
      urls.push(new URL(m[1], base).href);
    } catch {
      /* ignore */
    }
  }
  const unique = [...new Set(urls)];
  const score = (u) => {
    const s = u.toLowerCase();
    let n = 0;
    if (/bottom[_-]?s?\d*/.test(s)) n += 100;
    if (/bottom/.test(s)) n += 80;
    if (/series|assort|box|cover|main|hero|kv|package/.test(s)) n += 40;
    if (/s[1-4]_|series-?[1-4]/.test(s)) n += 20;
    if (/secret|icon01/.test(s)) n -= 50;
    return n;
  };
  return unique.sort((a, b) => score(b) - score(a));
}

async function setSmiskiCovers(catalog) {
  let ok = 0;
  for (const series of catalog.series) {
    const candidates = [];
    if (KNOWN_BOTTOM[series.slug]) candidates.push(KNOWN_BOTTOM[series.slug]);
    const page = SMISKI_PAGES[series.slug] || series.official_url;
    if (page) {
      try {
        const html = await fetchText(page);
        candidates.push(...extractCoverCandidates(html, page));
      } catch (e) {
        console.warn("page fail", series.slug, e.message);
      }
    }
    let set = false;
    for (const url of candidates) {
      const ext = path.extname(new URL(url).pathname) || ".png";
      const fname = `cover-smiski-${series.slug}${ext}`;
      const dest = path.join(MEDIA, fname);
      if (await download(url, dest)) {
        series.cover_image_url = `${PUBLIC}/${fname}`;
        console.log("cover", series.slug, "<-", fname, url.slice(0, 80));
        ok += 1;
        set = true;
        break;
      }
    }
    if (!set) console.warn("no cover", series.slug);
  }
  // brand hero = series-1 cover preferred
  const s1 = catalog.series.find((s) => s.slug === "series-1");
  if (s1?.cover_image_url) catalog.brand.hero_image_url = s1.cover_image_url;
  console.log("smiski covers set", ok);
}

function setOtherBrandCovers(catalog, brandKey) {
  const figuresDir = path.join(ROOT, "server", "media", "figures");
  for (const series of catalog.series) {
    if (series.cover_image_url && !String(series.cover_image_url).includes("smiski-unknown")) {
      continue;
    }
    // prefer first figure media file for that series
    const prefix = `${brandKey}-${series.slug}-`;
    const hit = fs
      .readdirSync(figuresDir)
      .find((f) => f.startsWith(prefix) && /\.(png|jpe?g|webp)$/i.test(f));
    if (hit) {
      series.cover_image_url = `http://85.17.145.134:8787/media/figures/${hit}`;
      console.log("cover", brandKey, series.slug, "<-", hit);
    } else if (series.figures?.[0]?.image_source) {
      series.cover_image_url = series.figures[0].image_source;
    }
  }
  const first = catalog.series.find((s) => s.cover_image_url);
  if (first?.cover_image_url) catalog.brand.hero_image_url = first.cover_image_url;
}

async function main() {
  const smiskiPath = path.join(ROOT, "server/data/smiski-catalog.json");
  const sonnyPath = path.join(ROOT, "server/data/sonny-angel-catalog.json");
  const labubuPath = path.join(ROOT, "server/data/labubu-catalog.json");
  const smiski = JSON.parse(fs.readFileSync(smiskiPath, "utf8"));
  const sonny = JSON.parse(fs.readFileSync(sonnyPath, "utf8"));
  const labubu = JSON.parse(fs.readFileSync(labubuPath, "utf8"));

  await setSmiskiCovers(smiski);
  setOtherBrandCovers(sonny, "sonny");
  setOtherBrandCovers(labubu, "labubu");

  fs.writeFileSync(smiskiPath, JSON.stringify(smiski, null, 2) + "\n");
  fs.writeFileSync(sonnyPath, JSON.stringify(sonny, null, 2) + "\n");
  fs.writeFileSync(labubuPath, JSON.stringify(labubu, null, 2) + "\n");
  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
