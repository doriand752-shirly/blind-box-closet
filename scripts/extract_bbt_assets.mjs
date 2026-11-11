import fs from "node:fs";
for (const f of ["bbt-em2.html", "bbt-tl2.html", "bbt-zb2.html"]) {
  const p = `${process.env.TEMP}/${f}`;
  if (!fs.existsSync(p)) {
    console.log("missing", f);
    continue;
  }
  const h = fs.readFileSync(p, "utf8");
  const imgs = [...h.matchAll(/\/assets\/collections\/smiskis\/[^"'\\\s>]+/g)].map((m) => m[0]);
  console.log("\n==", f);
  console.log([...new Set(imgs)].join("\n") || "(none)");
  console.log("desc", (h.match(/page-description">([^<]+)/) || [])[1]);
}
