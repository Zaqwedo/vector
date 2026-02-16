import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";

let pool: Pool | null = null;
let schemaEnsured = false;
let schemaInitPromise: Promise<void> | null = null;

const getPool = () => {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  pool = new Pool({ connectionString });
  return pool;
};

export const ensureSchema = async () => {
  if (schemaEnsured) return;
  if (schemaInitPromise) return schemaInitPromise;

  schemaInitPromise = (async () => {
    const db = getPool();
    const client = await db.connect();
    try {
      // Cross-process guard for Next.js dev parallel requests/workers.
      await client.query("SELECT pg_advisory_lock(88221103)");
      if (schemaEnsured) return;

      const sql = readFileSync(join(process.cwd(), "db", "schema.sql"), "utf-8");
      await client.query(sql);
      schemaEnsured = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Database init failed: ${message}. Check DATABASE_URL and ensure Postgres is running and database exists.`
      );
    } finally {
      try {
        await client.query("SELECT pg_advisory_unlock(88221103)");
      } catch {
        // no-op
      }
      client.release();
      schemaInitPromise = null;
    }
  })();

  return schemaInitPromise;
};

export const q = async <T = unknown>(text: string, values: unknown[] = []) => {
  await ensureSchema();
  return getPool().query<T>(text, values);
};
