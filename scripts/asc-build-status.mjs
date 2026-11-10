import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const APP_ID = "6832878229";
const APPY_BUNDLE = "com.appigeek.reader";
const PROJECT_ID = "7efd1549-548c-45a9-aede-4603bb6efab0";
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
async function gql(ss, q, v = {}) {
  const r = await fetch(EXPO, {
    method: "POST",
    headers: { "Content-Type": "application/json", "expo-session": ss },
    body: JSON.stringify({ query: q, variables: v }),
  });
  const j = await r.json();
  if (j.errors?.length) throw new Error(JSON.stringify(j.errors));
  return j.data;
}
async function asc(t, p) {
  const r = await fetch(ASC + p, {
    headers: { Authorization: "Bearer " + t, Accept: "application/json" },
  });
  return r.json();
}

const state = JSON.parse(
  fs.readFileSync(path.join(process.env.USERPROFILE, ".expo", "state.json"), "utf8"),
);
const data = await gql(
  state.auth.sessionSecret,
  `query($appId:String!){app{byId(appId:$appId){iosAppCredentials{appleAppIdentifier{bundleIdentifier}appStoreConnectApiKeyForSubmissions{id}}}}}`,
  { appId: PROJECT_ID },
);
const creds = data.app.byId.iosAppCredentials ?? [];
const match =
  creds.find((c) => c.appleAppIdentifier?.bundleIdentifier === APPY_BUNDLE) ||
  creds.find((c) => c.appStoreConnectApiKeyForSubmissions);
const full = await gql(
  state.auth.sessionSecret,
  `query($id:ID!){appStoreConnectApiKey{byId(id:$id){keyIdentifier issuerIdentifier keyP8}}}`,
  { id: match.appStoreConnectApiKeyForSubmissions.id },
);
const key = full.appStoreConnectApiKey.byId;
const token = jwt(key.keyP8, key.keyIdentifier, key.issuerIdentifier);

const builds = await asc(
  token,
  `/builds?filter[app]=${APP_ID}&sort=-uploadedDate&limit=10`,
);
if (!builds.data?.length) {
  console.log("No ASC builds yet", JSON.stringify(builds.errors || builds));
}
for (const b of builds.data || []) {
  const a = b.attributes || {};
  console.log(
    `ASC buildNumber=${a.version} | state=${a.processingState} | expired=${a.expired} | uploaded=${a.uploadedDate} | id=${b.id}`,
  );
  const sub = await asc(token, `/builds/${b.id}/betaAppReviewSubmission`);
  if (sub.data) {
    console.log(`  betaReview: ${sub.data.attributes?.betaReviewState}`);
  } else if (sub.errors) {
    console.log(`  betaReview: ${sub.errors[0]?.detail || "none"}`);
  }
}
