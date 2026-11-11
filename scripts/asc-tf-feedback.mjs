import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const APP_ID = "6832878229";
const PROJECT_ID = "5d07c67d-ecf3-49d1-9081-d91e72c296d0";
const BUNDLE = "com.blindboxcloset.app";

function b64url(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function jwt(keyP8, keyId, issuerId) {
  const header = { alg: "ES256", kid: keyId, typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const u = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify({ iss: issuerId, iat: now, exp: now + 1200, aud: "appstoreconnect-v1" }))}`;
  const s = crypto.createSign("SHA256");
  s.update(u);
  s.end();
  return `${u}.${b64url(s.sign({ key: keyP8, dsaEncoding: "ieee-p1363" }))}`;
}

const state = JSON.parse(
  fs.readFileSync(path.join(process.env.USERPROFILE, ".expo", "state.json"), "utf8"),
);
async function gql(query, variables = {}) {
  const r = await fetch("https://api.expo.dev/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json", "expo-session": state.auth.sessionSecret },
    body: JSON.stringify({ query, variables }),
  });
  const j = await r.json();
  if (j.errors?.length) throw new Error(JSON.stringify(j.errors));
  return j.data;
}

const data = await gql(
  `query($appId:String!){app{byId(appId:$appId){iosAppCredentials{appleAppIdentifier{bundleIdentifier}appStoreConnectApiKeyForSubmissions{id}}}}}`,
  { appId: PROJECT_ID },
);
const creds = data.app.byId.iosAppCredentials ?? [];
const match =
  creds.find((c) => c.appleAppIdentifier?.bundleIdentifier === BUNDLE) ||
  creds.find((c) => c.appStoreConnectApiKeyForSubmissions);
if (!match?.appStoreConnectApiKeyForSubmissions) {
  console.error("No ASC key for", BUNDLE);
  process.exit(1);
}
const key = (
  await gql(
    `query($id:ID!){appStoreConnectApiKey{byId(id:$id){keyIdentifier issuerIdentifier keyP8}}}`,
    { id: match.appStoreConnectApiKeyForSubmissions.id },
  )
).appStoreConnectApiKey.byId;
const token = jwt(key.keyP8, key.keyIdentifier, key.issuerIdentifier);
const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };

async function get(url) {
  const r = await fetch(url, { headers });
  const j = await r.json();
  return { status: r.status, j };
}

const endpoints = [
  `https://api.appstoreconnect.apple.com/v1/apps/${APP_ID}/customerReviews?sort=-createdDate&limit=50`,
  `https://api.appstoreconnect.apple.com/v1/betaFeedbackCrashSubmissions?filter[build.app]=${APP_ID}&limit=50`,
  `https://api.appstoreconnect.apple.com/v1/betaFeedbackScreenshotSubmissions?filter[build.app]=${APP_ID}&limit=50`,
];

for (const url of endpoints) {
  const { status, j } = await get(url);
  console.log("\n===", url.split("/v1/")[1].split("?")[0], status, "===");
  if (j.errors) console.log(JSON.stringify(j.errors, null, 2));
  else console.log(JSON.stringify(j.data?.slice?.(0, 20) ?? j, null, 2).slice(0, 8000));
}
