/**
 * Patch App Store Connect / TestFlight contact fields to Dorian Dood.
 */
import { APP_ID, createAsc, errorText } from "./lib/asc-client.mjs";

const EMAIL = "doriandood.pro@gmail.com";
const FIRST = "Dorian";
const LAST = "Dood";

const asc = await createAsc();

const beta = await asc("GET", `/v1/apps/${APP_ID}/betaAppReviewDetail`);
if (!beta.ok || !beta.j.data?.id) {
  console.log("betaAppReviewDetail", beta.status, errorText(beta.j));
} else {
  const id = beta.j.data.id;
  const patch = await asc("PATCH", `/v1/betaAppReviewDetails/${id}`, {
    data: {
      type: "betaAppReviewDetails",
      id,
      attributes: {
        contactFirstName: FIRST,
        contactLastName: LAST,
        contactEmail: EMAIL,
      },
    },
  });
  console.log("beta review contact", patch.status, patch.ok ? "ok" : errorText(patch.j));
}

const locs = await asc("GET", `/v1/apps/${APP_ID}/betaAppLocalizations`);
for (const loc of locs.j.data || []) {
  const patch = await asc("PATCH", `/v1/betaAppLocalizations/${loc.id}`, {
    data: {
      type: "betaAppLocalizations",
      id: loc.id,
      attributes: { feedbackEmail: EMAIL },
    },
  });
  console.log(
    "beta loc",
    loc.attributes?.locale,
    patch.status,
    patch.ok ? "ok" : errorText(patch.j),
  );
}

const versions = await asc("GET", `/v1/apps/${APP_ID}/appStoreVersions?limit=5`);
for (const v of versions.j.data || []) {
  const detail = await asc("GET", `/v1/appStoreVersions/${v.id}/appStoreReviewDetail`);
  if (detail.j.data?.id) {
    const id = detail.j.data.id;
    const patch = await asc("PATCH", `/v1/appStoreReviewDetails/${id}`, {
      data: {
        type: "appStoreReviewDetails",
        id,
        attributes: {
          contactFirstName: FIRST,
          contactLastName: LAST,
          contactEmail: EMAIL,
        },
      },
    });
    console.log(
      "store review",
      v.attributes?.versionString,
      patch.status,
      patch.ok ? "ok" : errorText(patch.j),
    );
  } else {
    console.log("store review", v.attributes?.versionString, "none yet");
  }
}
