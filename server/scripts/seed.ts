import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { migrate, pool, query } from "../src/db";

type Figure = {
  name_en: string;
  name_ja?: string | null;
  is_secret?: boolean;
  is_limited?: boolean;
  is_bonus?: boolean;
  is_duo?: boolean;
  sort_order?: number;
  image_source?: string | null;
};

type Series = {
  slug: string;
  name_en: string;
  name_ja?: string | null;
  product_form?: string;
  sort_order?: number;
  release_year?: number | null;
  official_url?: string | null;
  figures: Figure[];
};

type Catalog = {
  brand: { slug: string; name: string; name_ja?: string | null };
  series: Series[];
};

async function main() {
  await migrate();
  const catalogPath = path.join(__dirname, "..", "data", "smiski-catalog.json");
  const catalog: Catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const publicBase = process.env.PUBLIC_BASE_URL || "http://127.0.0.1:8787";
  const placeholder = `${publicBase}/media/placeholder.svg`;

  const mediaRoot = process.env.MEDIA_ROOT || path.join(process.cwd(), "media");
  fs.mkdirSync(mediaRoot, { recursive: true });
  const placeholderSrc = path.join(__dirname, "..", "data", "placeholder.svg");
  if (fs.existsSync(placeholderSrc)) {
    fs.copyFileSync(placeholderSrc, path.join(mediaRoot, "placeholder.svg"));
  }

  const brandRes = await query<{ id: string }>(
    `INSERT INTO brands (slug, name, name_ja)
     VALUES ($1, $2, $3)
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, name_ja = EXCLUDED.name_ja
     RETURNING id`,
    [catalog.brand.slug, catalog.brand.name, catalog.brand.name_ja || null],
  );
  const brandId = brandRes.rows[0].id;

  let seriesCount = 0;
  let figureCount = 0;

  for (const s of catalog.series) {
    const seriesRes = await query<{ id: string }>(
      `INSERT INTO series (brand_id, slug, name_en, name_ja, product_form, sort_order, release_year, cover_image_url, official_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (brand_id, slug) DO UPDATE SET
         name_en = EXCLUDED.name_en,
         name_ja = EXCLUDED.name_ja,
         product_form = EXCLUDED.product_form,
         sort_order = EXCLUDED.sort_order,
         release_year = EXCLUDED.release_year,
         official_url = EXCLUDED.official_url
       RETURNING id`,
      [
        brandId,
        s.slug,
        s.name_en,
        s.name_ja || null,
        s.product_form || "blind_box_mini",
        s.sort_order ?? seriesCount + 1,
        s.release_year || null,
        placeholder,
        s.official_url || null,
      ],
    );
    const seriesId = seriesRes.rows[0].id;
    seriesCount += 1;

    // Replace figures for this series to keep seed idempotent for names
    const existing = await query<{ id: string; name_en: string }>(
      `SELECT id, name_en FROM figures WHERE series_id = $1`,
      [seriesId],
    );
    const byName = new Map(existing.rows.map((r) => [r.name_en, r.id]));

    for (const [idx, f] of s.figures.entries()) {
      const imageUrl = placeholder;
      if (byName.has(f.name_en)) {
        await query(
          `UPDATE figures SET
             name_ja = $2, is_secret = $3, is_limited = $4, is_bonus = $5, is_duo = $6,
             sort_order = $7, image_url = COALESCE(NULLIF(image_url, ''), $8)
           WHERE id = $1`,
          [
            byName.get(f.name_en),
            f.name_ja || null,
            !!f.is_secret,
            !!f.is_limited,
            !!f.is_bonus,
            !!f.is_duo,
            f.sort_order ?? idx + 1,
            imageUrl,
          ],
        );
      } else {
        await query(
          `INSERT INTO figures (series_id, name_en, name_ja, is_secret, is_limited, is_bonus, is_duo, image_url, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            seriesId,
            f.name_en,
            f.name_ja || null,
            !!f.is_secret,
            !!f.is_limited,
            !!f.is_bonus,
            !!f.is_duo,
            imageUrl,
            f.sort_order ?? idx + 1,
          ],
        );
      }
      figureCount += 1;
    }
  }

  console.log(`Seeded brand=${catalog.brand.slug} series=${seriesCount} figures=${figureCount}`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
