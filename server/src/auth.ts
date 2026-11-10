import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";
import type { FastifyRequest } from "fastify";
import { query } from "./db";

const APPLE_ISSUER = "https://appleid.apple.com";
const appleJwks = createRemoteJWKSet(
  new URL("https://appleid.apple.com/auth/keys"),
);

export type AuthUser = {
  id: string;
  apple_sub: string;
  email: string | null;
  display_name: string | null;
  is_admin: boolean;
};

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

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "dorian172@outlook.com")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export async function upsertAppleUser(input: {
  appleSub: string;
  email: string | null;
  displayName?: string | null;
}) {
  const email = input.email?.toLowerCase() || null;
  const shouldAdmin = email ? ADMIN_EMAILS.includes(email) : false;

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
