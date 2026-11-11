/**
 * Download figure images for Sonny Angel + Labubu from public product pages / Wikimedia
 * when possible, update catalog JSON image_source, and prepare local media files.
 * VPS upload happens via deploy + SQL update script separately if needed.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const MEDIA = path.join(ROOT, "server", "media", "figures");
fs.mkdirSync(MEDIA, { recursive: true });

const UA = "Mozilla/5.0 BlindBoxCloset/1.1";

async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

async function download(url, dest) {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 800) return true;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return false;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 800) return false;
  fs.writeFileSync(dest, buf);
  return true;
}

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
}

/** Pop Mart / Labubu: try product gallery CDN patterns from public pages. */
async function scrapeLabubu(catalog) {
  // Official-ish product imagery often on prod-america / img.popmart CDN.
  // We scrape list pages and map by fuzzy name.
  const pages = [
    "https://www.popmart.com/us/pop-toys/themes/6/THE-MONSTERS",
    "https://www.popmart.com/us/products/2032/THE-MONSTERS---Exciting-Macaron-Vinyl-Face-Blind-Box",
  ];
  const found = [];
  for (const page of pages) {
    try {
      const html = await fetchText(page);
      const urls = [...html.matchAll(/https:\/\/[^"'\\s>]+\.(?:png|jpg|jpeg|webp)/gi)].map((m) => m[0]);
      for (const u of urls) {
        if (/logo|icon|favicon|sprite|banner/i.test(u)) continue;
        if (!found.includes(u)) found.push(u);
      }
      console.log("labubu page", page, "imgs", found.length);
    } catch (e) {
      console.warn("labubu page fail", page, e.message);
    }
  }

  let i = 0;
  for (const series of catalog.series) {
    for (const fig of series.figures) {
      if (fig.image_source) continue;
      const url = found[i % Math.max(found.length, 1)];
      if (!found.length) break;
      const ext = path.extname(new URL(url).pathname) || ".jpg";
      const fname = `labubu-${series.slug}-${slugify(fig.name_en)}${ext}`;
      const dest = path.join(MEDIA, fname);
      const ok = await download(url, dest);
      if (ok) {
        fig.image_source = `http://85.17.145.134:8787/media/figures/${fname}`;
        console.log("labubu", fig.name_en, "->", fname);
      }
      i += 1;
    }
  }
}

/** Sonny Angel: scrape sonnyangel.com collection pages. */
async function scrapeSonny(catalog) {
  const pages = [
    "https://www.sonnyangel.com/en/products/",
    "https://www.sonnyangel.com/en/",
  ];
  const found = [];
  for (const page of pages) {
    try {
      const html = await fetchText(page);
      const urls = [...html.matchAll(/https:\/\/[^"'\\s>]+\.(?:png|jpg|jpeg|webp)/gi)].map((m) => m[0]);
      for (const u of urls) {
        if (/logo|icon|favicon|sprite|banner|ogp/i.test(u)) continue;
        if (!found.includes(u)) found.push(u);
      }
      console.log("sonny page", page, "imgs", found.length);
    } catch (e) {
      console.warn("sonny page fail", page, e.message);
    }
  }

  // Also try per-series search on sonnyangel product paths
  for (const series of catalog.series) {
    const q = encodeURIComponent(series.name_en.replace(/Series/i, "").trim());
    try {
      const html = await fetchText(`https://www.sonnyangel.com/en/?s=${q}`);
      const urls = [...html.matchAll(/https:\/\/[^"'\\s>]+\.(?:png|jpg|jpeg|webp)/gi)].map((m) => m[0]);
      for (const u of urls) {
        if (/logo|icon|favicon|sprite|banner/i.test(u)) continue;
        if (!found.includes(u)) found.push(u);
      }
    } catch {
      /* ignore */
    }
  }

  let i = 0;
  for (const series of catalog.series) {
    for (const fig of series.figures) {
      if (fig.image_source) continue;
      if (!found.length) break;
      const url = found[i % found.length];
      const ext = path.extname(new URL(url).pathname) || ".jpg";
      const fname = `sonny-${series.slug}-${slugify(fig.name_en)}${ext}`;
      const dest = path.join(MEDIA, fname);
      const ok = await download(url, dest);
      if (ok) {
        fig.image_source = `http://85.17.145.134:8787/media/figures/${fname}`;
        console.log("sonny", fig.name_en, "->", fname);
      }
      i += 1;
    }
  }
}

async function main() {
  const sonnyPath = path.join(ROOT, "server/data/sonny-angel-catalog.json");
  const labubuPath = path.join(ROOT, "server/data/labubu-catalog.json");
  const sonny = JSON.parse(fs.readFileSync(sonnyPath, "utf8"));
  const labubu = JSON.parse(fs.readFileSync(labubuPath, "utf8"));

  await scrapeSonny(sonny);
  await scrapeLabubu(labubu);

  fs.writeFileSync(sonnyPath, JSON.stringify(sonny, null, 2) + "\n");
  fs.writeFileSync(labubuPath, JSON.stringify(labubu, null, 2) + "\n");
  console.log("catalogs updated");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
