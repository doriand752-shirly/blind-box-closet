import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { migrate, query } from "./db";
import { requireAdmin, requireUser } from "./auth";

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";
const MEDIA_ROOT = process.env.MEDIA_ROOT || path.join(process.cwd(), "media");
const PUBLIC_BASE =
  process.env.PUBLIC_BASE_URL || `http://127.0.0.1:${PORT}`;

fs.mkdirSync(path.join(MEDIA_ROOT, "figures"), { recursive: true });
fs.mkdirSync(path.join(MEDIA_ROOT, "series"), { recursive: true });
fs.mkdirSync(path.join(MEDIA_ROOT, "brands"), { recursive: true });

const app = Fastify({ logger: true, bodyLimit: 12 * 1024 * 1024 });

function mediaUrl(rel: string) {
  return `${PUBLIC_BASE}/media/${rel.replace(/^\/+/, "")}`;
}

async function main() {
  await migrate();
  await app.register(cors, { origin: true });
  await app.register(multipart, {
    limits: { fileSize: 10 * 1024 * 1024 },
  });
  await app.register(fastifyStatic, {
    root: MEDIA_ROOT,
    prefix: "/media/",
    decorateReply: false,
  });

  app.get("/health", async () => ({ ok: true, service: "blind-box-closet" }));

  // Account creation disabled for App Store review: collection is on-device only.
  app.post("/auth/apple", async (_request, reply) =>
    reply.code(410).send({ error: "Account creation disabled" }),
  );
  app.post("/auth/register", async (_request, reply) =>
    reply.code(410).send({ error: "Account creation disabled" }),
  );
  app.post("/auth/login", async (_request, reply) =>
    reply.code(410).send({ error: "Account creation disabled" }),
  );

  app.get("/me", async (request, reply) => {
    try {
      const user = await requireUser(request);
      return { user };
    } catch (e: any) {
      return reply.code(e.statusCode || 401).send({ error: e.message });
    }
  });

  app.delete("/me", async (_request, reply) =>
    reply.code(410).send({ error: "Account deletion disabled" }),
  );

  app.get("/catalog/brands", async () => {
    const result = await query(
      `SELECT b.*,
        (SELECT COUNT(*)::int FROM series s WHERE s.brand_id = b.id) AS series_count,
        (SELECT COUNT(*)::int FROM figures f
          JOIN series s ON s.id = f.series_id WHERE s.brand_id = b.id) AS figure_count,
        (SELECT COUNT(*)::int FROM figures f
          JOIN series s ON s.id = f.series_id
          WHERE s.brand_id = b.id
            AND s.product_form IN ('blind_box_mini','hippers','hanging')) AS main_figure_count
       FROM brands b
       ORDER BY
         CASE WHEN b.status = 'live' THEN 0 ELSE 1 END,
         b.name ASC`,
    );
    return { brands: result.rows };
  });

  app.get<{
    Params: { slug: string };
    Querystring: { bucket?: string };
  }>("/catalog/brands/:slug/checklist", async (request, reply) => {
    try {
      const { slug } = request.params;
      const bucket = (request.query.bucket || "all").toLowerCase();
      const brandRes = await query(`SELECT * FROM brands WHERE slug = $1`, [slug]);
      if (!brandRes.rows[0]) return reply.code(404).send({ error: "Brand not found" });

      const params: unknown[] = [slug];
      let formFilter = "";
      if (bucket === "main") {
        formFilter = ` AND s.product_form IN ('blind_box_mini','hippers','hanging')`;
      } else if (bucket === "extras") {
        formFilter = ` AND s.product_form NOT IN ('blind_box_mini','hippers','hanging')`;
      }

      const seriesRes = await query(
        `SELECT s.*, b.slug AS brand_slug, b.name AS brand_name,
           (SELECT COUNT(*)::int FROM figures f WHERE f.series_id = s.id) AS figure_count
         FROM series s
         JOIN brands b ON b.id = s.brand_id
         WHERE b.slug = $1 ${formFilter}
         ORDER BY s.sort_order ASC, s.name_en ASC`,
        params,
      );

      const figuresRes = await query(
        `SELECT f.*, s.id AS series_id, s.slug AS series_slug, s.name_en AS series_name,
                b.slug AS brand_slug, b.name AS brand_name
         FROM figures f
         JOIN series s ON s.id = f.series_id
         JOIN brands b ON b.id = s.brand_id
         WHERE b.slug = $1 ${formFilter}
         ORDER BY s.sort_order ASC, f.sort_order ASC, f.name_en ASC`,
        params,
      );

      return {
        brand: brandRes.rows[0],
        series: seriesRes.rows,
        figures: figuresRes.rows,
      };
    } catch (e: any) {
      request.log.error(e);
      return reply.code(500).send({ error: e.message || "Server error" });
    }
  });

  app.get<{
    Querystring: { brandId?: string; brandSlug?: string };
  }>("/catalog/series", async (request) => {
    const { brandId, brandSlug } = request.query;
    const params: unknown[] = [];
    let where = "WHERE 1=1";
    if (brandId) {
      params.push(brandId);
      where += ` AND s.brand_id = $${params.length}`;
    }
    if (brandSlug) {
      params.push(brandSlug);
      where += ` AND b.slug = $${params.length}`;
    }
    const result = await query(
      `SELECT s.*, b.slug AS brand_slug, b.name AS brand_name,
        (SELECT COUNT(*)::int FROM figures f WHERE f.series_id = s.id) AS figure_count,
        (SELECT COUNT(*)::int FROM figures f WHERE f.series_id = s.id AND f.is_secret) AS secret_count
       FROM series s
       JOIN brands b ON b.id = s.brand_id
       ${where}
       ORDER BY s.sort_order ASC, s.name_en ASC`,
      params,
    );
    return { series: result.rows };
  });

  app.get<{
    Params: { id: string };
  }>("/catalog/series/:id", async (request, reply) => {
    try {
      const id = request.params.id;
      const seriesRes = await query(
        `SELECT s.*, b.slug AS brand_slug, b.name AS brand_name
         FROM series s JOIN brands b ON b.id = s.brand_id
         WHERE s.id::text = $1 OR s.slug = $1`,
        [id],
      );
      if (!seriesRes.rows[0]) return reply.code(404).send({ error: "Not found" });
      const figures = await query(
        `SELECT * FROM figures WHERE series_id = $1 ORDER BY sort_order ASC, name_en ASC`,
        [seriesRes.rows[0].id],
      );
      return { series: seriesRes.rows[0], figures: figures.rows };
    } catch (e: any) {
      request.log.error(e);
      return reply.code(500).send({ error: e.message || "Server error" });
    }
  });

  app.get<{
    Querystring: { q?: string; seriesId?: string; secretsOnly?: string };
  }>("/catalog/figures", async (request) => {
    const { q, seriesId, secretsOnly } = request.query;
    const params: unknown[] = [];
    let where = "WHERE 1=1";
    if (seriesId) {
      params.push(seriesId);
      where += ` AND f.series_id = $${params.length}`;
    }
    if (secretsOnly === "1") {
      where += ` AND f.is_secret = true`;
    }
    if (q) {
      params.push(`%${q}%`);
      where += ` AND (f.name_en ILIKE $${params.length} OR f.name_ja ILIKE $${params.length} OR s.name_en ILIKE $${params.length})`;
    }
    const result = await query(
      `SELECT f.*, s.name_en AS series_name, s.slug AS series_slug, b.name AS brand_name, b.slug AS brand_slug
       FROM figures f
       JOIN series s ON s.id = f.series_id
       JOIN brands b ON b.id = s.brand_id
       ${where}
       ORDER BY b.name, s.sort_order, f.sort_order, f.name_en
       LIMIT 500`,
      params,
    );
    return { figures: result.rows };
  });

  app.get("/me/collection", async (request, reply) => {
    try {
      const user = await requireUser(request);
      const result = await query(
        `SELECT uf.*, f.name_en, f.name_ja, f.image_url, f.is_secret, f.is_limited,
                f.is_bonus, f.is_duo, s.id AS series_id, s.name_en AS series_name, s.slug AS series_slug,
                b.name AS brand_name
         FROM user_figures uf
         JOIN figures f ON f.id = uf.figure_id
         JOIN series s ON s.id = f.series_id
         JOIN brands b ON b.id = s.brand_id
         WHERE uf.user_id = $1 AND (uf.owned_qty > 0 OR uf.wishlist = true)
         ORDER BY b.name, s.sort_order, f.sort_order`,
        [user.id],
      );

      const stats = await query<{
        owned_figures: number;
        owned_qty_total: number;
        wishlist_count: number;
        total_figures: number;
      }>(
        `SELECT
           (SELECT COUNT(*)::int FROM user_figures WHERE user_id = $1 AND owned_qty > 0) AS owned_figures,
           (SELECT COALESCE(SUM(owned_qty),0)::int FROM user_figures WHERE user_id = $1) AS owned_qty_total,
           (SELECT COUNT(*)::int FROM user_figures WHERE user_id = $1 AND wishlist) AS wishlist_count,
           (SELECT COUNT(*)::int FROM figures) AS total_figures`,
        [user.id],
      );

      const seriesProgress = await query(
        `SELECT s.id, s.name_en, s.slug, s.cover_image_url,
           COUNT(f.id)::int AS total,
           COUNT(uf.figure_id) FILTER (WHERE uf.owned_qty > 0)::int AS owned
         FROM series s
         JOIN figures f ON f.series_id = s.id
         LEFT JOIN user_figures uf ON uf.figure_id = f.id AND uf.user_id = $1
         GROUP BY s.id
         ORDER BY s.sort_order`,
        [user.id],
      );

      return {
        items: result.rows,
        stats: stats.rows[0],
        seriesProgress: seriesProgress.rows,
      };
    } catch (e: any) {
      return reply.code(e.statusCode || 401).send({ error: e.message });
    }
  });

  app.put<{
    Body: {
      figureId: string;
      owned_qty?: number;
      wishlist?: boolean;
      notes?: string | null;
    };
  }>("/me/collection", async (request, reply) => {
    try {
      const user = await requireUser(request);
      const { figureId, owned_qty = 0, wishlist = false, notes = null } =
        request.body || {};
      if (!figureId) return reply.code(400).send({ error: "figureId required" });

      if (owned_qty <= 0 && !wishlist && !notes) {
        await query(
          `DELETE FROM user_figures WHERE user_id = $1 AND figure_id = $2`,
          [user.id, figureId],
        );
        return { ok: true, deleted: true };
      }

      const result = await query(
        `INSERT INTO user_figures (user_id, figure_id, owned_qty, wishlist, notes, updated_at)
         VALUES ($1, $2, $3, $4, $5, now())
         ON CONFLICT (user_id, figure_id) DO UPDATE SET
           owned_qty = EXCLUDED.owned_qty,
           wishlist = EXCLUDED.wishlist,
           notes = EXCLUDED.notes,
           updated_at = now()
         RETURNING *`,
        [user.id, figureId, Math.max(0, owned_qty), wishlist, notes],
      );
      return { item: result.rows[0] };
    } catch (e: any) {
      return reply.code(e.statusCode || 401).send({ error: e.message });
    }
  });

  // ---- Admin ----
  app.post<{
    Body: { slug: string; name: string; name_ja?: string; logo_url?: string };
  }>("/admin/brands", async (request, reply) => {
    try {
      await requireAdmin(request);
      const { slug, name, name_ja, logo_url } = request.body || {};
      const result = await query(
        `INSERT INTO brands (slug, name, name_ja, logo_url)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, name_ja = EXCLUDED.name_ja, logo_url = COALESCE(EXCLUDED.logo_url, brands.logo_url)
         RETURNING *`,
        [slug, name, name_ja || null, logo_url || null],
      );
      return { brand: result.rows[0] };
    } catch (e: any) {
      return reply.code(e.statusCode || 400).send({ error: e.message });
    }
  });

  app.post<{
    Body: {
      brand_id: string;
      slug: string;
      name_en: string;
      name_ja?: string;
      product_form?: string;
      sort_order?: number;
      release_year?: number;
      cover_image_url?: string;
      official_url?: string;
    };
  }>("/admin/series", async (request, reply) => {
    try {
      await requireAdmin(request);
      const b = request.body || ({} as any);
      const result = await query(
        `INSERT INTO series (brand_id, slug, name_en, name_ja, product_form, sort_order, release_year, cover_image_url, official_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (brand_id, slug) DO UPDATE SET
           name_en = EXCLUDED.name_en,
           name_ja = EXCLUDED.name_ja,
           product_form = EXCLUDED.product_form,
           sort_order = EXCLUDED.sort_order,
           release_year = EXCLUDED.release_year,
           cover_image_url = COALESCE(EXCLUDED.cover_image_url, series.cover_image_url),
           official_url = EXCLUDED.official_url
         RETURNING *`,
        [
          b.brand_id,
          b.slug,
          b.name_en,
          b.name_ja || null,
          b.product_form || "blind_box_mini",
          b.sort_order || 0,
          b.release_year || null,
          b.cover_image_url || null,
          b.official_url || null,
        ],
      );
      return { series: result.rows[0] };
    } catch (e: any) {
      return reply.code(e.statusCode || 400).send({ error: e.message });
    }
  });

  app.patch<{
    Params: { id: string };
    Body: Record<string, unknown>;
  }>("/admin/series/:id", async (request, reply) => {
    try {
      await requireAdmin(request);
      const allowed = [
        "name_en",
        "name_ja",
        "product_form",
        "sort_order",
        "release_year",
        "cover_image_url",
        "official_url",
        "slug",
      ];
      const sets: string[] = [];
      const params: unknown[] = [];
      for (const key of allowed) {
        if (key in (request.body || {})) {
          params.push((request.body as any)[key]);
          sets.push(`${key} = $${params.length}`);
        }
      }
      if (!sets.length) return reply.code(400).send({ error: "No fields" });
      params.push(request.params.id);
      const result = await query(
        `UPDATE series SET ${sets.join(", ")} WHERE id = $${params.length} RETURNING *`,
        params,
      );
      if (!result.rows[0]) return reply.code(404).send({ error: "Not found" });
      return { series: result.rows[0] };
    } catch (e: any) {
      return reply.code(e.statusCode || 400).send({ error: e.message });
    }
  });

  app.delete<{ Params: { id: string } }>(
    "/admin/series/:id",
    async (request, reply) => {
      try {
        await requireAdmin(request);
        await query(`DELETE FROM series WHERE id = $1`, [request.params.id]);
        return { ok: true };
      } catch (e: any) {
        return reply.code(e.statusCode || 400).send({ error: e.message });
      }
    },
  );

  app.post<{
    Body: {
      series_id: string;
      name_en: string;
      name_ja?: string;
      is_secret?: boolean;
      is_limited?: boolean;
      is_bonus?: boolean;
      is_duo?: boolean;
      image_url?: string;
      sort_order?: number;
    };
  }>("/admin/figures", async (request, reply) => {
    try {
      await requireAdmin(request);
      const b = request.body || ({} as any);
      const result = await query(
        `INSERT INTO figures (series_id, name_en, name_ja, is_secret, is_limited, is_bonus, is_duo, image_url, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING *`,
        [
          b.series_id,
          b.name_en,
          b.name_ja || null,
          !!b.is_secret,
          !!b.is_limited,
          !!b.is_bonus,
          !!b.is_duo,
          b.image_url || null,
          b.sort_order || 0,
        ],
      );
      return { figure: result.rows[0] };
    } catch (e: any) {
      return reply.code(e.statusCode || 400).send({ error: e.message });
    }
  });

  app.patch<{
    Params: { id: string };
    Body: Record<string, unknown>;
  }>("/admin/figures/:id", async (request, reply) => {
    try {
      await requireAdmin(request);
      const allowed = [
        "name_en",
        "name_ja",
        "is_secret",
        "is_limited",
        "is_bonus",
        "is_duo",
        "image_url",
        "sort_order",
        "series_id",
      ];
      const sets: string[] = [];
      const params: unknown[] = [];
      for (const key of allowed) {
        if (key in (request.body || {})) {
          params.push((request.body as any)[key]);
          sets.push(`${key} = $${params.length}`);
        }
      }
      if (!sets.length) return reply.code(400).send({ error: "No fields" });
      params.push(request.params.id);
      const result = await query(
        `UPDATE figures SET ${sets.join(", ")} WHERE id = $${params.length} RETURNING *`,
        params,
      );
      if (!result.rows[0]) return reply.code(404).send({ error: "Not found" });
      return { figure: result.rows[0] };
    } catch (e: any) {
      return reply.code(e.statusCode || 400).send({ error: e.message });
    }
  });

  app.delete<{ Params: { id: string } }>(
    "/admin/figures/:id",
    async (request, reply) => {
      try {
        await requireAdmin(request);
        await query(`DELETE FROM figures WHERE id = $1`, [request.params.id]);
        return { ok: true };
      } catch (e: any) {
        return reply.code(e.statusCode || 400).send({ error: e.message });
      }
    },
  );

  app.get<{
    Querystring: { kind?: string; q?: string };
  }>("/admin/media", async (request, reply) => {
    try {
      await requireAdmin(request);
      const kind = ["figures", "series", "brands"].includes(request.query.kind || "")
        ? (request.query.kind as string)
        : "figures";
      const dir = path.join(MEDIA_ROOT, kind);
      fs.mkdirSync(dir, { recursive: true });
      const q = (request.query.q || "").toLowerCase();
      const files = fs
        .readdirSync(dir)
        .filter((f) => /\.(png|jpe?g|webp|gif)$/i.test(f))
        .filter((f) => !q || f.toLowerCase().includes(q))
        .sort()
        .slice(0, 2000)
        .map((name) => ({
          name,
          url: mediaUrl(`${kind}/${name}`),
        }));
      // also include root media files (legacy flat figures)
      if (kind === "figures") {
        const rootFiles = fs
          .readdirSync(MEDIA_ROOT)
          .filter((f) => /\.(png|jpe?g|webp|gif)$/i.test(f))
          .filter((f) => !q || f.toLowerCase().includes(q))
          .slice(0, 2000)
          .map((name) => ({ name, url: mediaUrl(name) }));
        const seen = new Set(files.map((f) => f.url));
        for (const f of rootFiles) if (!seen.has(f.url)) files.push(f);
      }
      return { media: files.slice(0, 2500) };
    } catch (e: any) {
      return reply.code(e.statusCode || 400).send({ error: e.message });
    }
  });

  app.post("/admin/upload", async (request, reply) => {
    try {
      await requireAdmin(request);
      const file = await request.file();
      if (!file) return reply.code(400).send({ error: "file required" });
      const kind = (file.fields as any)?.kind?.value || "figures";
      const folder = ["figures", "series", "brands"].includes(kind)
        ? kind
        : "figures";
      const ext =
        path.extname(file.filename || "").toLowerCase() ||
        (file.mimetype === "image/png" ? ".png" : ".jpg");
      const filename = `${randomUUID()}${ext}`;
      const dest = path.join(MEDIA_ROOT, folder, filename);
      const buffer = await file.toBuffer();
      fs.writeFileSync(dest, buffer);
      const url = mediaUrl(`${folder}/${filename}`);
      return { url };
    } catch (e: any) {
      return reply.code(e.statusCode || 400).send({ error: e.message });
    }
  });

  await app.listen({ port: PORT, host: HOST });
  app.log.info(`Blind Box Closet API on ${HOST}:${PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
