import assert from "node:assert/strict";
import {
  filterByBucket,
  isMainForm,
  seriesBucket,
  seriesCategoryLabel,
} from "./productForm";

assert.equal(seriesBucket("blind_box_mini"), "main");
assert.equal(seriesBucket("hippers"), "main");
assert.equal(seriesBucket("hanging"), "main");
assert.equal(seriesBucket("strap"), "extras");
assert.equal(seriesBucket("accessory"), "extras");
assert.equal(seriesBucket(undefined), "main");
assert.equal(isMainForm("light"), false);
assert.equal(seriesCategoryLabel("bath_ball"), "Bath Ball");

const items = [
  { product_form: "blind_box_mini", id: 1 },
  { product_form: "strap", id: 2 },
  { product_form: "hippers", id: 3 },
];
assert.deepEqual(
  filterByBucket(items, "main").map((i) => i.id),
  [1, 3],
);
assert.deepEqual(
  filterByBucket(items, "extras").map((i) => i.id),
  [2],
);

function sortBrandsByFavorites<T extends { slug: string }>(
  brands: T[],
  favorites: string[],
): T[] {
  const favIndex = new Map(favorites.map((s, i) => [s, i]));
  return [...brands].sort((a, b) => {
    const ai = favIndex.has(a.slug) ? favIndex.get(a.slug)! : 999;
    const bi = favIndex.has(b.slug) ? favIndex.get(b.slug)! : 999;
    if (ai !== bi) return ai - bi;
    return a.slug.localeCompare(b.slug);
  });
}

const brands = [{ slug: "labubu" }, { slug: "smiski" }, { slug: "sonny-angel" }];
assert.deepEqual(
  sortBrandsByFavorites(brands, ["sonny-angel", "smiski"]).map((b) => b.slug),
  ["sonny-angel", "smiski", "labubu"],
);

console.log("productForm tests passed");
