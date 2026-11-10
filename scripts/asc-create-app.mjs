/**
 * Create Blind Box Closet in App Store Connect using EAS-stored ASC API key
 * (same pattern as Appy Geek scripts).
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const APPY_PROJECT_ID = "7efd1549-548c-45a9-aede-4603bb6efab0";
const APPY_BUNDLE = "com.appigeek.reader";
const BUNDLE_ID = "com.blindboxcloset.app";
const APP_NAME = "Blind Box Closet";
const SKU = "blindboxcloset001";
const PRIMARY_LOCALE = "fr-FR";
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

async function asc(token, method, urlPath, body) {
  const r = await fetch(ASC + urlPath, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${urlPath} -> ${r.status} ${JSON.stringify(j)}`);
  return j;
}

async function getAscToken() {
  const state = JSON.parse(
    fs.readFileSync(path.join(process.env.USERPROFILE, ".expo", "state.json"), "utf8"),
  );
  const ss = state.sessionSecret || state.auth?.sessionSecret;
  if (!ss) throw new Error("Not logged into Expo CLI (missing ~/.expo/state.json session)");

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
  if (!match?.appStoreConnectApiKeyForSubmissions?.id) {
    throw new Error("No ASC API key found on Appy Geek EAS credentials");
  }
  const full = await gql(
    ss,
    `query($id:ID!){appStoreConnectApiKey{byId(id:$id){keyIdentifier issuerIdentifier keyP8}}}`,
    { id: match.appStoreConnectApiKeyForSubmissions.id },
  );
  const key = full.appStoreConnectApiKey.byId;
  return jwt(key.keyP8, key.keyIdentifier, key.issuerIdentifier);
}

function patchJson(file, mutator) {
  const obj = JSON.parse(fs.readFileSync(file, "utf8"));
  mutator(obj);
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + "\n");
}

async function main() {
  const token = await getAscToken();

  const bundles = await asc(
    token,
    "GET",
    `/bundleIds?filter[identifier]=${encodeURIComponent(BUNDLE_ID)}`,
  );
  let bundleIdRef = bundles.data?.[0]?.id;
  if (!bundleIdRef) {
    const created = await asc(token, "POST", "/bundleIds", {
      data: {
        type: "bundleIds",
        attributes: {
          identifier: BUNDLE_ID,
          name: APP_NAME,
          platform: "IOS",
        },
      },
    });
    bundleIdRef = created.data.id;
    console.log("Created bundle id", bundleIdRef);
  } else {
    console.log("Bundle id exists", bundleIdRef);
  }

  try {
    await asc(token, "POST", "/bundleIdCapabilities", {
      data: {
        type: "bundleIdCapabilities",
        attributes: { capabilityType: "APPLE_ID_AUTH" },
        relationships: {
          bundleId: { data: { type: "bundleIds", id: bundleIdRef } },
        },
      },
    });
    console.log("Enabled Sign in with Apple capability");
  } catch (e) {
    console.warn("Capability:", e.message);
  }

  const apps = await asc(
    token,
    "GET",
    `/apps?filter[bundleId]=${encodeURIComponent(BUNDLE_ID)}`,
  );
  let appId = apps.data?.[0]?.id;
  if (!appId) {
    const app = await asc(token, "POST", "/apps", {
      data: {
        type: "apps",
        attributes: {
          bundleId: BUNDLE_ID,
          name: APP_NAME,
          primaryLocale: PRIMARY_LOCALE,
          sku: SKU,
          platform: "IOS",
        },
      },
    });
    appId = app.data.id;
    console.log("Created app", appId);
  } else {
    console.log("App exists", appId, apps.data[0].attributes?.name);
  }

  patchJson(path.join(ROOT, "eas.json"), (obj) => {
    obj.submit = obj.submit || {};
    obj.submit.production = obj.submit.production || {};
    obj.submit.production.ios = obj.submit.production.ios || {};
    obj.submit.production.ios.ascAppId = String(appId);
  });
  console.log("Updated eas.json ascAppId =", appId);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
