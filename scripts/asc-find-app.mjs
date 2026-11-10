import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const APPY_PROJECT_ID = "7efd1549-548c-45a9-aede-4603bb6efab0";
const APPY_BUNDLE = "com.appigeek.reader";
const BUNDLE_ID = "com.blindboxcloset.app";
const ASC = "https://api.appstoreconnect.apple.com/v1";
const EXPO = "https://api.expo.dev/graphql";

function b64url(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function jwt(keyP8, keyId, issuerId) {
  const header = { alg: "ES256", kid: keyId, typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: issuerId, iat: now, exp: now + 1200, aud: "appstoreconnect-v1" };
  const u = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const s = crypto.createSign("SHA256");
  s.update(u);
  s.end();
  return `${u}.${b64url(s.sign({ key: keyP8, dsaEncoding: "ieee-p1363" }))}`;
}
async function gql(ss, query, variables = {}) {
  const r = await fetch(EXPO, {
    method: "POST",
    headers: { "Content-Type": "application/json", "expo-session": ss },
    body: JSON.stringify({ query, variables }),
  });
  const j = await r.json();
  if (j.errors?.length) throw new Error(JSON.stringify(j.errors));
  return j.data;
}

const state = JSON.parse(
  fs.readFileSync(path.join(process.env.USERPROFILE, ".expo", "state.json"), "utf8"),
);
const ss = state.auth.sessionSecret;
const data = await gql(
  ss,
  `query($appId:String!){
    app{byId(appId:$appId){
      iosAppCredentials{
        appleAppIdentifier{bundleIdentifier}
        appStoreConnectApiKeyForSubmissions{id}
      }
    }}
  }`,
  { appId: APPY_PROJECT_ID },
);
const creds = data.app.byId.iosAppCredentials ?? [];
const match =
  creds.find((c) => c.appleAppIdentifier?.bundleIdentifier === APPY_BUNDLE) ||
  creds.find((c) => c.appStoreConnectApiKeyForSubmissions);
const full = await gql(
  ss,
  `query($id:ID!){appStoreConnectApiKey{byId(id:$id){keyIdentifier issuerIdentifier keyP8}}}`,
  { id: match.appStoreConnectApiKeyForSubmissions.id },
);
const key = full.appStoreConnectApiKey.byId;
const token = jwt(key.keyP8, key.keyIdentifier, key.issuerIdentifier);

const apps = await fetch(
  `${ASC}/apps?filter[bundleId]=${encodeURIComponent(BUNDLE_ID)}`,
  { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } },
).then((r) => r.json());

if (apps.data?.[0]) {
  console.log("FOUND", apps.data[0].id, apps.data[0].attributes?.name);
} else {
  console.log("NOT_FOUND");
  const all = await fetch(`${ASC}/apps?limit=50`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  }).then((r) => r.json());
  for (const a of all.data || []) {
    console.log("-", a.id, a.attributes?.bundleId, a.attributes?.name);
  }
}
