/**
 * Crawl a Blind Box Tracker collection (data source only) into .cache/bbt/<collection>.json
 * Usage: node scripts/bbt_crawl.mjs <collection> [slug]
 *   e.g. node scripts/bbt_crawl.mjs sonny_angels
 *        node scripts/bbt_crawl.mjs pop_mart
 * Respectful: sequential requests with a short delay.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, ".cache", "bbt");
const BASE = "https://www.blindboxtracker.com";
const UA = "BlindBoxCloset/1.1 (data import)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const decode = (s) =>
  String(s || "")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

async function get(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (res.ok) return await res.text();
      if (res.status === 404) return null;
    } catch {
      /* retry */
    }
    await sleep(800 * (i + 1));
  }
  return null;
}

export function parseSeriesPage(html) {
  const title = decode((html.match(/<h1>([^<]+)<\/h1>/) || [])[1]);
  const description = decode((html.match(/page-description">([^<]*)/) || [])[1]);
  const color = (html.match(/--series-color:(#[0-9A-Fa-f]{3,8})/) || [])[1] || null;
  const figures = [];
  const re =
    /<article class="figure-card ([^"]*)"[^>]*>[\s\S]*?data-figure-title="([^"]*)"[\s\S]*?data-figure-secret="(true|false)"[\s\S]*?<img src="([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) {
    figures.push({
      name: decode(m[2]),
      secret: m[3] === "true" || /secret/i.test(m[1]),
      image: decode(m[4]),
    });
  }
  return { title, description, color, figures };
}

async function main() {
  const collection = process.argv[2];
  if (!collection) throw new Error("collection required");
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const index = await get(`${BASE}/collections/${collection}/`);
  if (!index) throw new Error("index not found");
  const hrefs = [
    ...new Set(
      [...index.matchAll(new RegExp(`href="(/collections/${collection}/[^"?#]+/)"`, "g"))].map(
        (m) => m[1],
      ),
    ),
  ];
  console.log(collection, "series pages:", hrefs.length);
  const linksOf = (html) =>
    new Set(
      [...(html || "").matchAll(new RegExp(`href="(/collections/${collection}/[^"?#]+/)"`, "g"))].map(
        (m) => m[1],
      ),
    );
  const extrasHtml = await get(`${BASE}/collections/${collection}/?bucket=extras`);
  const extrasSet = linksOf(extrasHtml);
  const mainSet = linksOf(await get(`${BASE}/collections/${collection}/?bucket=main`));
  const series = [];
  for (const href of hrefs) {
    const html = await get(BASE + href);
    await sleep(250);
    if (!html) {
      console.log("  skip", href);
      continue;
    }
    const p = parseSeriesPage(html);
    const bucket = extrasSet.has(href) && !mainSet.has(href) ? "extras" : "main";
    series.push({ href, slug: href.split("/").filter(Boolean).pop(), bucket, ...p });
    console.log(`  ${p.title} (${p.figures.length})`);
  }
  fs.writeFileSync(
    path.join(OUT_DIR, `${collection}.json`),
    JSON.stringify({ collection, crawled_at: new Date().toISOString(), series }, null, 1),
  );
  console.log("saved", series.length, "series,", series.reduce((n, s) => n + s.figures.length, 0), "figures");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
