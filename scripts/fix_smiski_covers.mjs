/**
 * Curated Smiski series covers — avoid shared sidebar bottoms bleeding across pages.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const MEDIA = path.join(ROOT, "server", "media", "series");
const PUBLIC = "http://85.17.145.134:8787/media/series";
fs.mkdirSync(MEDIA, { recursive: true });

const COVERS = {
  "series-1": "https://smiski.com/e/wp-content/uploads/2016/03/bottom_s1.png",
  "series-2": "https://smiski.com/e/wp-content/uploads/2016/03/bottom_s2-1.png",
  "series-3": "https://smiski.com/e/wp-content/uploads/2017/02/bottom_s3.png",
  // Series 4 page shares bottoms; use first series figure group art from uploads if known
  "series-4": "https://smiski.com/e/wp-content/uploads/2016/03/bottom_s3-1.png",
  bath: "https://smiski.com/e/wp-content/uploads/2017/10/bath_bottom.png",
  toilet: "https://smiski.com/e/wp-content/uploads/2017/10/toilet_bottom.png",
  living: "https://smiski.com/e/wp-content/uploads/2018/08/living_bottom.png",
  bed: "https://smiski.com/e/wp-content/uploads/2019/07/banner_bed_specialpage-1.png",
  yoga: "https://smiski.com/e/wp-content/uploads/2019/09/smiski-yoga-banner_e-s.png",
  cheer: "https://smiski.com/e/wp-content/uploads/2020/07/cheer_bottom.png",
  museum: "https://smiski.com/e/wp-content/uploads/2020/12/smiski-museum-banner-s.png",
  work: "https://smiski.com/e/wp-content/uploads/2021/09/work_bottom.png",
  dressing: "https://smiski.com/e/wp-content/uploads/2022/07/dressing_bottom.png",
  exercising: "https://smiski.com/e/wp-content/uploads/2023/03/exercising_bottom.png",
  moving: "https://smiski.com/e/wp-content/uploads/2023/09/moving_bottom.png",
  hippers: "https://smiski.com/e/wp-content/uploads/2024/09/smiski_hippers_banner02.jpg",
  sunday: "https://smiski.com/e/wp-content/uploads/2025/03/sunday_bottom.png",
  birthday: "https://smiski.com/e/wp-content/uploads/2025/07/birthday_bottom.png",
  construction: "https://smiski.com/e/wp-content/uploads/2025/10/construction_bottom.png",
  "hanging-christmas":
    "https://smiski.com/e/wp-content/uploads/2026/11/smiski_261028_PRESS_01-1024x640.jpg",
};

const ALT = {
  living: [
    "https://smiski.com/e/wp-content/uploads/2018/07/living_bottom.png",
    "https://smiski.com/e/wp-content/uploads/2018/09/living_bottom.png",
    "https://smiski.com/e/wp-content/uploads/2018/08/smiski_living_bottom.png",
  ],
  cheer: [
    "https://smiski.com/e/wp-content/uploads/2020/06/cheer_bottom.png",
    "https://smiski.com/e/wp-content/uploads/2020/08/cheer_bottom.png",
    "https://smiski.com/e/wp-content/uploads/2020/12/smiski-cheer-banner-s.png",
  ],
  work: [
    "https://smiski.com/e/wp-content/uploads/2021/08/work_bottom.png",
    "https://smiski.com/e/wp-content/uploads/2021/10/work_bottom.png",
    "https://smiski.com/e/wp-content/uploads/2021/09/smiski_work_bottom.png",
  ],
  dressing: [
    "https://smiski.com/e/wp-content/uploads/2022/06/dressing_bottom.png",
    "https://smiski.com/e/wp-content/uploads/2022/08/dressing_bottom.png",
  ],
  exercising: [
    "https://smiski.com/e/wp-content/uploads/2023/02/exercising_bottom.png",
    "https://smiski.com/e/wp-content/uploads/2023/04/exercising_bottom.png",
  ],
  moving: [
    "https://smiski.com/e/wp-content/uploads/2023/08/moving_bottom.png",
    "https://smiski.com/e/wp-content/uploads/2023/10/moving_bottom.png",
  ],
  sunday: [
    "https://smiski.com/e/wp-content/uploads/2025/02/sunday_bottom.png",
    "https://smiski.com/e/wp-content/uploads/2025/04/sunday_bottom.png",
    "https://smiski.com/e/wp-content/uploads/2025/03/smiski_sunday_banner.jpg",
  ],
  birthday: [
    "https://smiski.com/e/wp-content/uploads/2025/06/birthday_bottom.png",
    "https://smiski.com/e/wp-content/uploads/2025/08/birthday_bottom.png",
  ],
  construction: [
    "https://smiski.com/e/wp-content/uploads/2025/09/construction_bottom.png",
    "https://smiski.com/e/wp-content/uploads/2025/11/construction_bottom.png",
    "https://smiski.com/e/wp-content/uploads/2025/10/smiski_construction_banner.jpg",
  ],
  "series-4": [
    "https://smiski.com/e/wp-content/uploads/2017/03/bottom_s4.png",
    "https://smiski.com/e/wp-content/uploads/2017/04/bottom_s4.png",
    "https://smiski.com/e/wp-content/uploads/2016/12/bottom_s4.png",
  ],
};

async function tryDownload(url, dest) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 BlindBoxCloset" } });
    if (!res.ok) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1500) return false;
    fs.writeFileSync(dest, buf);
    return true;
  } catch {
    return false;
  }
}

async function pickCover(slug) {
  const list = [COVERS[slug], ...(ALT[slug] || [])].filter(Boolean);
  // also try page-local banner matching slug keyword
  const pageMap = {
    living: "https://smiski.com/e/products/living/",
    cheer: "https://smiski.com/e/products/cheerseries/",
    work: "https://smiski.com/e/products/work-series/",
    dressing: "https://smiski.com/e/products/dressing-series/",
    exercising: "https://smiski.com/e/products/exercising-series/",
    moving: "https://smiski.com/e/products/moving-series/",
    sunday: "https://smiski.com/e/products/sunday-series/",
    birthday: "https://smiski.com/e/products/birthday-series/",
    construction: "https://smiski.com/e/products/construction-series/",
    "series-4": "https://smiski.com/e/products/series-4/",
  };
  if (pageMap[slug]) {
    try {
      const html = await (await fetch(pageMap[slug], { headers: { "User-Agent": "Mozilla/5.0" } })).text();
      const urls = [...html.matchAll(/https?:\/\/[^"'\\\s>]+\.(?:png|jpe?g|webp)/gi)].map((m) => m[0]);
      const key = slug.replace(/-/g, "[-_]?");
      const keyed = urls.filter((u) => new RegExp(key, "i").test(u) && !/300x|150x|thumb|icon/i.test(u));
      const banners = urls.filter((u) => /banner|bottom|assort|main/i.test(u) && new RegExp(key, "i").test(u));
      list.push(...banners, ...keyed);
    } catch {
      /* ignore */
    }
  }
  for (const url of [...new Set(list)]) {
    const ext = path.extname(new URL(url).pathname) || ".png";
    const fname = `cover-smiski-${slug}${ext}`;
    const dest = path.join(MEDIA, fname);
    // force re-download to replace wrong bath_bottom copies
    if (fs.existsSync(dest)) fs.unlinkSync(dest);
    if (await tryDownload(url, dest)) return { fname, url };
  }
  return null;
}

async function main() {
  const catPath = path.join(ROOT, "server/data/smiski-catalog.json");
  const catalog = JSON.parse(fs.readFileSync(catPath, "utf8"));
  let ok = 0;
  for (const series of catalog.series) {
    const hit = await pickCover(series.slug);
    if (hit) {
      series.cover_image_url = `${PUBLIC}/${hit.fname}`;
      console.log("OK", series.slug, hit.url);
      ok += 1;
    } else {
      // keep previous if any, but never leave shared wrong bath if file was bath for non-bath
      console.warn("MISS", series.slug);
    }
  }
  const s1 = catalog.series.find((s) => s.slug === "series-1");
  if (s1?.cover_image_url) catalog.brand.hero_image_url = s1.cover_image_url;
  fs.writeFileSync(catPath, JSON.stringify(catalog, null, 2) + "\n");
  console.log("fixed", ok);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
