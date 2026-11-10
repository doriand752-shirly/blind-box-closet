/**
 * Add TestFlight beta testers to Blind Box Closet.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const APP_ID = "6832878229";
const APPY_BUNDLE = "com.appigeek.reader";
const PROJECT_ID = "7efd1549-548c-45a9-aede-4603bb6efab0";
const EMAILS = ["emmalaqueyrerie@gmail.com", "emmalaqueyrerie@icloud.com"];
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

// List / ensure external beta group
const groups = await asc(token, "GET", `/apps/${APP_ID}/betaGroups?limit=50`);
console.log(
  "GROUPS",
  groups.status,
  (groups.j.data || []).map((g) => ({
    id: g.id,
    name: g.attributes?.name,
    isInternal: g.attributes?.isInternalGroup,
    publicLinkEnabled: g.attributes?.publicLinkEnabled,
  })),
);

let external =
  (groups.j.data || []).find(
    (g) => !g.attributes?.isInternalGroup && /expo|external|test|team/i.test(g.attributes?.name || ""),
  ) || (groups.j.data || []).find((g) => !g.attributes?.isInternalGroup);

if (!external) {
  const created = await asc(token, "POST", "/betaGroups", {
    data: {
      type: "betaGroups",
      attributes: {
        name: "External Testers",
        isInternalGroup: false,
        publicLinkEnabled: false,
        feedbackEnabled: true,
      },
      relationships: {
        app: { data: { type: "apps", id: APP_ID } },
      },
    },
  });
  console.log("CREATE_GROUP", created.status, created.ok ? created.j.data?.id : err(created.j));
  if (!created.ok) throw new Error(err(created.j));
  external = created.j.data;
}

console.log("USING_GROUP", external.id, external.attributes?.name);

// Assign latest processed build to the group if needed
const builds = await asc(
  token,
  "GET",
  `/builds?filter[app]=${APP_ID}&sort=-uploadedDate&limit=5&fields[builds]=version,uploadedDate,processingState,expired`,
);
console.log(
  "BUILDS",
  (builds.j.data || []).map((b) => ({
    id: b.id,
    v: b.attributes?.version,
    state: b.attributes?.processingState,
    expired: b.attributes?.expired,
  })),
);
const build = (builds.j.data || []).find(
  (b) => b.attributes?.processingState === "VALID" && !b.attributes?.expired,
);
if (build) {
  const link = await asc(token, "POST", `/betaGroups/${external.id}/relationships/builds`, {
    data: [{ type: "builds", id: build.id }],
  });
  console.log(
    "LINK_BUILD",
    build.id,
    link.status,
    link.ok || link.status === 409 ? "ok" : err(link.j),
  );
}

for (const email of EMAILS) {
  const existing = await asc(
    token,
    "GET",
    `/betaTesters?filter[email]=${encodeURIComponent(email)}&limit=5`,
  );
  let testerId = existing.j.data?.[0]?.id;
  console.log(
    "EXISTING",
    email,
    existing.status,
    (existing.j.data || []).map((t) => t.id),
  );

  if (!testerId) {
    const created = await asc(token, "POST", "/betaTesters", {
      data: {
        type: "betaTesters",
        attributes: {
          email,
          firstName: "Emma",
          lastName: "Laqueyrerie",
        },
        relationships: {
          betaGroups: { data: [{ type: "betaGroups", id: external.id }] },
        },
      },
    });
    console.log(
      "CREATE_TESTER",
      email,
      created.status,
      created.ok ? created.j.data?.id : err(created.j),
    );
    testerId = created.j.data?.id;
  } else {
    const add = await asc(token, "POST", `/betaGroups/${external.id}/relationships/betaTesters`, {
      data: [{ type: "betaTesters", id: testerId }],
    });
    console.log("ADD_TO_GROUP", email, add.status, add.ok || add.status === 409 ? "ok" : err(add.j));
  }
}

console.log("DONE");
