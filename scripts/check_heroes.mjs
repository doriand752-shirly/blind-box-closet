const j = await (await fetch("http://85.17.145.134:8787/brands")).json();
const brands = j.brands || j || [];
for (const b of brands) console.log(b.slug, b.hero_image_url || b.status);
const c = await (
  await fetch("http://85.17.145.134:8787/brands/smiski/checklist?scope=main")
).json();
console.log(
  "series covers sample",
  (c.series || []).slice(0, 6).map((s) => [s.slug, (s.cover_image_url || "").split("/").pop()]),
);
