import { createAsc, errorText } from "./lib/asc-client.mjs";

const asc = await createAsc();
const certs = await asc(
  "GET",
  "/v1/certificates?limit=200&fields[certificates]=name,certificateType,displayName,expirationDate,serialNumber",
);
if (!certs.ok) {
  console.error(errorText(certs.j));
  process.exit(1);
}
for (const c of certs.j.data || []) {
  console.log(
    JSON.stringify({
      id: c.id,
      type: c.attributes.certificateType,
      name: c.attributes.name,
      display: c.attributes.displayName,
      exp: c.attributes.expirationDate,
    }),
  );
}

const profiles = await asc(
  "GET",
  "/v1/profiles?limit=200&fields[profiles]=name,profileType,profileState,expirationDate",
);
console.log("\nPROFILES");
for (const p of profiles.j.data || []) {
  console.log(
    JSON.stringify({
      id: p.id,
      type: p.attributes.profileType,
      name: p.attributes.name,
      state: p.attributes.profileState,
      exp: p.attributes.expirationDate,
    }),
  );
}
