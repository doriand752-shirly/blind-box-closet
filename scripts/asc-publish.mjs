/**
 * Fill App Store Connect listing from store.config.json and submit for review.
 *
 *   node scripts/asc-publish.mjs            # metadata + screenshots (no submit)
 *   node scripts/asc-publish.mjs --submit   # also attach latest VALID build + submit
 *   node scripts/asc-publish.mjs --build 18 # attach a specific build number
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { APP_ID, createAsc, errorText } from "./lib/asc-client.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "store.config.json"), "utf8"));
const args = new Set(process.argv.slice(2));
const doSubmit = args.has("--submit");
const buildArgIdx = process.argv.indexOf("--build");
const wantedBuild = buildArgIdx >= 0 ? process.argv[buildArgIdx + 1] : null;

const VERSION_STRING = "1.1.5";
const COPYRIGHT = "2026 Dorian Dood";
const PRIVACY = "https://doriand752-shirly.github.io/blindboxcloset/privacy.html";
const MARKETING = "https://doriand752-shirly.github.io/blindboxcloset/";
const SUPPORT = "https://doriand752-shirly.github.io/blindboxcloset/support.html";

const asc = await createAsc();

async function must(label, res) {
  if (!res.ok) throw new Error(`${label}: ${res.status}\n${errorText(res.j)}`);
  return res.j;
}

function log(label, value) {
  console.log(`✓ ${label}`, value ?? "");
}

// --- Version -----------------------------------------------------------------
const versions = await must(
  "list versions",
  await asc("GET", `/v1/apps/${APP_ID}/appStoreVersions?limit=20`),
);
let version =
  versions.data.find(
    (v) =>
      v.attributes.versionString === VERSION_STRING &&
      ["PREPARE_FOR_SUBMISSION", "WAITING_FOR_REVIEW", "REJECTED", "METADATA_REJECTED", "DEVELOPER_REJECTED"].includes(
        v.attributes.appStoreState,
      ),
  ) ||
  versions.data.find((v) => v.attributes.appStoreState === "PREPARE_FOR_SUBMISSION");

if (!version || version.attributes.versionString !== VERSION_STRING) {
  // Edit existing prepare version's string if present, else create.
  if (version && version.attributes.appStoreState === "PREPARE_FOR_SUBMISSION") {
    const patched = await must(
      "patch version string",
      await asc("PATCH", `/v1/appStoreVersions/${version.id}`, {
        data: {
          type: "appStoreVersions",
          id: version.id,
          attributes: { versionString: VERSION_STRING, copyright: COPYRIGHT, releaseType: "AFTER_APPROVAL" },
        },
      }),
    );
    version = patched.data;
    log("version bumped", VERSION_STRING);
  } else {
    const created = await must(
      "create version",
      await asc("POST", "/v1/appStoreVersions", {
        data: {
          type: "appStoreVersions",
          attributes: {
            platform: "IOS",
            versionString: VERSION_STRING,
            copyright: COPYRIGHT,
            releaseType: "AFTER_APPROVAL",
          },
          relationships: { app: { data: { type: "apps", id: APP_ID } } },
        },
      }),
    );
    version = created.data;
    log("version created", VERSION_STRING);
  }
} else {
  await must(
    "patch copyright",
    await asc("PATCH", `/v1/appStoreVersions/${version.id}`, {
      data: {
        type: "appStoreVersions",
        id: version.id,
        attributes: { copyright: COPYRIGHT, releaseType: "AFTER_APPROVAL" },
      },
    }),
  );
  log("version ready", `${version.attributes.versionString} (${version.attributes.appStoreState})`);
}

const VERSION_ID = version.id;

// --- Localizations -----------------------------------------------------------
async function ensureVersionLocale(locale, info) {
  const locs = await must(
    `list locs ${locale}`,
    await asc("GET", `/v1/appStoreVersions/${VERSION_ID}/appStoreVersionLocalizations?limit=50`),
  );
  let loc = locs.data.find((l) => l.attributes.locale === locale);
  if (!loc) {
    const created = await must(
      `create loc ${locale}`,
      await asc("POST", "/v1/appStoreVersionLocalizations", {
        data: {
          type: "appStoreVersionLocalizations",
          attributes: { locale },
          relationships: { appStoreVersion: { data: { type: "appStoreVersions", id: VERSION_ID } } },
        },
      }),
    );
    loc = created.data;
  }
  const attrs = {
    description: info.description,
    keywords: info.keywords,
    marketingUrl: info.marketingUrl || MARKETING,
    supportUrl: info.supportUrl || SUPPORT,
  };
  if (info.promotionalText) attrs.promotionalText = info.promotionalText;
  // Required for updates after the first public release.
  if (info.whatsNew) attrs.whatsNew = info.whatsNew;
  const patch = await asc("PATCH", `/v1/appStoreVersionLocalizations/${loc.id}`, {
    data: { type: "appStoreVersionLocalizations", id: loc.id, attributes: attrs },
  });
  if (!patch.ok) throw new Error(`patch loc ${locale}: ${patch.status}\n${errorText(patch.j)}`);
  log(`locale ${locale}`, loc.id);
  return loc;
}

const frInfo = cfg.apple.info["fr-FR"];
const enInfo = cfg.apple.info["en-US"];
const frLoc = await ensureVersionLocale("fr-FR", frInfo);
const enLoc = await ensureVersionLocale("en-US", enInfo);

// --- App info: name/subtitle/privacy/categories ------------------------------
const infos = await must("appInfos", await asc("GET", `/v1/apps/${APP_ID}/appInfos?limit=5`));
const appInfo = infos.data[0];
const APP_INFO_ID = appInfo.id;

{
  const catRes = await asc("PATCH", `/v1/appInfos/${APP_INFO_ID}`, {
    data: {
      type: "appInfos",
      id: APP_INFO_ID,
      relationships: {
        primaryCategory: { data: { type: "appCategories", id: cfg.apple.categories.primary } },
        secondaryCategory: { data: { type: "appCategories", id: cfg.apple.categories.secondary } },
      },
    },
  });
  if (catRes.ok) {
    log("categories", `${cfg.apple.categories.primary} / ${cfg.apple.categories.secondary}`);
  } else {
    console.log(
      "! categories skipped",
      catRes.status,
      errorText(catRes.j).split("\n")[0] || "",
    );
  }
}

async function ensureAppInfoLocale(locale, name, subtitle) {
  const locs = await must(
    `appInfo locs`,
    await asc("GET", `/v1/appInfos/${APP_INFO_ID}/appInfoLocalizations?limit=50`),
  );
  let loc = locs.data.find((l) => l.attributes.locale === locale);
  if (!loc) {
    const created = await must(
      `create appInfo loc ${locale}`,
      await asc("POST", "/v1/appInfoLocalizations", {
        data: {
          type: "appInfoLocalizations",
          attributes: { locale, name, subtitle, privacyPolicyUrl: PRIVACY },
          relationships: { appInfo: { data: { type: "appInfos", id: APP_INFO_ID } } },
        },
      }),
    );
    loc = created.data;
  } else {
    const patch = await asc("PATCH", `/v1/appInfoLocalizations/${loc.id}`, {
      data: {
        type: "appInfoLocalizations",
        id: loc.id,
        attributes: { name, subtitle, privacyPolicyUrl: PRIVACY },
      },
    });
    if (!patch.ok) {
      console.log(
        `! appInfo ${locale} skipped`,
        patch.status,
        errorText(patch.j).split("\n")[0] || "",
      );
      return loc;
    }
  }
  log(`appInfo ${locale}`, `${name} — ${subtitle}`);
  return loc;
}

await ensureAppInfoLocale("fr-FR", frInfo.title, frInfo.subtitle);
await ensureAppInfoLocale("en-US", enInfo.title, enInfo.subtitle);

// --- Age rating --------------------------------------------------------------
const age = await must(
  "age get",
  await asc("GET", `/v1/appInfos/${APP_INFO_ID}/ageRatingDeclaration`),
);
const ageId = age.data.id;
{
  const agePatch = await asc("PATCH", `/v1/ageRatingDeclarations/${ageId}`, {
    data: {
      type: "ageRatingDeclarations",
      id: ageId,
      attributes: {
        alcoholTobaccoOrDrugUseOrReferences: "NONE",
        contests: "NONE",
        gamblingSimulated: "NONE",
        gunsOrOtherWeapons: "NONE",
        horrorOrFearThemes: "NONE",
        matureOrSuggestiveThemes: "NONE",
        medicalOrTreatmentInformation: "NONE",
        profanityOrCrudeHumor: "NONE",
        sexualContentGraphicAndNudity: "NONE",
        sexualContentOrNudity: "NONE",
        violenceCartoonOrFantasy: "NONE",
        violenceRealistic: "NONE",
        violenceRealisticProlongedGraphicOrSadistic: "NONE",
        gambling: false,
        lootBox: false,
        unrestrictedWebAccess: false,
        messagingAndChat: false,
        ageAssurance: false,
        advertising: false,
        parentalControls: false,
        userGeneratedContent: false,
        healthOrWellnessTopics: false,
        socialMedia: false,
        socialMediaAgeRestricted: false,
      },
    },
  });
  if (agePatch.ok) log("age rating", "4+");
  else
    console.log(
      "! age rating skipped",
      agePatch.status,
      errorText(agePatch.j).split("\n")[0] || "",
    );
}

// --- Content rights + review contact -----------------------------------------
{
  const rights = await asc("PATCH", `/v1/apps/${APP_ID}`, {
    data: {
      type: "apps",
      id: APP_ID,
      attributes: { contentRightsDeclaration: "USES_THIRD_PARTY_CONTENT" },
    },
  });
  if (rights.ok) log("content rights", "USES_THIRD_PARTY_CONTENT");
  else
    console.log(
      "! content rights skipped",
      rights.status,
      errorText(rights.j).split("\n")[0] || "",
    );
}

const review = cfg.apple.review;
const existingReview = await asc("GET", `/v1/appStoreVersions/${VERSION_ID}/appStoreReviewDetail`);
if (existingReview.j.data?.id) {
  await must(
    "patch review detail",
    await asc("PATCH", `/v1/appStoreReviewDetails/${existingReview.j.data.id}`, {
      data: {
        type: "appStoreReviewDetails",
        id: existingReview.j.data.id,
        attributes: {
          contactFirstName: review.firstName,
          contactLastName: review.lastName,
          contactEmail: review.email,
          contactPhone: review.phone,
          demoAccountRequired: true,
          demoAccountName: review.demoAccountName || "review@blindboxcloset.app",
          demoAccountPassword: review.demoAccountPassword || "ReviewBBC115!",
          notes: review.notes,
        },
      },
    }),
  );
} else {
  await must(
    "create review detail",
    await asc("POST", "/v1/appStoreReviewDetails", {
      data: {
        type: "appStoreReviewDetails",
        attributes: {
          contactFirstName: review.firstName,
          contactLastName: review.lastName,
          contactEmail: review.email,
          contactPhone: review.phone,
          demoAccountRequired: true,
          demoAccountName: review.demoAccountName || "review@blindboxcloset.app",
          demoAccountPassword: review.demoAccountPassword || "ReviewBBC115!",
          notes: review.notes,
        },
        relationships: { appStoreVersion: { data: { type: "appStoreVersions", id: VERSION_ID } } },
      },
    }),
  );
}
log("review contact", `${review.firstName} ${review.lastName} <${review.email}>`);

// --- Pricing (free) ----------------------------------------------------------
const priceGet = await asc("GET", `/v1/apps/${APP_ID}/appPriceSchedule`);
if (!priceGet.ok) {
  const pricePoints = await must(
    "price points",
    await asc(
      "GET",
      `/v1/apps/${APP_ID}/appPricePoints?filter[territory]=FRA&limit=200`,
    ),
  );
  const free = pricePoints.data.find(
    (p) => p.attributes?.customerPrice === "0.0" || p.attributes?.customerPrice === "0.00" || p.attributes?.priceTier === 0,
  ) || pricePoints.data.find((p) => String(p.attributes?.customerPrice || "").startsWith("0"));
  if (!free) {
    console.log("! no free price point found; listing price must be set in ASC UI");
  } else {
    const created = await asc("POST", "/v1/appPriceSchedules", {
      data: {
        type: "appPriceSchedules",
        relationships: {
          app: { data: { type: "apps", id: APP_ID } },
          baseTerritory: { data: { type: "territories", id: "FRA" } },
          manualPrices: { data: [{ type: "appPrices", id: "${price1}" }] },
        },
      },
      included: [
        {
          type: "appPrices",
          id: "${price1}",
          relationships: {
            appPricePoint: { data: { type: "appPricePoints", id: free.id } },
          },
        },
      ],
    });
    if (created.ok) log("price", "free (FRA base)");
    else console.log("! price schedule", created.status, errorText(created.j));
  }
} else {
  log("price", "already set");
}

// --- Screenshots -------------------------------------------------------------
async function uploadScreenshot(setId, filePath) {
  const buf = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);
  const checksum = crypto.createHash("md5").update(buf).digest("base64");
  const reserved = await must(
    `reserve ${fileName}`,
    await asc("POST", "/v1/appScreenshots", {
      data: {
        type: "appScreenshots",
        attributes: { fileName, fileSize: buf.length },
        relationships: { appScreenshotSet: { data: { type: "appScreenshotSets", id: setId } } },
      },
    }),
  );
  const id = reserved.data.id;
  for (const op of reserved.data.attributes.uploadOperations || []) {
    const chunk = buf.subarray(op.offset, op.offset + op.length);
    const headers = Object.fromEntries((op.requestHeaders || []).map((h) => [h.name, h.value]));
    const r = await fetch(op.url, { method: op.method, headers, body: chunk });
    if (!r.ok) throw new Error(`upload chunk failed ${r.status} for ${fileName}`);
  }
  await must(
    `commit ${fileName}`,
    await asc("PATCH", `/v1/appScreenshots/${id}`, {
      data: {
        type: "appScreenshots",
        id,
        attributes: { uploaded: true, sourceFileChecksum: checksum },
      },
    }),
  );
  return id;
}

async function ensureScreenshotSet(locId, displayType) {
  const sets = await must(
    `sets ${displayType}`,
    await asc("GET", `/v1/appStoreVersionLocalizations/${locId}/appScreenshotSets?limit=50`),
  );
  let set = sets.data.find((s) => s.attributes.screenshotDisplayType === displayType);
  if (!set) {
    const created = await must(
      `create set ${displayType}`,
      await asc("POST", "/v1/appScreenshotSets", {
        data: {
          type: "appScreenshotSets",
          attributes: { screenshotDisplayType: displayType },
          relationships: {
            appStoreVersionLocalization: {
              data: { type: "appStoreVersionLocalizations", id: locId },
            },
          },
        },
      }),
    );
    set = created.data;
  } else {
    // Clear existing screenshots so we replace cleanly
    const existing = await must(
      `list shots ${displayType}`,
      await asc("GET", `/v1/appScreenshotSets/${set.id}/appScreenshots?limit=50`),
    );
    for (const shot of existing.data || []) {
      await asc("DELETE", `/v1/appScreenshots/${shot.id}`);
    }
  }
  return set;
}

const shotPlan = [
  { device: "iphone67", type: "APP_IPHONE_67" },
  { device: "ipad129", type: "APP_IPAD_PRO_3GEN_129" },
];

for (const loc of [frLoc, enLoc]) {
  for (const { device, type } of shotPlan) {
    const dir = path.join(ROOT, "store", "screenshots", device);
    if (!fs.existsSync(dir)) {
      console.log(`! missing screenshots in ${dir}`);
      continue;
    }
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".png"))
      .sort();
    if (!files.length) continue;
    const set = await ensureScreenshotSet(loc.id, type);
    for (const file of files) {
      await uploadScreenshot(set.id, path.join(dir, file));
      log(`screenshot ${loc.attributes.locale} ${type}`, file);
    }
  }
}

// --- Attach build + submit ---------------------------------------------------
if (doSubmit) {
  const builds = await must(
    "builds",
    await asc(
      "GET",
      `/v1/builds?filter[app]=${APP_ID}&sort=-uploadedDate&limit=20&include=preReleaseVersion`,
    ),
  );
  const included = builds.included || [];
  let build = null;
  for (const b of builds.data) {
    if (b.attributes.processingState !== "VALID" || b.attributes.expired) continue;
    const pre = included.find(
      (i) => i.type === "preReleaseVersions" && i.id === b.relationships?.preReleaseVersion?.data?.id,
    );
    const marketing = pre?.attributes?.version;
    const number = b.attributes.version;
    if (wantedBuild && number !== wantedBuild) continue;
    if (!wantedBuild && marketing && marketing !== VERSION_STRING) continue;
    build = b;
    break;
  }
  if (!build && wantedBuild) {
    build = builds.data.find((b) => b.attributes.version === wantedBuild && b.attributes.processingState === "VALID");
  }
  if (!build) {
    console.log("! no VALID build matching", wantedBuild || VERSION_STRING, "— metadata saved, submit later");
    process.exit(0);
  }
  log("build", `${build.attributes.version} ${build.id}`);

  // Encryption answer on the build
  const detail = await asc("GET", `/v1/builds/${build.id}/buildBetaDetail`);
  // App encryption declaration for App Store
  const enc = await asc("GET", `/v1/builds/${build.id}/appEncryptionDeclaration`);
  if (!enc.j.data) {
    // Uses the Info.plist ITSAppUsesNonExemptEncryption=false via build metadata
    console.log("  (encryption declaration via Info.plist / build)");
  }

  await must(
    "attach build",
    await asc("PATCH", `/v1/appStoreVersions/${VERSION_ID}`, {
      data: {
        type: "appStoreVersions",
        id: VERSION_ID,
        relationships: { build: { data: { type: "builds", id: build.id } } },
      },
    }),
  );
  log("build attached", build.id);

  // Modern review submission flow
  const sub = await must(
    "create submission",
    await asc("POST", "/v1/reviewSubmissions", {
      data: {
        type: "reviewSubmissions",
        attributes: { platform: "IOS" },
        relationships: { app: { data: { type: "apps", id: APP_ID } } },
      },
    }),
  );
  const submissionId = sub.data.id;
  await must(
    "add item",
    await asc("POST", "/v1/reviewSubmissionItems", {
      data: {
        type: "reviewSubmissionItems",
        relationships: {
          reviewSubmission: { data: { type: "reviewSubmissions", id: submissionId } },
          appStoreVersion: { data: { type: "appStoreVersions", id: VERSION_ID } },
        },
      },
    }),
  );
  const submitted = await must(
    "submit",
    await asc("PATCH", `/v1/reviewSubmissions/${submissionId}`, {
      data: {
        type: "reviewSubmissions",
        id: submissionId,
        attributes: { submitted: true },
      },
    }),
  );
  log("SUBMITTED", submitted.data.attributes?.state || "ok");
} else {
  console.log("\nMetadata ready. Re-run with --submit --build <n> when the build is VALID.");
}
