import { neon } from "@neondatabase/serverless";

// Neon's HTTP driver - no connection pooling to manage, safe for serverless.
const sql = neon(process.env.DATABASE_URL!);

let schemaReady: Promise<void> | null = null;

function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS kv_store (
          key TEXT PRIMARY KEY,
          value JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS backups (
          name TEXT PRIMARY KEY,
          data JSONB NOT NULL,
          type TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
    })();
  }
  return schemaReady;
}

// ---- Data files (kv_store) ----

export async function readDb<T = any>(filename: string, fallback: T): Promise<T> {
  await ensureSchema();
  const rows = await sql`SELECT value FROM kv_store WHERE key = ${filename}`;
  return rows.length > 0 ? (rows[0].value as T) : fallback;
}

export async function writeDb(filename: string, data: any): Promise<void> {
  await ensureSchema();
  await sql`
    INSERT INTO kv_store (key, value, updated_at)
    VALUES (${filename}, ${JSON.stringify(data)}, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `;
}

// Writes multiple data files in a single transaction - real atomicity,
// unlike the sequential-write workaround the GitHub-backed store needed.
export async function writeDbBatch(entries: Array<[string, any]>): Promise<void> {
  await ensureSchema();
  const values = entries.map(([filename, data]) => [filename, JSON.stringify(data)]);
  await sql.transaction(
    values.map(([filename, json]) => sql`
      INSERT INTO kv_store (key, value, updated_at)
      VALUES (${filename}, ${json}, now())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
    `)
  );
}

// ---- Backups ----

export interface BackupFileInfo {
  name: string;
  size: number;
  type: string;
  createdAt: string;
}

export async function listBackups(): Promise<BackupFileInfo[]> {
  await ensureSchema();
  const rows = await sql`
    SELECT name, type, created_at, octet_length(data::text) AS size
    FROM backups
    ORDER BY created_at DESC
  `;
  return rows.map((r: any) => ({
    name: r.name,
    size: Number(r.size),
    type: r.type,
    createdAt: new Date(r.created_at).toISOString()
  }));
}

export async function readBackup(filename: string): Promise<any | null> {
  await ensureSchema();
  const rows = await sql`SELECT data FROM backups WHERE name = ${filename}`;
  return rows.length > 0 ? rows[0].data : null;
}

export async function writeBackup(filename: string, data: any, type: string): Promise<void> {
  await ensureSchema();
  await sql`
    INSERT INTO backups (name, data, type, created_at)
    VALUES (${filename}, ${JSON.stringify(data)}, ${type}, now())
    ON CONFLICT (name) DO UPDATE SET data = EXCLUDED.data, type = EXCLUDED.type
  `;
}

export async function deleteBackup(filename: string): Promise<void> {
  await ensureSchema();
  await sql`DELETE FROM backups WHERE name = ${filename}`;
}
