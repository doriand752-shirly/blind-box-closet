/**
 * Print the App Store listing state of the app: versions, localizations,
 * screenshots, categories, age rating, pricing, availability, review details.
 *
 *   node scripts/asc-store-status.mjs
 */
import { APP_ID, createAsc, errorText } from "./lib/asc-client.mjs";

const asc = await createAsc();

function show(label, res, pick) {
  if (!res.ok) {
    console.log(`\n## ${label} -> ${res.status}\n${errorText(res.j)}`);
    return;
  }
  console.log(`\n## ${label}`);
  console.log(JSON.stringify(pick ? pick(res.j) : res.j.data, null, 2));
}

const app = await asc("GET", `/v1/apps/${APP_ID}`);
show("app", app, (j) => j.data.attributes);

const versions = await asc(
  "GET",
  `/v1/apps/${APP_ID}/appStoreVersions?limit=10&include=build`,
);
show("appStoreVersions", versions, (j) =>
  j.data.map((v) => ({
    id: v.id,
    ...v.attributes,
    build: v.relationships?.build?.data?.id || null,
  })),
);

for (const v of versions.j.data || []) {
  const locs = await asc("GET", `/v1/appStoreVersions/${v.id}/appStoreVersionLocalizations?limit=50`);
  show(`version ${v.attributes.versionString} localizations`, locs, (j) =>
    j.data.map((l) => ({ id: l.id, ...l.attributes })),
  );
  for (const l of locs.j.data || []) {
    const sets = await asc(
      "GET",
      `/v1/appStoreVersionLocalizations/${l.id}/appScreenshotSets?include=appScreenshots&limit=50`,
    );
    show(`screenshots ${l.attributes.locale}`, sets, (j) =>
      j.data.map((s) => ({
        id: s.id,
        type: s.attributes.screenshotDisplayType,
        count: s.relationships?.appScreenshots?.data?.length ?? 0,
      })),
    );
  }
  const review = await asc("GET", `/v1/appStoreVersions/${v.id}/appStoreReviewDetail`);
  show(`version ${v.attributes.versionString} review detail`, review, (j) =>
    j.data ? { id: j.data.id, ...j.data.attributes } : null,
  );
}

const infos = await asc(
  "GET",
  `/v1/apps/${APP_ID}/appInfos?include=primaryCategory,secondaryCategory,ageRatingDeclaration&limit=10`,
);
show("appInfos", infos, (j) =>
  j.data.map((i) => ({
    id: i.id,
    ...i.attributes,
    primaryCategory: i.relationships?.primaryCategory?.data?.id || null,
    secondaryCategory: i.relationships?.secondaryCategory?.data?.id || null,
  })),
);
for (const i of infos.j.data || []) {
  const locs = await asc("GET", `/v1/appInfos/${i.id}/appInfoLocalizations?limit=50`);
  show(`appInfo ${i.id} localizations`, locs, (j) =>
    j.data.map((l) => ({ id: l.id, ...l.attributes })),
  );
  const age = await asc("GET", `/v1/appInfos/${i.id}/ageRatingDeclaration`);
  show(`appInfo ${i.id} age rating`, age, (j) => (j.data ? { id: j.data.id, ...j.data.attributes } : null));
}

const price = await asc(
  "GET",
  `/v1/apps/${APP_ID}/appPriceSchedule?include=manualPrices,baseTerritory`,
);
show("price schedule", price, (j) => ({
  baseTerritory: j.data?.relationships?.baseTerritory?.data?.id || null,
  manualPrices: (j.included || []).filter((x) => x.type === "appPrices").map((x) => x.attributes),
}));

const avail = await asc("GET", `/v1/apps/${APP_ID}/appAvailabilityV2`);
show("availability", avail, (j) => (j.data ? { id: j.data.id, ...j.data.attributes } : null));

const betaReview = await asc("GET", `/v1/apps/${APP_ID}/betaAppReviewDetail`);
show("beta review detail", betaReview, (j) => (j.data ? j.data.attributes : null));

const subs = await asc("GET", `/v1/apps/${APP_ID}/reviewSubmissions?limit=10`);
show("review submissions", subs, (j) => j.data.map((s) => ({ id: s.id, ...s.attributes })));
