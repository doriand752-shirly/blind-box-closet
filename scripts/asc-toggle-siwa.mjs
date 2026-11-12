/**
 * Apple backend sometimes loses the App ID ↔ SIWA registration (akd -6003 /
 * "No applications were found with the provided Client ID") even when the
 * portal capability and the IPA entitlement look correct.
 *
 * Workaround used by many teams: remove APPLE_ID_AUTH, re-add it as PRIMARY,
 * delete App Store profiles so the next build regenerates a fresh one.
 */
import { createAsc, errorText, BUNDLE_ID } from "./lib/asc-client.mjs";

const asc = await createAsc();

const bundles = await asc(
  "GET",
  `/v1/bundleIds?filter[identifier]=${encodeURIComponent(BUNDLE_ID)}&include=bundleIdCapabilities`,
);
if (!bundles.ok) throw new Error(errorText(bundles.j));
const bundle = bundles.j.data?.[0];
if (!bundle) throw new Error("bundle id not found");
console.log("bundle", bundle.id, bundle.attributes.identifier);

const caps =
  bundles.j.included?.filter((x) => x.type === "bundleIdCapabilities") || [];
const siwa = caps.find((c) => c.attributes?.capabilityType === "APPLE_ID_AUTH");
console.log("current SIWA", siwa?.id, JSON.stringify(siwa?.attributes?.settings));

if (siwa) {
  const del = await asc("DELETE", `/v1/bundleIdCapabilities/${siwa.id}`);
  console.log("DELETE SIWA", del.status, del.ok ? "ok" : errorText(del.j));
  // Portal needs a beat before re-create.
  await new Promise((r) => setTimeout(r, 2500));
} else {
  console.log("SIWA already absent — will create");
}

const create = await asc("POST", "/v1/bundleIdCapabilities", {
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
      bundleId: { data: { type: "bundleIds", id: bundle.id } },
    },
  },
});
console.log(
  "CREATE SIWA",
  create.status,
  create.ok ? create.j.data?.id : errorText(create.j),
);

// Delete App Store profiles tied to this bundle so CI regenerates clean ones.
const profiles = await asc(
  "GET",
  `/v1/profiles?filter[profileType]=IOS_APP_STORE&filter[profileState]=ACTIVE&limit=50`,
);
if (!profiles.ok) throw new Error(errorText(profiles.j));

let deleted = 0;
for (const p of profiles.j.data || []) {
  const rel = await asc("GET", `/v1/profiles/${p.id}/bundleId`);
  if (rel.j.data?.attributes?.identifier !== BUNDLE_ID) continue;
  const d = await asc("DELETE", `/v1/profiles/${p.id}`);
  console.log("DELETE profile", p.attributes?.name, d.status, d.ok ? "ok" : errorText(d.j));
  if (d.ok) deleted += 1;
}
console.log("deleted profiles", deleted);

const verify = await asc(
  "GET",
  `/v1/bundleIds?filter[identifier]=${encodeURIComponent(BUNDLE_ID)}&include=bundleIdCapabilities`,
);
const vcaps =
  verify.j.included?.filter((x) => x.type === "bundleIdCapabilities") || [];
console.log(
  "after",
  vcaps.map((c) => ({
    type: c.attributes?.capabilityType,
    settings: c.attributes?.settings,
  })),
);
