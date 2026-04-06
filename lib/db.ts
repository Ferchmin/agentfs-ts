/**
 * Database layer — Vercel Postgres (Neon) for users, keys, files, commits.
 * Falls back to in-memory SQLite-like behavior for local dev if no POSTGRES_URL.
 */

import { sql } from "@vercel/postgres";

export async function migrate() {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      name TEXT,
      password_hash TEXT,
      provider TEXT,
      provider_id TEXT,
      avatar_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(provider, provider_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      key_hash TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      workspace TEXT NOT NULL DEFAULT 'default',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS blobs (
      sha256 TEXT PRIMARY KEY,
      size BIGINT NOT NULL,
      store_key TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      workspace TEXT NOT NULL DEFAULT 'default',
      path TEXT NOT NULL,
      blob_sha256 TEXT NOT NULL REFERENCES blobs(sha256),
      size BIGINT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(user_id, workspace, path)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS commits (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      workspace TEXT NOT NULL DEFAULT 'default',
      message TEXT NOT NULL,
      agent TEXT,
      conversation TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS commit_files (
      id TEXT PRIMARY KEY,
      commit_id TEXT NOT NULL REFERENCES commits(id) ON DELETE CASCADE,
      path TEXT NOT NULL,
      action TEXT NOT NULL,
      blob_sha256 TEXT REFERENCES blobs(sha256),
      prev_blob_sha256 TEXT REFERENCES blobs(sha256),
      old_path TEXT
    )
  `;

  // Indexes
  await sql`CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_files_workspace ON files(user_id, workspace)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_commits_workspace ON commits(user_id, workspace, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_commit_files_commit ON commit_files(commit_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_commit_files_path ON commit_files(path)`;
}

// Cache migration status
let migrated = false;

export async function ensureMigrated() {
  if (!migrated) {
    await migrate();
    migrated = true;
  }
}

export { sql };
