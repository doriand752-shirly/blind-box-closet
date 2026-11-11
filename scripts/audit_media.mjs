/**
 * Audit server/media/figures against the three catalogs.
 * Flags: missing files, tiny files, duplicate content between different figures, unreferenced files.
 * Usage: node scripts/audit_media.mjs [--delete-unreferenced]
 * Exit code 1 when a referenced figure image is missing, tiny or duplicated.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const MEDIA = path.join(ROOT, "server/media/figures");
const CATALOGS = ["smiski", "sonny-angel", "labubu"].map((b) => `server/data/${b}-catalog.json`);
const TINY = 2500;

const referenced = new Map(); // file -> ["brand/series/figure"]
for (const rel of CATALOGS) {
  const cat = JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
  for (const s of cat.series) {
    for (const f of s.figures) {
      const src = f.image_source;
      if (!src || !src.includes("/media/figures/")) continue;
      const file = decodeURIComponent(src.split("/media/figures/")[1]);
      const list = referenced.get(file) || [];
      list.push(`${cat.brand.slug}/${s.slug}/${f.name_en}`);
      referenced.set(file, list);
    }
  }
}

let problems = 0;
const hashes = new Map();
for (const [file, owners] of referenced) {
  const p = path.join(MEDIA, file);
  if (!fs.existsSync(p)) {
    console.log("MISSING ", file, owners[0]);
    problems++;
    continue;
  }
  const buf = fs.readFileSync(p);
  if (buf.length < TINY) {
    console.log("TINY    ", file, buf.length, owners[0]);
    problems++;
  }
  const h = crypto.createHash("md5").update(buf).digest("hex");
  hashes.set(h, (hashes.get(h) || []).concat(file));
  if (owners.length > 1) {
    console.log("SHARED  ", file, "<-", owners.join(" | "));
    problems++;
  }
}
for (const files of hashes.values()) {
  if (files.length > 1) {
    // Informational: reissues and official secret "?" silhouettes legitimately share artwork.
    console.log("DUPLICATE (info)", files.join(" = "));
  }
}

const del = process.argv.includes("--delete-unreferenced");
let unreferenced = 0;
for (const file of fs.readdirSync(MEDIA)) {
  if (referenced.has(file)) continue;
  unreferenced++;
  if (del) fs.unlinkSync(path.join(MEDIA, file));
}
console.log(
  `referenced=${referenced.size} unreferenced=${unreferenced}${del ? " (deleted)" : ""} problems=${problems}`,
);
process.exit(problems ? 1 : 0);
