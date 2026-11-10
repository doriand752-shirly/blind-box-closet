import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const { Pool } = pg;

export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgres://bbc:bbc@127.0.0.1:5433/blindboxcloset",
});

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
) {
  return pool.query<T>(text, params);
}

export async function migrate() {
  const schemaPath = path.join(__dirname, "schema.sql");
  const sql = fs.readFileSync(schemaPath, "utf8");
  await pool.query(sql);
}
