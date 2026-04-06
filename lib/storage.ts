/**
 * Database-backed versioned file storage — TypeScript port of db_storage.py.
 * Uses @vercel/postgres for metadata and @vercel/blob for content.
 */

import { sql, ensureMigrated } from "./db";
import { put, del, head } from "@vercel/blob";
import crypto from "crypto";
import { v4 as uuid } from "uuid";

// --- Types ---

export type FileEntry = {
  path: string;
  is_dir: boolean;
  size: number;
  modified: string | null;
};

export type CommitInfo = {
  id: string;
  message: string;
  timestamp: string;
  author: string;
  files_changed: string[];
};

// --- Helpers ---

function contentHash(content: Buffer): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function newId(): string {
  return uuid().replace(/-/g, "").slice(0, 12);
}

function now(): string {
  return new Date().toISOString();
}

function normalizePath(path: string): string {
  return path.replace(/^\/+|\/+$/g, "");
}

// Blob store key from sha256
function blobKey(sha: string): string {
  return `blobs/${sha.slice(0, 2)}/${sha}`;
}

// --- Blob helpers (Vercel Blob) ---

async function blobPut(sha: string, content: Buffer): Promise<string> {
  const key = blobKey(sha);
  const { url } = await put(key, content, { access: "public", addRandomSuffix: false });
  return url;
}

async function blobGet(storeKey: string): Promise<Buffer> {
  const res = await fetch(storeKey);
  if (!res.ok) throw new Error(`Blob fetch failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function blobExists(sha: string): Promise<string | null> {
  // Check if we have a record in the blobs table
  const { rows } = await sql`SELECT store_key FROM blobs WHERE sha256 = ${sha}`;
  return rows[0]?.store_key || null;
}

// --- Storage class ---

export class Storage {
  constructor(
    public userId: string,
    public workspace: string = "default",
  ) {}

  async write(
    path: string,
    content: Buffer,
    opts?: { message?: string; agent?: string; conversation?: string },
  ): Promise<CommitInfo> {
    await ensureMigrated();
    path = normalizePath(path);
    const sha = contentHash(content);
    const size = content.length;
    const ts = now();
    const commitId = newId();

    // Store blob if new
    let storeKey = await blobExists(sha);
    if (!storeKey) {
      storeKey = await blobPut(sha, content);
    }

    // Ensure blob record in DB
    await sql`
      INSERT INTO blobs (sha256, size, store_key, created_at)
      VALUES (${sha}, ${size}, ${storeKey}, ${ts})
      ON CONFLICT (sha256) DO NOTHING
    `;

    // Get previous version
    const { rows: prevRows } = await sql`
      SELECT blob_sha256 FROM files
      WHERE user_id = ${this.userId} AND workspace = ${this.workspace} AND path = ${path}
    `;
    const prevSha = prevRows[0]?.blob_sha256 || null;

    // Upsert file
    const fileId = uuid();
    await sql`
      INSERT INTO files (id, user_id, workspace, path, blob_sha256, size, created_at, updated_at)
      VALUES (${fileId}, ${this.userId}, ${this.workspace}, ${path}, ${sha}, ${size}, ${ts}, ${ts})
      ON CONFLICT (user_id, workspace, path)
      DO UPDATE SET blob_sha256 = ${sha}, size = ${size}, updated_at = ${ts}
    `;

    // Create commit
    const msg = opts?.message || `Write ${path}`;
    await sql`
      INSERT INTO commits (id, user_id, workspace, message, agent, conversation, created_at)
      VALUES (${commitId}, ${this.userId}, ${this.workspace}, ${msg}, ${opts?.agent ?? null}, ${opts?.conversation ?? null}, ${ts})
    `;

    // Record file change
    await sql`
      INSERT INTO commit_files (id, commit_id, path, action, blob_sha256, prev_blob_sha256)
      VALUES (${uuid()}, ${commitId}, ${path}, ${"write"}, ${sha}, ${prevSha})
    `;

    return {
      id: commitId,
      message: msg,
      timestamp: ts,
      author: opts?.agent || "AgentFS",
      files_changed: [path],
    };
  }

  async read(path: string, version?: string): Promise<Buffer> {
    await ensureMigrated();
    path = normalizePath(path);

    if (version) {
      const { rows } = await sql`
        SELECT blob_sha256 FROM commit_files
        WHERE commit_id = ${version} AND path = ${path} AND action != 'delete'
      `;
      if (!rows[0]) throw new FileNotFoundError(`File not found at version ${version}: ${path}`);
      const { rows: blobRows } = await sql`SELECT store_key FROM blobs WHERE sha256 = ${rows[0].blob_sha256}`;
      if (!blobRows[0]) throw new FileNotFoundError(`Blob not found: ${rows[0].blob_sha256}`);
      return blobGet(blobRows[0].store_key);
    }

    const { rows } = await sql`
      SELECT f.blob_sha256, b.store_key
      FROM files f JOIN blobs b ON f.blob_sha256 = b.sha256
      WHERE f.user_id = ${this.userId} AND f.workspace = ${this.workspace} AND f.path = ${path}
    `;
    if (!rows[0]) throw new FileNotFoundError(`File not found: ${path}`);
    return blobGet(rows[0].store_key);
  }

  async delete(
    path: string,
    opts?: { message?: string; agent?: string },
  ): Promise<CommitInfo> {
    await ensureMigrated();
    path = normalizePath(path);
    const ts = now();
    const commitId = newId();

    const { rows } = await sql`
      SELECT blob_sha256 FROM files
      WHERE user_id = ${this.userId} AND workspace = ${this.workspace} AND path = ${path}
    `;
    if (!rows[0]) throw new FileNotFoundError(`File not found: ${path}`);
    const prevSha = rows[0].blob_sha256;

    await sql`
      DELETE FROM files
      WHERE user_id = ${this.userId} AND workspace = ${this.workspace} AND path = ${path}
    `;

    const msg = opts?.message || `Delete ${path}`;
    await sql`
      INSERT INTO commits (id, user_id, workspace, message, agent, conversation, created_at)
      VALUES (${commitId}, ${this.userId}, ${this.workspace}, ${msg}, ${opts?.agent ?? null}, ${null}, ${ts})
    `;

    await sql`
      INSERT INTO commit_files (id, commit_id, path, action, blob_sha256, prev_blob_sha256)
      VALUES (${uuid()}, ${commitId}, ${path}, ${"delete"}, ${null}, ${prevSha})
    `;

    return {
      id: commitId,
      message: msg,
      timestamp: ts,
      author: "AgentFS",
      files_changed: [path],
    };
  }

  async move(
    src: string,
    dst: string,
    opts?: { message?: string; agent?: string },
  ): Promise<CommitInfo> {
    await ensureMigrated();
    src = normalizePath(src);
    dst = normalizePath(dst);
    const ts = now();
    const commitId = newId();

    const { rows } = await sql`
      SELECT id, blob_sha256, size FROM files
      WHERE user_id = ${this.userId} AND workspace = ${this.workspace} AND path = ${src}
    `;
    if (!rows[0]) throw new FileNotFoundError(`File not found: ${src}`);

    await sql`UPDATE files SET path = ${dst}, updated_at = ${ts} WHERE id = ${rows[0].id}`;

    const msg = opts?.message || `Move ${src} -> ${dst}`;
    await sql`
      INSERT INTO commits (id, user_id, workspace, message, agent, conversation, created_at)
      VALUES (${commitId}, ${this.userId}, ${this.workspace}, ${msg}, ${opts?.agent ?? null}, ${null}, ${ts})
    `;

    // Record both sides
    await sql`
      INSERT INTO commit_files (id, commit_id, path, action, blob_sha256, prev_blob_sha256, old_path)
      VALUES (${uuid()}, ${commitId}, ${src}, ${"move_from"}, ${null}, ${rows[0].blob_sha256}, ${null})
    `;
    await sql`
      INSERT INTO commit_files (id, commit_id, path, action, blob_sha256, prev_blob_sha256, old_path)
      VALUES (${uuid()}, ${commitId}, ${dst}, ${"move_to"}, ${rows[0].blob_sha256}, ${null}, ${src})
    `;

    return {
      id: commitId,
      message: msg,
      timestamp: ts,
      author: "AgentFS",
      files_changed: [src, dst],
    };
  }

  async list(path: string = "/"): Promise<FileEntry[]> {
    await ensureMigrated();
    const prefix = normalizePath(path);

    let rows;
    if (!prefix || prefix === ".") {
      const result = await sql`
        SELECT path, size, updated_at FROM files
        WHERE user_id = ${this.userId} AND workspace = ${this.workspace}
      `;
      rows = result.rows;
    } else {
      const likePattern = prefix + "/%";
      const result = await sql`
        SELECT path, size, updated_at FROM files
        WHERE user_id = ${this.userId} AND workspace = ${this.workspace} AND path LIKE ${likePattern}
      `;
      rows = result.rows;
    }

    // Group into direct children (files and directories)
    const entries = new Map<string, FileEntry>();
    const stripLen = prefix && prefix !== "." ? prefix.length + 1 : 0;

    for (const row of rows) {
      const rel = stripLen ? (row.path as string).slice(stripLen) : (row.path as string);
      const parts = rel.split("/");

      if (parts.length === 1) {
        entries.set(row.path as string, {
          path: row.path as string,
          is_dir: false,
          size: Number(row.size),
          modified: row.updated_at as string,
        });
      } else {
        const dirPath =
          prefix && prefix !== "." ? `${prefix}/${parts[0]}` : parts[0];
        if (!entries.has(dirPath)) {
          entries.set(dirPath, {
            path: dirPath,
            is_dir: true,
            size: 0,
            modified: row.updated_at as string,
          });
        }
      }
    }

    return [...entries.values()].sort((a, b) => a.path.localeCompare(b.path));
  }

  async search(query: string): Promise<FileEntry[]> {
    await ensureMigrated();
    const pattern = `%${query.toLowerCase()}%`;
    const { rows } = await sql`
      SELECT path, size, updated_at FROM files
      WHERE user_id = ${this.userId} AND workspace = ${this.workspace} AND lower(path) LIKE ${pattern}
    `;
    return rows.map((r) => ({
      path: r.path as string,
      is_dir: false,
      size: Number(r.size),
      modified: r.updated_at as string,
    }));
  }

  async log(path?: string, limit: number = 20): Promise<CommitInfo[]> {
    await ensureMigrated();

    let commits;
    if (path) {
      path = normalizePath(path);
      const result = await sql`
        SELECT DISTINCT c.id, c.message, c.created_at, c.agent
        FROM commits c JOIN commit_files cf ON cf.commit_id = c.id
        WHERE c.user_id = ${this.userId} AND c.workspace = ${this.workspace} AND cf.path = ${path}
        ORDER BY c.created_at DESC LIMIT ${limit}
      `;
      commits = result.rows;
    } else {
      const result = await sql`
        SELECT id, message, created_at, agent FROM commits
        WHERE user_id = ${this.userId} AND workspace = ${this.workspace}
        ORDER BY created_at DESC LIMIT ${limit}
      `;
      commits = result.rows;
    }

    if (commits.length === 0) return [];

    // Batch-fetch changed files
    const commitIds = commits.map((c) => c.id as string);
    // Vercel Postgres: use ANY with array cast
    const { rows: changes } = await sql`
      SELECT commit_id, path FROM commit_files WHERE commit_id = ANY(${commitIds as unknown as string})
    `;

    const filesByCommit = new Map<string, string[]>();
    for (const ch of changes) {
      const arr = filesByCommit.get(ch.commit_id as string) || [];
      arr.push(ch.path as string);
      filesByCommit.set(ch.commit_id as string, arr);
    }

    return commits.map((c) => ({
      id: c.id as string,
      message: c.message as string,
      timestamp: c.created_at as string,
      author: (c.agent as string) || "AgentFS",
      files_changed: filesByCommit.get(c.id as string) || [],
    }));
  }

  async diff(commitId: string): Promise<string> {
    await ensureMigrated();
    const { rows: changes } = await sql`
      SELECT path, action, blob_sha256, prev_blob_sha256
      FROM commit_files WHERE commit_id = ${commitId}
    `;

    if (changes.length === 0) return "No changes found for this commit.";

    const parts: string[] = [];
    for (const ch of changes) {
      if (ch.action === "move_from") continue;

      let oldContent: Buffer | null = null;
      let newContent: Buffer | null = null;

      if (ch.prev_blob_sha256) {
        try {
          const { rows: blobRows } = await sql`SELECT store_key FROM blobs WHERE sha256 = ${ch.prev_blob_sha256}`;
          if (blobRows[0]) oldContent = await blobGet(blobRows[0].store_key as string);
        } catch {}
      }

      if (ch.blob_sha256) {
        try {
          const { rows: blobRows } = await sql`SELECT store_key FROM blobs WHERE sha256 = ${ch.blob_sha256}`;
          if (blobRows[0]) newContent = await blobGet(blobRows[0].store_key as string);
        } catch {}
      }

      parts.push(makeDiff(ch.path as string, ch.action as string, oldContent, newContent));
    }

    return parts.join("\n");
  }

  async revert(commitId: string): Promise<CommitInfo> {
    await ensureMigrated();
    const ts = now();
    const newCommitId = newId();

    // Get the commit we're reverting
    const { rows: commitRows } = await sql`
      SELECT message FROM commits WHERE id = ${commitId}
    `;
    if (!commitRows[0]) throw new Error(`Commit not found: ${commitId}`);

    const { rows: changes } = await sql`
      SELECT path, action, blob_sha256, prev_blob_sha256, old_path
      FROM commit_files WHERE commit_id = ${commitId}
    `;

    const revertMsg = `Revert "${commitRows[0].message}"`;
    const filesChanged: string[] = [];

    // Create the revert commit
    await sql`
      INSERT INTO commits (id, user_id, workspace, message, agent, conversation, created_at)
      VALUES (${newCommitId}, ${this.userId}, ${this.workspace}, ${revertMsg}, ${null}, ${null}, ${ts})
    `;

    for (const ch of changes) {
      const action = ch.action as string;
      const chPath = ch.path as string;

      if (action === "write") {
        if (ch.prev_blob_sha256) {
          // File existed before — restore previous version
          const { rows: blobRows } = await sql`SELECT store_key FROM blobs WHERE sha256 = ${ch.prev_blob_sha256}`;
          if (blobRows[0]) {
            const prevContent = await blobGet(blobRows[0].store_key as string);
            await sql`
              UPDATE files SET blob_sha256 = ${ch.prev_blob_sha256}, size = ${prevContent.length}, updated_at = ${ts}
              WHERE user_id = ${this.userId} AND workspace = ${this.workspace} AND path = ${chPath}
            `;
          }
        } else {
          // File was new — delete it
          await sql`
            DELETE FROM files WHERE user_id = ${this.userId} AND workspace = ${this.workspace} AND path = ${chPath}
          `;
        }
        filesChanged.push(chPath);
      } else if (action === "delete") {
        // Re-create the file
        const { rows: blobRows } = await sql`SELECT store_key FROM blobs WHERE sha256 = ${ch.prev_blob_sha256}`;
        if (blobRows[0]) {
          const prevContent = await blobGet(blobRows[0].store_key as string);
          const fileId = uuid();
          await sql`
            INSERT INTO files (id, user_id, workspace, path, blob_sha256, size, created_at, updated_at)
            VALUES (${fileId}, ${this.userId}, ${this.workspace}, ${chPath}, ${ch.prev_blob_sha256}, ${prevContent.length}, ${ts}, ${ts})
            ON CONFLICT (user_id, workspace, path)
            DO UPDATE SET blob_sha256 = ${ch.prev_blob_sha256}, size = ${prevContent.length}, updated_at = ${ts}
          `;
        }
        filesChanged.push(chPath);
      } else if (action === "move_to") {
        // Reverse the move
        const oldPath = ch.old_path as string;
        await sql`
          UPDATE files SET path = ${oldPath}, updated_at = ${ts}
          WHERE user_id = ${this.userId} AND workspace = ${this.workspace} AND path = ${chPath}
        `;
        filesChanged.push(chPath, oldPath);
      }

      // Record inverse in commit_files
      await sql`
        INSERT INTO commit_files (id, commit_id, path, action, blob_sha256, prev_blob_sha256)
        VALUES (${uuid()}, ${newCommitId}, ${chPath}, ${"revert"}, ${ch.prev_blob_sha256}, ${ch.blob_sha256})
      `;
    }

    return {
      id: newCommitId,
      message: revertMsg,
      timestamp: ts,
      author: "AgentFS",
      files_changed: filesChanged,
    };
  }
}

// --- Diff helper ---

function makeDiff(
  path: string,
  action: string,
  oldContent: Buffer | null,
  newContent: Buffer | null,
): string {
  const header = `--- a/${path}\n+++ b/${path}\n`;

  if (action === "delete") {
    if (oldContent) {
      const lines = oldContent.toString("utf-8").split("\n");
      return header + lines.map((l) => `-${l}`).join("\n");
    }
    return `Deleted: ${path}`;
  }

  if (action === "move_to") {
    return `Moved to: ${path}`;
  }

  // Simple unified-ish diff
  try {
    const oldLines = oldContent ? oldContent.toString("utf-8").split("\n") : [];
    const newLines = newContent ? newContent.toString("utf-8").split("\n") : [];

    if (!oldContent) {
      // New file
      return header + newLines.map((l) => `+${l}`).join("\n");
    }

    // Basic line diff
    const diffs: string[] = [header];
    const maxLen = Math.max(oldLines.length, newLines.length);
    let hasChanges = false;

    for (let i = 0; i < maxLen; i++) {
      const oldLine = i < oldLines.length ? oldLines[i] : undefined;
      const newLine = i < newLines.length ? newLines[i] : undefined;

      if (oldLine === newLine) {
        diffs.push(` ${oldLine}`);
      } else {
        hasChanges = true;
        if (oldLine !== undefined) diffs.push(`-${oldLine}`);
        if (newLine !== undefined) diffs.push(`+${newLine}`);
      }
    }

    return hasChanges ? diffs.join("\n") : `No text changes: ${path}`;
  } catch {
    return `Binary file changed: ${path}`;
  }
}

// --- Errors ---

export class FileNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FileNotFoundError";
  }
}
