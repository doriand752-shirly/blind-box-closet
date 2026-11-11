/**
 * Minimal App Store Connect API client shared by the asc-*.mjs scripts.
 *
 * The API key is the one Expo stores for this Apple team; it is fetched with
 * the local Expo session (~/.expo/state.json), so no secret lives in the repo.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const APP_ID = "6832878229";
export const BUNDLE_ID = "com.blindboxcloset.app";

const EXPO_PROJECT_ID = "7efd1549-548c-45a9-aede-4603bb6efab0";
const EXPO_KEY_BUNDLE = "com.appigeek.reader";
const ASC = "https://api.appstoreconnect.apple.com";
const EXPO = "https://api.expo.dev/graphql";

function b64url(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function signJwt(keyP8, keyId, issuerId) {
  const header = { alg: "ES256", kid: keyId, typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: issuerId, iat: now, exp: now + 1200, aud: "appstoreconnect-v1" };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const signer = crypto.createSign("SHA256");
  signer.update(unsigned);
  signer.end();
  return `${unsigned}.${b64url(signer.sign({ key: keyP8, dsaEncoding: "ieee-p1363" }))}`;
}

async function expoGql(session, query, variables = {}) {
  const r = await fetch(EXPO, {
    method: "POST",
    headers: { "Content-Type": "application/json", "expo-session": session },
    body: JSON.stringify({ query, variables }),
  });
  const j = await r.json();
  if (j.errors?.length) throw new Error(JSON.stringify(j.errors));
  return j.data;
}

async function loadToken() {
  const state = JSON.parse(
    fs.readFileSync(path.join(os.homedir(), ".expo", "state.json"), "utf8"),
  );
  const session = state.auth.sessionSecret;
  const data = await expoGql(
    session,
    `query($appId:String!){app{byId(appId:$appId){iosAppCredentials{appleAppIdentifier{bundleIdentifier}appStoreConnectApiKeyForSubmissions{id}}}}}`,
    { appId: EXPO_PROJECT_ID },
  );
  const creds = data.app.byId.iosAppCredentials ?? [];
  const match =
    creds.find((c) => c.appleAppIdentifier?.bundleIdentifier === EXPO_KEY_BUNDLE) ||
    creds.find((c) => c.appStoreConnectApiKeyForSubmissions);
  if (!match?.appStoreConnectApiKeyForSubmissions) {
    throw new Error("No App Store Connect API key found in the Expo account");
  }
  const full = await expoGql(
    session,
    `query($id:ID!){appStoreConnectApiKey{byId(id:$id){keyIdentifier issuerIdentifier keyP8}}}`,
    { id: match.appStoreConnectApiKeyForSubmissions.id },
  );
  const key = full.appStoreConnectApiKey.byId;
  return signJwt(key.keyP8, key.keyIdentifier, key.issuerIdentifier);
}

export function errorText(j) {
  return (
    (j?.errors || [])
      .map((e) => `${e.code}: ${e.detail || e.title}${e.source ? ` ${JSON.stringify(e.source)}` : ""}`)
      .join("\n") || JSON.stringify(j).slice(0, 1200)
  );
}

/** Returns `asc(method, path, body?)` → `{ status, ok, j }`. Path starts with /v1 or /v2. */
export async function createAsc() {
  const token = await loadToken();
  return async function asc(method, apiPath, body) {
    const url = apiPath.startsWith("http") ? apiPath : ASC + apiPath;
    const r = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await r.text();
    let j = {};
    try {
      j = text ? JSON.parse(text) : {};
    } catch {
      j = { raw: text.slice(0, 1200) };
    }
    return { status: r.status, ok: r.ok, j };
  };
}
