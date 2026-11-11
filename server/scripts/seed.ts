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
  brand: {
    slug: string;
    name: string;
    name_ja?: string | null;
    accent_color?: string | null;
    hero_image_url?: string | null;
    status?: string;
  };
  series: Series[];
};

type ComingSoonFile = {
  brands: Array<{
    slug: string;
    name: string;
    name_ja?: string | null;
    accent_color?: string | null;
    status?: string;
  }>;
};

const DATA_DIR = path.join(__dirname, "..", "data");
const CATALOG_FILES = [
  "smiski-catalog.json",
  "sonny-angel-catalog.json",
  "labubu-catalog.json",
];

async function seedCatalog(catalog: Catalog, fallbackUrl: string) {
  const brandRes = await query<{ id: string }>(
    `INSERT INTO brands (slug, name, name_ja, accent_color, hero_image_url, status)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (slug) DO UPDATE SET
       name = EXCLUDED.name,
       name_ja = EXCLUDED.name_ja,
       accent_color = COALESCE(EXCLUDED.accent_color, brands.accent_color),
       hero_image_url = COALESCE(EXCLUDED.hero_image_url, brands.hero_image_url),
       status = EXCLUDED.status
     RETURNING id`,
    [
      catalog.brand.slug,
      catalog.brand.name,
      catalog.brand.name_ja || null,
      catalog.brand.accent_color || null,
      catalog.brand.hero_image_url || null,
      catalog.brand.status || "live",
    ],
  );
  const brandId = brandRes.rows[0].id;

  let seriesCount = 0;
  let figureCount = 0;

  for (const s of catalog.series) {
    const cover =
      s.figures.find((f) => f.image_source)?.image_source || fallbackUrl;

    const seriesRes = await query<{ id: string }>(
      `INSERT INTO series (brand_id, slug, name_en, name_ja, product_form, sort_order, release_year, cover_image_url, official_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (brand_id, slug) DO UPDATE SET
         name_en = EXCLUDED.name_en,
         name_ja = EXCLUDED.name_ja,
         product_form = EXCLUDED.product_form,
         sort_order = EXCLUDED.sort_order,
         release_year = EXCLUDED.release_year,
         cover_image_url = EXCLUDED.cover_image_url,
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
        cover,
        s.official_url || null,
      ],
    );
    const seriesId = seriesRes.rows[0].id;
    seriesCount += 1;

    const existing = await query<{ id: string; name_en: string }>(
      `SELECT id, name_en FROM figures WHERE series_id = $1`,
      [seriesId],
    );
    const byName = new Map(existing.rows.map((r) => [r.name_en, r.id]));

    for (const [idx, f] of s.figures.entries()) {
      const imageUrl = f.image_source || fallbackUrl;
      if (byName.has(f.name_en)) {
        await query(
          `UPDATE figures SET
             name_ja = $2, is_secret = $3, is_limited = $4, is_bonus = $5, is_duo = $6,
             sort_order = $7,
             image_url = CASE
               WHEN image_url IS NULL OR image_url = '' OR image_url LIKE '%placeholder.svg%'
                 OR image_url LIKE '%smiski-unknown%'
               THEN $8 ELSE image_url END
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

  console.log(
    `Seeded brand=${catalog.brand.slug} series=${seriesCount} figures=${figureCount}`,
  );
}

async function seedComingSoon() {
  const comingPath = path.join(DATA_DIR, "coming-soon-brands.json");
  if (!fs.existsSync(comingPath)) return;
  const data: ComingSoonFile = JSON.parse(fs.readFileSync(comingPath, "utf8"));
  for (const b of data.brands) {
    await query(
      `INSERT INTO brands (slug, name, name_ja, accent_color, hero_image_url, status)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (slug) DO UPDATE SET
         name = EXCLUDED.name,
         name_ja = EXCLUDED.name_ja,
         accent_color = COALESCE(EXCLUDED.accent_color, brands.accent_color),
         hero_image_url = NULL,
         status = EXCLUDED.status`,
      [
        b.slug,
        b.name,
        b.name_ja || null,
        b.accent_color || null,
        null,
        b.status || "coming_soon",
      ],
    );
    console.log(`Seeded coming-soon brand=${b.slug}`);
  }
}

async function main() {
  await migrate();
  const publicBase = process.env.PUBLIC_BASE_URL || "http://127.0.0.1:8787";
  const fallbackUrl = `${publicBase}/media/smiski-unknown.jpg`;

  const mediaRoot = process.env.MEDIA_ROOT || path.join(process.cwd(), "media");
  fs.mkdirSync(mediaRoot, { recursive: true });
  const unknownSrc = path.join(DATA_DIR, "smiski-unknown.jpg");
  if (fs.existsSync(unknownSrc)) {
    fs.copyFileSync(unknownSrc, path.join(mediaRoot, "smiski-unknown.jpg"));
  }

  for (const file of CATALOG_FILES) {
    const catalogPath = path.join(DATA_DIR, file);
    if (!fs.existsSync(catalogPath)) {
      console.warn(`Skip missing catalog: ${file}`);
      continue;
    }
    const catalog: Catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
    await seedCatalog(catalog, fallbackUrl);
  }

  await seedComingSoon();
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
