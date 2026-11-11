import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const MEDIA_SERIES = path.join(ROOT, "server", "media", "series");
const MEDIA_FIG = path.join(ROOT, "server", "media", "figures");
const PUBLIC_SERIES = "http://85.17.145.134:8787/media/series";
const PUBLIC_FIG = "http://85.17.145.134:8787/media/figures";

async function tryUrl(url) {
  try {
    const res = await fetch(url, { method: "HEAD", headers: { "User-Agent": "Mozilla/5.0" } });
    return res.ok;
  } catch {
    return false;
  }
}

async function download(url, dest) {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) return false;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1500) return false;
  fs.writeFileSync(dest, buf);
  return true;
}

async function fillCatalog(rel, brandKey) {
  const p = path.join(ROOT, rel);
  const cat = JSON.parse(fs.readFileSync(p, "utf8"));
  for (const series of cat.series) {
    if (series.cover_image_url && !String(series.cover_image_url).includes("smiski-unknown")) continue;

    // try exercising-specific
    if (series.slug === "exercising") {
      const candidates = [
        "https://smiski.com/e/wp-content/uploads/2023/07/exercising_top.png",
        "https://smiski.com/e/wp-content/uploads/2023/08/exercising_top.png",
        "https://smiski.com/e/wp-content/uploads/2023/09/exercising_top.png",
        "https://smiski.com/e/wp-content/uploads/2023/06/img_exercising_top.png",
      ];
      try {
        const html = await (
          await fetch("https://smiski.com/e/products/exercising-series/", {
            headers: { "User-Agent": "Mozilla/5.0" },
          })
        ).text();
        const urls = [...html.matchAll(/https?:\/\/[^"'\\\s>]+\.(?:png|jpe?g|webp)/gi)].map((m) => m[0]);
        candidates.unshift(
          ...urls.filter((u) => /exercis/i.test(u) && !/300x|icon/i.test(u)),
        );
      } catch {
        /* ignore */
      }
      for (const url of [...new Set(candidates)]) {
        const fname = `cover-smiski-exercising${path.extname(new URL(url).pathname) || ".png"}`;
        const dest = path.join(MEDIA_SERIES, fname);
        if (await download(url, dest)) {
          series.cover_image_url = `${PUBLIC_SERIES}/${fname}`;
          console.log("exercising", url);
          break;
        }
      }
      if (series.cover_image_url) continue;
    }

    const prefix = `${brandKey}-${series.slug}-`;
    const hit = fs
      .readdirSync(MEDIA_FIG)
      .find((f) => f.startsWith(prefix) && /\.(png|jpe?g|webp)$/i.test(f) && !/unknown/i.test(f));
    if (hit) {
      series.cover_image_url = `${PUBLIC_FIG}/${hit}`;
      console.log("fallback", brandKey, series.slug, hit);
      continue;
    }
    const fig = series.figures?.find(
      (f) => f.image_source && !String(f.image_source).includes("smiski-unknown"),
    );
    if (fig?.image_source) {
      series.cover_image_url = fig.image_source;
      console.log("source", brandKey, series.slug);
    }
  }

  if (!cat.brand.hero_image_url || String(cat.brand.hero_image_url).includes("smiski-unknown")) {
    const first = cat.series.find(
      (s) => s.cover_image_url && !String(s.cover_image_url).includes("smiski-unknown"),
    );
    if (first) cat.brand.hero_image_url = first.cover_image_url;
  }
  fs.writeFileSync(p, JSON.stringify(cat, null, 2) + "\n");
}

await fillCatalog("server/data/smiski-catalog.json", "smiski");
await fillCatalog("server/data/sonny-angel-catalog.json", "sonny");
await fillCatalog("server/data/labubu-catalog.json", "labubu");
console.log("fill done");
