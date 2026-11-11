import fs from "node:fs";
const h = fs.readFileSync(`${process.env.TEMP}/bbt-smiski.html`, "utf8");
const links = [...h.matchAll(/href="(\/collections\/smiskis\/[^"#?]+\/)"/g)].map((m) => m[1]);
console.log([...new Set(links)].join("\n"));
