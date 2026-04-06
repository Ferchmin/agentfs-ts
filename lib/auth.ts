/**
 * Authentication — JWT tokens, password hashing, API key validation.
 */

import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { v4 as uuid } from "uuid";
import { sql, ensureMigrated } from "./db";
import { NextRequest } from "next/server";

const SECRET = new TextEncoder().encode(
  process.env.AGENTFS_SECRET || "change-me-in-production"
);
const JWT_EXPIRY = "30d";

// --- JWT ---

export async function createToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(SECRET);
}

export async function decodeToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload.sub || null;
  } catch {
    return null;
  }
}

// --- Passwords ---

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

// --- Users ---

export async function createUser(opts: {
  email?: string | null;
  name?: string | null;
  passwordHash?: string | null;
  provider?: string | null;
  providerId?: string | null;
  avatarUrl?: string | null;
}) {
  await ensureMigrated();
  const id = uuid();
  await sql`
    INSERT INTO users (id, email, name, password_hash, provider, provider_id, avatar_url)
    VALUES (${id}, ${opts.email ?? null}, ${opts.name ?? null}, ${opts.passwordHash ?? null},
            ${opts.provider ?? null}, ${opts.providerId ?? null}, ${opts.avatarUrl ?? null})
  `;
  return getUser(id);
}

export async function getUser(id: string) {
  await ensureMigrated();
  const { rows } = await sql`SELECT * FROM users WHERE id = ${id}`;
  return rows[0] || null;
}

export async function getUserByEmail(email: string) {
  await ensureMigrated();
  const { rows } = await sql`SELECT * FROM users WHERE email = ${email}`;
  return rows[0] || null;
}

export async function getUserByProvider(provider: string, providerId: string) {
  await ensureMigrated();
  const { rows } = await sql`
    SELECT * FROM users WHERE provider = ${provider} AND provider_id = ${providerId}
  `;
  return rows[0] || null;
}

// --- API Keys ---

export async function createApiKey(userId: string, name: string, workspace = "default") {
  await ensureMigrated();
  const rawKey = `agentfs_${crypto.randomBytes(32).toString("base64url")}`;
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
  const id = uuid();
  await sql`
    INSERT INTO api_keys (id, user_id, key_hash, name, workspace)
    VALUES (${id}, ${userId}, ${keyHash}, ${name}, ${workspace})
  `;
  return rawKey;
}

export async function validateApiKey(rawKey: string) {
  await ensureMigrated();
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
  const { rows } = await sql`
    SELECT api_keys.*, users.email, users.name as user_name
    FROM api_keys JOIN users ON api_keys.user_id = users.id
    WHERE api_keys.key_hash = ${keyHash}
  `;
  return rows[0] || null;
}

export async function listApiKeys(userId: string) {
  await ensureMigrated();
  const { rows } = await sql`
    SELECT id, name, workspace, created_at FROM api_keys WHERE user_id = ${userId}
  `;
  return rows;
}

export async function deleteApiKey(keyId: string, userId: string) {
  await ensureMigrated();
  const { rowCount } = await sql`
    DELETE FROM api_keys WHERE id = ${keyId} AND user_id = ${userId}
  `;
  return (rowCount ?? 0) > 0;
}

// --- Auth middleware ---

export type AuthInfo = {
  userId: string;
  workspace: string;
  authType: "jwt" | "api_key";
};

export async function requireAuth(request: NextRequest): Promise<AuthInfo> {
  const authHeader = request.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    throw new AuthError("Missing or invalid Authorization header", 401);
  }

  const token = authHeader.slice(7);

  // Try API key first
  if (token.startsWith("agentfs_")) {
    const keyInfo = await validateApiKey(token);
    if (!keyInfo) throw new AuthError("Invalid API key", 401);
    return { userId: keyInfo.user_id, workspace: keyInfo.workspace, authType: "api_key" };
  }

  // Try JWT
  const userId = await decodeToken(token);
  if (!userId) throw new AuthError("Invalid or expired token", 401);
  const user = await getUser(userId);
  if (!user) throw new AuthError("User not found", 401);
  return { userId, workspace: "default", authType: "jwt" };
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

export function safeUser(user: Record<string, unknown>) {
  const { password_hash, ...safe } = user;
  return safe;
}
