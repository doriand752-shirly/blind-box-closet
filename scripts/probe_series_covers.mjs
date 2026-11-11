const pages = {
  "series-4": "https://smiski.com/e/products/series-4/",
  bath: "https://smiski.com/e/products/bath-series/",
  toilet: "https://smiski.com/e/products/toilet-series/",
  living: "https://smiski.com/e/products/living/",
  bed: "https://smiski.com/e/products/bed-series/",
  yoga: "https://smiski.com/e/products/yoga-series/",
  cheer: "https://smiski.com/e/products/cheerseries/",
  museum: "https://smiski.com/e/products/museumseries/",
  work: "https://smiski.com/e/products/work-series/",
  dressing: "https://smiski.com/e/products/dressing-series/",
  exercising: "https://smiski.com/e/products/exercising-series/",
  moving: "https://smiski.com/e/products/moving-series/",
  hippers: "https://smiski.com/e/products/hippers-series/",
  sunday: "https://smiski.com/e/products/sunday-series/",
  birthday: "https://smiski.com/e/products/birthday-series/",
  construction: "https://smiski.com/e/products/construction-series/",
};

for (const [slug, url] of Object.entries(pages)) {
  const html = await (await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } })).text();
  const urls = [...html.matchAll(/https?:\/\/[^"'\\\s>]+\.(?:png|jpe?g|webp)/gi)].map((m) => m[0]);
  const uniq = [...new Set(urls)].filter((u) => !/logo|favicon|icon_|sns|wp-includes|PRESS|ogp/i.test(u));
  const bottoms = uniq.filter((u) => /bottom|assort|mainvis|package|kv_|cover|banner/i.test(u));
  console.log("\n==", slug);
  console.log((bottoms.length ? bottoms : uniq).slice(0, 10).join("\n"));
}
