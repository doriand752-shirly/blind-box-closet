import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";
import type { FastifyRequest } from "fastify";
import { query } from "./db";

const scrypt = promisify(scryptCb);

export type AuthUser = {
  id: string;
  apple_sub: string;
  email: string | null;
  display_name: string | null;
  is_admin: boolean;
};

type AuthUserRow = AuthUser & { password_hash?: string | null };

function emailAppleSub(email: string) {
  return `email:${email}`;
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt.toString("base64")}$${derived.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [algo, saltB64, hashB64] = stored.split("$");
  if (algo !== "scrypt" || !saltB64 || !hashB64) return false;
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(hashB64, "base64");
  const actual = (await scrypt(password, salt, expected.length)) as Buffer;
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export function normalizeEmail(raw: string) {
  return raw.trim().toLowerCase();
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const APPLE_ISSUER = "https://appleid.apple.com";
const appleJwks = createRemoteJWKSet(
  new URL("https://appleid.apple.com/auth/keys"),
);

function getJwtSecret() {
  const secret = process.env.JWT_SECRET || "dev-blind-box-closet-secret-change-me";
  return new TextEncoder().encode(secret);
}

export async function verifyAppleIdentityToken(identityToken: string) {
  const audience =
    process.env.APPLE_CLIENT_ID || "com.blindboxcloset.app";
  const { payload } = await jwtVerify(identityToken, appleJwks, {
    issuer: APPLE_ISSUER,
    audience,
  });
  if (!payload.sub) throw new Error("Missing Apple subject");
  return {
    sub: payload.sub,
    email: typeof payload.email === "string" ? payload.email : null,
  };
}

export async function signAppToken(user: AuthUser) {
  return new SignJWT({
    sub: user.id,
    apple_sub: user.apple_sub,
    is_admin: user.is_admin,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getJwtSecret());
}

export async function verifyAppToken(token: string) {
  const { payload } = await jwtVerify(token, getJwtSecret());
  if (!payload.sub || typeof payload.sub !== "string") {
    throw new Error("Invalid token");
  }
  return {
    id: payload.sub,
    apple_sub: String(payload.apple_sub || ""),
    is_admin: Boolean(payload.is_admin),
  };
}

const ADMIN_EMAILS = (
  process.env.ADMIN_EMAILS || "doriandood.pro@gmail.com"
)
  .split(",")
  .map((e: string) => e.trim().toLowerCase())
  .filter(Boolean);

/** Optional extra allow-list by Apple subject (stable even with a private relay email). */
const ADMIN_APPLE_SUBS = (process.env.ADMIN_APPLE_SUBS || "")
  .split(",")
  .map((e: string) => e.trim())
  .filter(Boolean);

export async function upsertAppleUser(input: {
  appleSub: string;
  email: string | null;
  displayName?: string | null;
}) {
  const email = input.email?.toLowerCase() || null;
  // Admin = Dorian only, matched on the verified Apple email / subject (never on a spoofable display name).
  const shouldAdmin =
    (email ? ADMIN_EMAILS.includes(email) : false) ||
    ADMIN_APPLE_SUBS.includes(input.appleSub);

  const existing = await query<AuthUser>(
    `SELECT id, apple_sub, email, display_name, is_admin FROM users WHERE apple_sub = $1`,
    [input.appleSub],
  );

  if (existing.rows[0]) {
    const row = existing.rows[0];
    const isAdmin = row.is_admin || shouldAdmin;
    const updated = await query<AuthUser>(
      `UPDATE users
       SET email = COALESCE($2, email),
           display_name = COALESCE($3, display_name),
           is_admin = $4,
           updated_at = now()
       WHERE id = $1
       RETURNING id, apple_sub, email, display_name, is_admin`,
      [row.id, email, input.displayName || null, isAdmin],
    );
    return updated.rows[0];
  }

  const inserted = await query<AuthUser>(
    `INSERT INTO users (apple_sub, email, display_name, is_admin)
     VALUES ($1, $2, $3, $4)
     RETURNING id, apple_sub, email, display_name, is_admin`,
    [input.appleSub, email, input.displayName || null, shouldAdmin],
  );
  return inserted.rows[0];
}

export async function registerEmailUser(input: {
  email: string;
  password: string;
  displayName?: string | null;
}) {
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) {
    throw Object.assign(new Error("Invalid email"), { statusCode: 400 });
  }
  if (input.password.length < 8) {
    throw Object.assign(new Error("Password must be at least 8 characters"), {
      statusCode: 400,
    });
  }

  const appleSub = emailAppleSub(email);
  const existing = await query<AuthUserRow>(
    `SELECT id, apple_sub, email, display_name, is_admin, password_hash
     FROM users
     WHERE apple_sub = $1 OR lower(email) = $2`,
    [appleSub, email],
  );
  if (existing.rows[0]) {
    throw Object.assign(new Error("Account already exists"), { statusCode: 409 });
  }

  const passwordHash = await hashPassword(input.password);
  const shouldAdmin = ADMIN_EMAILS.includes(email);
  const displayName =
    input.displayName?.trim() || email.split("@")[0] || "Collector";

  const inserted = await query<AuthUser>(
    `INSERT INTO users (apple_sub, email, display_name, password_hash, is_admin)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, apple_sub, email, display_name, is_admin`,
    [appleSub, email, displayName, passwordHash, shouldAdmin],
  );
  return inserted.rows[0];
}

export async function loginEmailUser(input: {
  email: string;
  password: string;
}) {
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email) || !input.password) {
    throw Object.assign(new Error("Invalid email or password"), {
      statusCode: 401,
    });
  }

  const appleSub = emailAppleSub(email);
  const found = await query<AuthUserRow>(
    `SELECT id, apple_sub, email, display_name, is_admin, password_hash
     FROM users
     WHERE (apple_sub = $1 OR lower(email) = $2)
       AND password_hash IS NOT NULL
     LIMIT 1`,
    [appleSub, email],
  );
  const row = found.rows[0];
  if (!row?.password_hash) {
    throw Object.assign(new Error("Invalid email or password"), {
      statusCode: 401,
    });
  }

  const ok = await verifyPassword(input.password, row.password_hash);
  if (!ok) {
    throw Object.assign(new Error("Invalid email or password"), {
      statusCode: 401,
    });
  }

  const shouldAdmin =
    (row.email ? ADMIN_EMAILS.includes(row.email.toLowerCase()) : false) ||
    ADMIN_APPLE_SUBS.includes(row.apple_sub);
  if (shouldAdmin && !row.is_admin) {
    const updated = await query<AuthUser>(
      `UPDATE users SET is_admin = true, updated_at = now()
       WHERE id = $1
       RETURNING id, apple_sub, email, display_name, is_admin`,
      [row.id],
    );
    return updated.rows[0];
  }

  return {
    id: row.id,
    apple_sub: row.apple_sub,
    email: row.email,
    display_name: row.display_name,
    is_admin: row.is_admin,
  };
}

export async function requireUser(request: FastifyRequest): Promise<AuthUser> {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw Object.assign(new Error("Unauthorized"), { statusCode: 401 });
  }
  const token = header.slice(7);
  const decoded = await verifyAppToken(token);
  const result = await query<AuthUser>(
    `SELECT id, apple_sub, email, display_name, is_admin FROM users WHERE id = $1`,
    [decoded.id],
  );
  if (!result.rows[0]) {
    throw Object.assign(new Error("Unauthorized"), { statusCode: 401 });
  }
  return result.rows[0];
}

export async function requireAdmin(request: FastifyRequest): Promise<AuthUser> {
  const user = await requireUser(request);
  if (!user.is_admin) {
    throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
  }
  return user;
}
