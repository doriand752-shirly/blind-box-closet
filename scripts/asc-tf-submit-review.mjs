/**
 * Ensure Blind Box Closet build is submitted for external TestFlight review.
 */
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
    JSON.stringify(j).slice(0, 1000)
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
  `/builds?filter[app]=${APP_ID}&sort=-uploadedDate&limit=5`,
);
const build = (builds.j.data || []).find((b) => b.attributes?.processingState === "VALID");
if (!build) {
  console.log("No VALID build yet", builds.j.data?.map((b) => b.attributes));
  process.exit(0);
}
console.log("BUILD", build.id, build.attributes?.version, build.attributes?.processingState);

// Beta license agreement / localization
const locs = await asc(token, "GET", `/apps/${APP_ID}/betaAppLocalizations`);
console.log(
  "BETA_LOCS",
  locs.status,
  (locs.j.data || []).map((l) => l.attributes?.locale),
);
if (!(locs.j.data || []).length) {
  const created = await asc(token, "POST", "/betaAppLocalizations", {
    data: {
      type: "betaAppLocalizations",
      attributes: {
        locale: "fr-FR",
        description:
          "Blind Box Closet — suivi de collection Smiski. App indépendante, non affiliée à Dreams Inc.",
        feedbackEmail: "dorian172@outlook.com",
        privacyPolicyUrl: "https://appigeek.github.io/blind-box-closet/privacy.html",
      },
      relationships: { app: { data: { type: "apps", id: APP_ID } } },
    },
  });
  console.log("CREATE_LOC", created.status, created.ok ? "ok" : err(created.j));
}

const reviewDetails = await asc(token, "GET", `/apps/${APP_ID}/betaAppReviewDetail`);
console.log("REVIEW_DETAIL", reviewDetails.status, reviewDetails.j.data?.attributes || err(reviewDetails.j));
if (reviewDetails.j.data?.id) {
  const patch = await asc(token, "PATCH", `/betaAppReviewDetails/${reviewDetails.j.data.id}`, {
    data: {
      type: "betaAppReviewDetails",
      id: reviewDetails.j.data.id,
      attributes: {
        contactFirstName: "Dorian",
        contactLastName: "David",
        contactEmail: "dorian172@outlook.com",
        contactPhone: "+33600000000",
        notes:
          "Sign in with Apple is optional. Use Continuer sans compte. Independent collector app, not affiliated with Dreams Inc.",
      },
    },
  });
  console.log("PATCH_REVIEW", patch.status, patch.ok ? "ok" : err(patch.j));
}

const existingSub = await asc(token, "GET", `/builds/${build.id}/betaAppReviewSubmission`);
console.log(
  "EXISTING_SUB",
  existingSub.status,
  existingSub.j.data?.attributes || existingSub.j.errors?.[0]?.detail || "none",
);

if (!existingSub.j.data) {
  const sub = await asc(token, "POST", "/betaAppReviewSubmissions", {
    data: {
      type: "betaAppReviewSubmissions",
      relationships: {
        build: { data: { type: "builds", id: build.id } },
      },
    },
  });
  console.log("SUBMIT_REVIEW", sub.status, sub.ok ? sub.j.data?.attributes : err(sub.j));
} else {
  console.log("Already submitted");
}
