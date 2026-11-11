import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CAT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "server/data/smiski-catalog.json");
const catalog = JSON.parse(fs.readFileSync(CAT, "utf8"));

const ring = catalog.series.find((s) => s.slug === "ringcolle");
if (ring) {
  for (const f of ring.figures) {
    if (f.name_en === "Little ") f.name_en = "Little";
  }
  // second Peeking was Looking Back Ring slot
  const peekings = ring.figures.filter((f) => f.name_en === "Peeking" || f.name_en === "Peeking Ring");
  const barePeek = ring.figures.find((f) => f.name_en === "Peeking");
  if (barePeek) {
    barePeek.name_en = "Looking Back Ring";
    barePeek.image_source = null;
  }
  // normalize Ring suffix on known poses that have images
  for (const f of ring.figures) {
    if (f.name_en === "Relaxing") f.name_en = "Relaxing Ring";
    if (f.name_en === "Little") f.name_en = "Little Ring";
  }
}

const em = catalog.series.find((s) => s.slug === "embroidery-sticker-2");
if (em) {
  for (const f of em.figures) {
    if (f.name_en === "Peeking") f.name_en = "Peeking Sticker";
    if (f.name_en === "Little") f.name_en = "Little Sticker";
  }
  // two Pushing*: keep first Pushing as Pushing Sticker, demote second to Daydreaming Sticker without forcing overwrite if same file
  const pushings = em.figures.filter((f) => /pushing/i.test(f.name_en));
  if (pushings[0]) pushings[0].name_en = "Pushing Sticker";
  if (pushings[1] && pushings[1] !== pushings[0]) {
    pushings[1].name_en = "Daydreaming Sticker";
    // keep its image if present — it's still a pushing pose duplicate; clearer to drop
    pushings[1].image_source = null;
  }
}

const tl = catalog.series.find((s) => s.slug === "touch-light-2");
if (tl) {
  for (const f of tl.figures) {
    if (f.name_en === "Lounging Touch Light") f.name_en = "Lounging Light";
  }
}

fs.writeFileSync(CAT, JSON.stringify(catalog, null, 2) + "\n");
for (const slug of ["ringcolle", "embroidery-sticker-2", "touch-light-2", "zipperbite-2"]) {
  const s = catalog.series.find((x) => x.slug === slug);
  console.log("\n" + slug);
  for (const f of s.figures) console.log("-", f.name_en, f.image_source ? "OK" : "MISSING");
}
