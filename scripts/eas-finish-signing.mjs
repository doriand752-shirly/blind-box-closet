/**
 * Create ASC App Store provisioning profile for Blind Box Closet,
 * upload to EAS, and attach dist cert + profile to build credentials.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const APPY_PROJECT_ID = "7efd1549-548c-45a9-aede-4603bb6efab0";
const APPY_BUNDLE = "com.appigeek.reader";
const BBC_BUNDLE = "com.blindboxcloset.app";
const CRED_ID = "14dec1c9-5e96-4920-815f-9959419c68b4";
const DIST_CERT_ID = "f812b1b5-23be-454b-83d0-52bc4a2f78db";
const IDENTIFIER_ID = "71b4cda9-2bf6-44c3-a682-a089fd399dee";
const ACCOUNT_ID = "a3cf6400-01cf-4257-8e97-bc8e5b4679c7";
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
  if (j.errors?.length) throw new Error(JSON.stringify(j.errors, null, 2));
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

async function main() {
  const state = JSON.parse(
    fs.readFileSync(path.join(process.env.USERPROFILE, ".expo", "state.json"), "utf8"),
  );
  const ss = state.auth.sessionSecret;

  const appy = await gql(
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
  const match =
    appy.app.byId.iosAppCredentials.find(
      (c) => c.appleAppIdentifier?.bundleIdentifier === APPY_BUNDLE,
    ) || appy.app.byId.iosAppCredentials.find((c) => c.appStoreConnectApiKeyForSubmissions);
  const full = await gql(
    ss,
    `query($id:ID!){appStoreConnectApiKey{byId(id:$id){keyIdentifier issuerIdentifier keyP8}}}`,
    { id: match.appStoreConnectApiKeyForSubmissions.id },
  );
  const key = full.appStoreConnectApiKey.byId;
  const token = jwt(key.keyP8, key.keyIdentifier, key.issuerIdentifier);

  // Bundle id in ASC
  const bundles = await asc(
    token,
    "GET",
    `/bundleIds?filter[identifier]=${encodeURIComponent(BBC_BUNDLE)}`,
  );
  const bundleId = bundles.data[0].id;
  console.log("ASC bundle", bundleId);

  // Enable push? Not required. Enable Sign In with Apple with settings
  try {
    await asc(token, "POST", "/bundleIdCapabilities", {
      data: {
        type: "bundleIdCapabilities",
        attributes: {
          capabilityType: "APPLE_ID_AUTH",
          settings: [
            {
              key: "APPLE_ID_AUTH_APP_CONSENT",
              options: [{ key: "PRIMARY_APP_CONSENT" }],
            },
          ],
        },
        relationships: {
          bundleId: { data: { type: "bundleIds", id: bundleId } },
        },
      },
    });
    console.log("SIWA enabled");
  } catch (e) {
    console.warn("SIWA:", e.message.slice(0, 200));
  }

  // Certificates in ASC - find distribution cert matching our serial
  const certs = await asc(token, "GET", "/certificates?limit=50");
  const dist = (certs.data || []).find((c) =>
    String(c.attributes?.certificateType || "").includes("DISTRIBUTION"),
  );
  if (!dist) {
    console.log(
      "certs",
      (certs.data || []).map((c) => c.attributes?.certificateType),
    );
    throw new Error("No DISTRIBUTION certificate in ASC");
  }
  console.log("ASC dist cert", dist.id, dist.attributes?.serialNumber, dist.attributes?.certificateType);

  // Create profile
  const profileName = `Blind Box Closet AppStore ${Date.now()}`;
  let profile;
  try {
    profile = await asc(token, "POST", "/profiles", {
      data: {
        type: "profiles",
        attributes: {
          name: profileName,
          profileType: "IOS_APP_STORE",
        },
        relationships: {
          bundleId: { data: { type: "bundleIds", id: bundleId } },
          certificates: { data: [{ type: "certificates", id: dist.id }] },
        },
      },
    });
  } catch (e) {
    // maybe exists
    const existing = await asc(
      token,
      "GET",
      `/profiles?filter[profileType]=IOS_APP_STORE&filter[name]=${encodeURIComponent("Blind Box Closet")}&limit=10`,
    );
    console.warn("create profile failed", e.message.slice(0, 300));
    // list all and find by bundle
    const all = await asc(token, "GET", `/profiles?filter[profileType]=IOS_APP_STORE&limit=50`);
    for (const p of all.data || []) {
      const rel = await asc(token, "GET", `/profiles/${p.id}/bundleId`);
      if (rel.data?.attributes?.identifier === BBC_BUNDLE) {
        profile = { data: p };
        // need profileContent - fetch full
        const fullP = await asc(token, "GET", `/profiles/${p.id}`);
        profile = fullP;
        break;
      }
    }
    if (!profile) throw e;
  }

  const profileId = profile.data.id;
  const profileContent = profile.data.attributes?.profileContent;
  console.log("ASC profile", profileId, "hasContent", Boolean(profileContent));
  if (!profileContent) throw new Error("No profileContent");

  // Upload provisioning profile to EAS
  const uploaded = await gql(
    ss,
    `mutation($accountId:ID!, $appleAppIdentifierId:ID!, $appleProvisioningProfileInput:AppleProvisioningProfileInput!){
      appleProvisioningProfile{
        createAppleProvisioningProfile(
          accountId:$accountId
          appleAppIdentifierId:$appleAppIdentifierId
          appleProvisioningProfileInput:$appleProvisioningProfileInput
        ){
          id
        }
      }
    }`,
    {
      accountId: ACCOUNT_ID,
      appleAppIdentifierId: IDENTIFIER_ID,
      appleProvisioningProfileInput: {
        appleProvisioningProfile: profileContent,
      },
    },
  );
  const easProfileId = uploaded.appleProvisioningProfile.createAppleProvisioningProfile.id;
  console.log("EAS profile", easProfileId);

  // Optionally update appleAppIdentifier linkage - create build credentials
  const buildCreds = await gql(
    ss,
    `mutation($iosAppCredentialsId:ID!, $input:IosAppBuildCredentialsInput!){
      iosAppBuildCredentials{
        createIosAppBuildCredentials(iosAppCredentialsId:$iosAppCredentialsId, iosAppBuildCredentialsInput:$input){
          id
          iosDistributionType
          distributionCertificate{id}
          provisioningProfile{id}
        }
      }
    }`,
    {
      iosAppCredentialsId: CRED_ID,
      input: {
        iosDistributionType: "APP_STORE",
        distributionCertificateId: DIST_CERT_ID,
        provisioningProfileId: easProfileId,
      },
    },
  );
  console.log(JSON.stringify(buildCreds, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
