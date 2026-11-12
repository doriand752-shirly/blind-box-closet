import { createAsc, errorText, BUNDLE_ID } from "./lib/asc-client.mjs";

const asc = await createAsc();

const bundles = await asc(
  "GET",
  `/v1/bundleIds?filter[identifier]=${encodeURIComponent(BUNDLE_ID)}&include=bundleIdCapabilities`,
);
if (!bundles.ok) throw new Error(errorText(bundles.j));
const bundle = bundles.j.data?.[0];
if (!bundle) throw new Error("bundle id not found: " + BUNDLE_ID);
console.log("bundle", bundle.id, bundle.attributes);

const caps =
  bundles.j.included?.filter((x) => x.type === "bundleIdCapabilities") || [];
console.log(
  "capabilities",
  caps.map((c) => ({
    id: c.id,
    capabilityType: c.attributes?.capabilityType,
    settings: c.attributes?.settings,
  })),
);

const profiles = await asc(
  "GET",
  `/v1/profiles?filter[profileType]=IOS_APP_STORE&filter[profileState]=ACTIVE&limit=50`,
);
if (!profiles.ok) throw new Error(errorText(profiles.j));

for (const p of profiles.j.data || []) {
  const rel = await asc("GET", `/v1/profiles/${p.id}/bundleId`);
  const bid = rel.j.data?.attributes?.identifier;
  if (bid !== BUNDLE_ID) continue;
  console.log("profile", p.id, p.attributes?.name, p.attributes?.profileState);
  const profileB64 = p.attributes?.profileContent;
  if (!profileB64) continue;
  const buf = Buffer.from(profileB64, "base64");
  const text = buf.toString("utf8");
  const has =
    text.includes("com.apple.developer.applesignin") ||
    text.includes("applesignin");
  console.log("profile contains applesignin entitlement?", has);
  const m = text.match(/com\.apple\.developer\.applesignin[\s\S]{0,120}/);
  if (m) console.log("snippet", m[0].replace(/\0/g, " ").slice(0, 160));
}
