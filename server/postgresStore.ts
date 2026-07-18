import { neon } from "@neondatabase/serverless";
import { AsyncLocalStorage } from "node:async_hooks";

// Neon's HTTP driver - no connection pooling to manage, safe for serverless.
const sql = neon(process.env.DATABASE_URL!);

let schemaReady: Promise<void> | null = null;

function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS accounts (
          id TEXT PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          display_name TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS kv_store (
          key TEXT PRIMARY KEY,
          value JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS backups (
          account_id TEXT NOT NULL,
          name TEXT NOT NULL,
          data JSONB NOT NULL,
          type TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          PRIMARY KEY (account_id, name)
        )
      `;
    })();
  }
  return schemaReady;
}

// ---- Per-request account context ----
// Every data/backup function below is implicitly scoped to whichever account
// is running the current request, via AsyncLocalStorage - set once by the
// verifyToken middleware, so route handlers don't need an accountId param
// threaded through every call.

const accountContext = new AsyncLocalStorage<string>();

export function runWithAccount<T>(accountId: string, fn: () => Promise<T>): Promise<T> {
  return accountContext.run(accountId, fn);
}

function getAccountId(): string {
  const accountId = accountContext.getStore();
  if (!accountId) {
    throw new Error("Storage accessed outside an authenticated account context");
  }
  return accountId;
}

// ---- Accounts ----

export interface Account {
  id: string;
  username: string;
  passwordHash: string;
  displayName: string;
}

export async function findAccountByUsername(username: string): Promise<Account | null> {
  await ensureSchema();
  const rows = await sql`SELECT id, username, password_hash, display_name FROM accounts WHERE username = ${username}`;
  if (rows.length === 0) return null;
  const r: any = rows[0];
  return { id: r.id, username: r.username, passwordHash: r.password_hash, displayName: r.display_name };
}

export async function findAccountById(id: string): Promise<Account | null> {
  await ensureSchema();
  const rows = await sql`SELECT id, username, password_hash, display_name FROM accounts WHERE id = ${id}`;
  if (rows.length === 0) return null;
  const r: any = rows[0];
  return { id: r.id, username: r.username, passwordHash: r.password_hash, displayName: r.display_name };
}

export async function createAccount(id: string, username: string, passwordHash: string, displayName: string): Promise<void> {
  await ensureSchema();
  await sql`
    INSERT INTO accounts (id, username, password_hash, display_name)
    VALUES (${id}, ${username}, ${passwordHash}, ${displayName})
  `;
}

export async function updateAccountPassword(accountId: string, passwordHash: string): Promise<void> {
  await ensureSchema();
  await sql`UPDATE accounts SET password_hash = ${passwordHash} WHERE id = ${accountId}`;
}

// One-time migration: adopts pre-multi-account data (unprefixed kv_store
// keys from the single-account era) into the given account. The old
// `backups` table had a different shape (no account_id) - backups are
// recreatable snapshots, not source-of-truth data, so it's simplest to
// reset it to the new shape rather than migrate row-by-row.
export async function migrateLegacyDataToAccount(accountId: string): Promise<void> {
  await ensureSchema();
  await sql`
    UPDATE kv_store
    SET key = ${accountId} || ':' || key
    WHERE key NOT LIKE '%:%'
  `;
  await sql`DROP TABLE IF EXISTS backups`;
  await sql`
    CREATE TABLE backups (
      account_id TEXT NOT NULL,
      name TEXT NOT NULL,
      data JSONB NOT NULL,
      type TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (account_id, name)
    )
  `;
}

// ---- Data files (kv_store), scoped to the current account ----

export async function readDb<T = any>(filename: string, fallback: T): Promise<T> {
  await ensureSchema();
  const key = `${getAccountId()}:${filename}`;
  const rows = await sql`SELECT value FROM kv_store WHERE key = ${key}`;
  return rows.length > 0 ? (rows[0].value as T) : fallback;
}

export async function writeDb(filename: string, data: any): Promise<void> {
  await ensureSchema();
  const key = `${getAccountId()}:${filename}`;
  await sql`
    INSERT INTO kv_store (key, value, updated_at)
    VALUES (${key}, ${JSON.stringify(data)}, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `;
}

// Writes multiple data files in a single transaction - real atomicity,
// unlike the sequential-write workaround the GitHub-backed store needed.
export async function writeDbBatch(entries: Array<[string, any]>): Promise<void> {
  await ensureSchema();
  const accountId = getAccountId();
  const values = entries.map(([filename, data]) => [`${accountId}:${filename}`, JSON.stringify(data)]);
  await sql.transaction(
    values.map(([key, json]) => sql`
      INSERT INTO kv_store (key, value, updated_at)
      VALUES (${key}, ${json}, now())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
    `)
  );
}

// ---- Backups, scoped to the current account ----

export interface BackupFileInfo {
  name: string;
  size: number;
  type: string;
  createdAt: string;
}

export async function listBackups(): Promise<BackupFileInfo[]> {
  await ensureSchema();
  const accountId = getAccountId();
  const rows = await sql`
    SELECT name, type, created_at, octet_length(data::text) AS size
    FROM backups
    WHERE account_id = ${accountId}
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
  const accountId = getAccountId();
  const rows = await sql`SELECT data FROM backups WHERE account_id = ${accountId} AND name = ${filename}`;
  return rows.length > 0 ? rows[0].data : null;
}

export async function writeBackup(filename: string, data: any, type: string): Promise<void> {
  await ensureSchema();
  const accountId = getAccountId();
  await sql`
    INSERT INTO backups (account_id, name, data, type, created_at)
    VALUES (${accountId}, ${filename}, ${JSON.stringify(data)}, ${type}, now())
    ON CONFLICT (account_id, name) DO UPDATE SET data = EXCLUDED.data, type = EXCLUDED.type
  `;
}

export async function deleteBackup(filename: string): Promise<void> {
  await ensureSchema();
  const accountId = getAccountId();
  await sql`DELETE FROM backups WHERE account_id = ${accountId} AND name = ${filename}`;
}
