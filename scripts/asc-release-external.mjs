/**
 * Make one TestFlight build available to the external tester groups.
 *
 *   node scripts/asc-release-external.mjs <buildNumber>
 *
 * Links the build to every external beta group of the app and submits it for
 * beta app review if it has no submission yet. Does nothing unless the build
 * is VALID, so it is safe to run while Apple is still processing.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const APP_ID = "6832878229";
const APPY_BUNDLE = "com.appigeek.reader";
const PROJECT_ID = "7efd1549-548c-45a9-aede-4603bb6efab0";
const ASC = "https://api.appstoreconnect.apple.com/v1";
const EXPO = "https://api.expo.dev/graphql";

const buildNumber = process.argv[2];
if (!buildNumber) {
  console.error("Usage: node scripts/asc-release-external.mjs <buildNumber>");
  process.exit(2);
}

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
async function asc(t, m, p, body) {
  const r = await fetch(ASC + p, {
    method: m,
    headers: {
      Authorization: "Bearer " + t,
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
    j = { raw: text?.slice(0, 800) };
  }
  return { status: r.status, ok: r.ok, j };
}
function err(j) {
  return (
    (j.errors || []).map((e) => `${e.code}: ${e.detail || e.title}`).join("\n") ||
    JSON.stringify(j).slice(0, 800)
  );
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
  "GET",
  `/builds?filter[app]=${APP_ID}&filter[version]=${encodeURIComponent(buildNumber)}&limit=5`,
);
const build = (builds.j.data || []).find((b) => b.attributes?.version === buildNumber);
if (!build) {
  console.log(`BUILD ${buildNumber}: not on App Store Connect yet`);
  process.exit(1);
}
const procState = build.attributes?.processingState;
console.log("BUILD", buildNumber, build.id, procState, "expired:", build.attributes?.expired);
if (procState !== "VALID") {
  console.log("Not VALID yet, nothing done.");
  process.exit(1);
}

const groups = await asc(token, "GET", `/apps/${APP_ID}/betaGroups?limit=50`);
if (!groups.ok) throw new Error(err(groups.j));
const external = (groups.j.data || []).filter((g) => !g.attributes?.isInternalGroup);
if (!external.length) {
  console.log("No external beta group on this app.");
  process.exit(1);
}

for (const g of external) {
  const link = await asc(token, "POST", `/betaGroups/${g.id}/relationships/builds`, {
    data: [{ type: "builds", id: build.id }],
  });
  const testers = await asc(
    token,
    "GET",
    `/betaGroups/${g.id}/betaTesters?limit=100&fields[betaTesters]=email,state`,
  );
  console.log(
    "GROUP",
    g.attributes?.name,
    "| link:",
    link.ok || link.status === 409 ? "ok" : `${link.status} ${err(link.j)}`,
    "| testers:",
    (testers.j.data || []).map((t) => `${t.attributes?.email} (${t.attributes?.state})`),
  );
}

const existing = await asc(token, "GET", `/builds/${build.id}/betaAppReviewSubmission`);
if (existing.j.data) {
  console.log("REVIEW existing:", existing.j.data.attributes?.betaReviewState);
} else {
  const sub = await asc(token, "POST", "/betaAppReviewSubmissions", {
    data: {
      type: "betaAppReviewSubmissions",
      relationships: { build: { data: { type: "builds", id: build.id } } },
    },
  });
  console.log(
    "REVIEW submit:",
    sub.status,
    sub.ok ? sub.j.data?.attributes?.betaReviewState : err(sub.j),
  );
}

const detail = await asc(token, "GET", `/builds/${build.id}/buildBetaDetail`);
console.log(
  "BETA_DETAIL",
  detail.j.data?.attributes
    ? {
        internal: detail.j.data.attributes.internalBuildState,
        external: detail.j.data.attributes.externalBuildState,
        autoNotify: detail.j.data.attributes.autoNotifyEnabled,
      }
    : err(detail.j),
);
