// GitHub Contents API backed JSON store.
// Replaces local-filesystem read/write so data survives on Vercel's
// stateless, read-only serverless filesystem.

const GITHUB_API = "https://api.github.com";

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function repoConfig() {
  return {
    owner: env("GITHUB_OWNER"),
    repo: env("GITHUB_REPO"),
    branch: process.env.GITHUB_BRANCH || "main",
    token: env("GITHUB_TOKEN")
  };
}

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json"
  };
}

interface GithubFile {
  content: any;
  sha: string;
}

async function getFile(path: string): Promise<GithubFile | null> {
  const { owner, repo, branch, token } = repoConfig();
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`,
    { headers: authHeaders(token) }
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub read failed for ${path}: ${res.status} ${await res.text()}`);
  const json = await res.json();
  const content = JSON.parse(Buffer.from(json.content, "base64").toString("utf8"));
  return { content, sha: json.sha };
}

async function putFile(path: string, data: any, message: string, sha?: string): Promise<void> {
  const { owner, repo, branch, token } = repoConfig();
  const body = {
    message,
    content: Buffer.from(JSON.stringify(data, null, 2)).toString("base64"),
    branch,
    ...(sha ? { sha } : {})
  };

  const attempt = async (attemptSha?: string) => {
    const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/${path}`, {
      method: "PUT",
      headers: authHeaders(token),
      body: JSON.stringify({ ...body, ...(attemptSha ? { sha: attemptSha } : { sha: undefined }) })
    });
    return res;
  };

  let res = await attempt(sha);
  if (res.status === 409 || res.status === 422) {
    // Stale sha (concurrent write) - refetch and retry once.
    const fresh = await getFile(path);
    res = await attempt(fresh?.sha);
  }
  if (!res.ok) throw new Error(`GitHub write failed for ${path}: ${res.status} ${await res.text()}`);
}

async function deleteFile(path: string, message: string): Promise<void> {
  const { owner, repo, branch, token } = repoConfig();
  const existing = await getFile(path);
  if (!existing) return;
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/${path}`, {
    method: "DELETE",
    headers: authHeaders(token),
    body: JSON.stringify({ message, sha: existing.sha, branch })
  });
  if (!res.ok) throw new Error(`GitHub delete failed for ${path}: ${res.status} ${await res.text()}`);
}

// ---- Data files (/data/*.json) ----

export async function readDb<T = any>(filename: string, fallback: T): Promise<T> {
  const file = await getFile(`data/${filename}`);
  return file ? (file.content as T) : fallback;
}

export async function writeDb(filename: string, data: any): Promise<void> {
  const file = await getFile(`data/${filename}`);
  await putFile(`data/${filename}`, data, `Update ${filename}`, file?.sha);
}

// Writes multiple data files ONE AT A TIME (not Promise.all). The GitHub
// Contents API isn't safe for concurrent writes to the same branch - every
// write is a new commit, and simultaneous commits race for the branch HEAD
// even when the files themselves are unrelated. Use this for any handler
// that needs to persist more than one file.
export async function writeDbBatch(entries: Array<[string, any]>): Promise<void> {
  for (const [filename, data] of entries) {
    await writeDb(filename, data);
  }
}

// ---- Backup files (/backups/*.json) ----

export interface BackupFileInfo {
  name: string;
  size: number;
}

export async function listBackups(): Promise<BackupFileInfo[]> {
  const { owner, repo, branch, token } = repoConfig();
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/contents/backups?ref=${encodeURIComponent(branch)}`,
    { headers: authHeaders(token) }
  );
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`GitHub backup listing failed: ${res.status} ${await res.text()}`);
  const items = await res.json();
  return (items as any[])
    .filter(i => i.type === "file" && i.name.endsWith(".json"))
    .map(i => ({ name: i.name, size: i.size }));
}

export async function readBackup(filename: string): Promise<any | null> {
  const file = await getFile(`backups/${filename}`);
  return file ? file.content : null;
}

export async function writeBackup(filename: string, data: any): Promise<void> {
  await putFile(`backups/${filename}`, data, `Create backup ${filename}`);
}

export async function deleteBackup(filename: string): Promise<void> {
  await deleteFile(`backups/${filename}`, `Delete backup ${filename}`);
}
