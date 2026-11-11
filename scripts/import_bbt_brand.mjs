/**
 * Build a brand catalog (sonny-angel / labubu) from the crawled Blind Box Tracker cache
 * and download every figure image locally (matched by name — images come with the figure card).
 *
 * Usage: node scripts/import_bbt_brand.mjs sonny-angel|labubu
 * Requires: node scripts/bbt_crawl.mjs sonny_angels | pop_mart  (creates .cache/bbt/*.json)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const MEDIA = path.join(ROOT, "server/media/figures");
const PUBLIC = "http://85.17.145.134:8787/media/figures";
const BBT = "https://www.blindboxtracker.com";
const UA = "BlindBoxCloset/1.1 (data import)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CONFIGS = {
  "sonny-angel": {
    cache: "sonny_angels",
    catalog: "server/data/sonny-angel-catalog.json",
    stripPrefix: "sonny-angel-",
    prefix: "sonny",
    pick: () => true,
    form: (s) => (/hippers/i.test(s.title) ? "hippers" : s.bucket === "extras" ? "other" : "blind_box_mini"),
  },
  labubu: {
    cache: "pop_mart",
    catalog: "server/data/labubu-catalog.json",
    stripPrefix: "pop-mart-",
    prefix: "labubu",
    // The Monsters / Labubu line only (first 15 BBT series), not the other Pop Mart IPs.
    pick: (s, idx) => idx < 15,
    form: (s) => {
      if (/pin for love|hanging cards|large vinyl plush/i.test(s.title)) return s.title.match(/pin/i) ? "accessory" : "plush";
      return s.bucket === "extras" ? "other" : "blind_box_mini";
    },
  },
};

const slugify = (s) =>
  String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const niceTitle = (t) => t.replace(/(\d)(St|Nd|Rd|Th)\b/g, (_, d, s) => d + s.toLowerCase());

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

async function main() {
  const key = process.argv[2];
  const cfg = CONFIGS[key];
  if (!cfg) throw new Error("usage: import_bbt_brand.mjs sonny-angel|labubu");
  const cache = JSON.parse(
    fs.readFileSync(path.join(ROOT, ".cache/bbt", `${cfg.cache}.json`), "utf8"),
  );
  const catPath = path.join(ROOT, cfg.catalog);
  const old = JSON.parse(fs.readFileSync(catPath, "utf8"));
  fs.mkdirSync(MEDIA, { recursive: true });

  const keep = new Set();
  const series = [];
  let n = 0;
  let failed = 0;

  for (const [idx, s] of cache.series.entries()) {
    if (!cfg.pick(s, idx)) continue;
    const slug = s.slug.startsWith(cfg.stripPrefix) ? s.slug.slice(cfg.stripPrefix.length) : s.slug;
    const usedNames = new Map();
    const figures = [];
    for (const [fi, f] of s.figures.entries()) {
      let name = f.name.replace(/^Sonny Angel\s+/i, "").trim();
      const seen = usedNames.get(name) || 0;
      usedNames.set(name, seen + 1);
      if (seen) name = `${name} ${seen + 1}`;
      const ext = path.extname(f.image.split("?")[0]) || ".webp";
      const file = `${cfg.prefix}-${slug}-${slugify(name) || fi + 1}${ext}`.slice(0, 150);
      const ok = await download(BBT + f.image, path.join(MEDIA, file));
      if (!ok) failed++;
      if (ok) keep.add(file);
      figures.push({
        name_en: name,
        name_ja: null,
        is_secret: !!f.secret || /secret/i.test(name),
        is_limited: false,
        is_bonus: false,
        is_duo: false,
        sort_order: fi + 1,
        image_source: ok ? `${PUBLIC}/${file}` : null,
      });
      n++;
      await sleep(40);
    }
    const year = (s.title.match(/\b(20\d{2})\b/) || [])[1];
    series.push({
      slug,
      name_en: niceTitle(s.title),
      name_ja: null,
      product_form: cfg.form(s),
      sort_order: series.length + 1,
      release_year: year ? Number(year) : null,
      official_url: null,
      figures,
    });
    console.log(`${key}: ${s.title} (${figures.length})`);
  }

  const hero =
    series.flatMap((s) => s.figures).find((f) => f.image_source)?.image_source || null;
  const catalog = { brand: { ...old.brand, hero_image_url: hero }, series };
  fs.writeFileSync(catPath, JSON.stringify(catalog, null, 2) + "\n");

  // Remove previous (wrong) files of this brand that are no longer referenced.
  let removed = 0;
  for (const f of fs.readdirSync(MEDIA)) {
    if (f.startsWith(`${cfg.prefix}-`) && !keep.has(f)) {
      fs.unlinkSync(path.join(MEDIA, f));
      removed++;
    }
  }
  console.log(`done: ${series.length} series, ${n} figures, ${failed} failed downloads, ${removed} stale files removed`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
