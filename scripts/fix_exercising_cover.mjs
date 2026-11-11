import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const MEDIA = path.join(ROOT, "server", "media", "series");
const PUBLIC = "http://85.17.145.134:8787/media/series";
const page = "https://smiski.com/e/products/exercising-series/";
const html = await (await fetch(page, { headers: { "User-Agent": "Mozilla/5.0" } })).text();
const urls = [...html.matchAll(/https?:\/\/[^"'\\\s>]+\.(?:png|jpe?g|webp)/gi)].map((m) => m[0]);
const hits = urls.filter((u) => /exercis/i.test(u) && !/300x|150x|icon/i.test(u));
console.log(hits.slice(0, 15).join("\n"));
for (const url of hits) {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) continue;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1500) continue;
  const ext = path.extname(new URL(url).pathname) || ".png";
  const fname = `cover-smiski-exercising${ext}`;
  fs.writeFileSync(path.join(MEDIA, fname), buf);
  const catPath = path.join(ROOT, "server/data/smiski-catalog.json");
  const cat = JSON.parse(fs.readFileSync(catPath, "utf8"));
  const s = cat.series.find((x) => x.slug === "exercising");
  if (s) s.cover_image_url = `${PUBLIC}/${fname}`;
  fs.writeFileSync(catPath, JSON.stringify(cat, null, 2) + "\n");
  console.log("saved", url);
  break;
}
