import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const APP_ID = "6832878229";
const PROJECT_ID = "7efd1549-548c-45a9-aede-4603bb6efab0";
const APPY_BUNDLE = "com.appigeek.reader";

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
  creds.find((c) => c.appleAppIdentifier?.bundleIdentifier === APPY_BUNDLE) ||
  creds.find((c) => c.appStoreConnectApiKeyForSubmissions);
const key = (
  await gql(
    `query($id:ID!){appStoreConnectApiKey{byId(id:$id){keyIdentifier issuerIdentifier keyP8}}}`,
    { id: match.appStoreConnectApiKeyForSubmissions.id },
  )
).appStoreConnectApiKey.byId;
const token = jwt(key.keyP8, key.keyIdentifier, key.issuerIdentifier);

const builds = await fetch(
  `https://api.appstoreconnect.apple.com/v1/builds?filter[app]=${APP_ID}&sort=-uploadedDate&limit=15&include=preReleaseVersion`,
  { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } },
).then((r) => r.json());

if (builds.errors) {
  console.error(JSON.stringify(builds.errors, null, 2));
  process.exit(1);
}

for (const b of builds.data || []) {
  const ver = (builds.included || []).find(
    (i) => i.type === "preReleaseVersions" && i.id === b.relationships?.preReleaseVersion?.data?.id,
  );
  console.log(
    JSON.stringify({
      buildNumber: b.attributes.version,
      marketingVersion: ver?.attributes?.version,
      processingState: b.attributes.processingState,
      uploadedDate: b.attributes.uploadedDate,
      expired: b.attributes.expired,
      id: b.id,
    }),
  );
}
