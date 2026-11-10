/**
 * Create Blind Box Closet in ASC using cached Apple session cookies,
 * then print the numeric app id for EAS submit / TestFlight.
 */
import fs from "node:fs";
import path from "node:path";
import {
  App,
  Platform,
  tryRestoringAuthStateFromUserCredentialsAsync,
  session,
} from "@expo/apple-utils";

const BUNDLE_ID = "com.blindboxcloset.app";
const APP_NAME = "Blind Box Closet";
const TEAM_ID = "2QKC854C2J";
const USERNAME = "dorian172@icloud.com";
const COOKIE_PATH = path.join(
  process.env.USERPROFILE,
  ".app-store",
  "auth",
  USERNAME,
  "cookie",
);

async function main() {
  if (!fs.existsSync(COOKIE_PATH)) {
    throw new Error(`Missing cookie file: ${COOKIE_PATH}`);
  }
  const cookies = JSON.parse(fs.readFileSync(COOKIE_PATH, "utf8"));

  const auth = await tryRestoringAuthStateFromUserCredentialsAsync(
    {
      username: USERNAME,
      cookies,
      teamId: TEAM_ID,
    },
    { autoResolveProvider: true },
  );

  if (!auth) {
    throw new Error(
      "Apple session expired. Run: npx eas-cli credentials (re-login to Apple) then retry.",
    );
  }

  const context = session.getContext();
  console.log("Provider", auth.session?.provider?.name || auth.session?.provider?.providerId);

  let app = await App.findAsync(context, { bundleId: BUNDLE_ID });
  if (!app) {
    console.log("Creating app…");
    app = await App.createAsync(context, {
      name: APP_NAME,
      bundleId: BUNDLE_ID,
      sku: "blindboxcloset001",
      primaryLocale: "fr-FR",
      platforms: [Platform.IOS],
      versionString: "1.0.0",
    });
    console.log("Created", app.id, app.attributes?.name);
  } else {
    console.log("Exists", app.id, app.attributes?.name);
  }

  // Patch eas.json
  const easPath = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "eas.json");
  // Windows path fix for file URL
  const root = path.resolve(path.dirname(fileURLToPathFix()), "..");
  const easFile = path.join(root, "eas.json");
  const eas = JSON.parse(fs.readFileSync(easFile, "utf8"));
  eas.submit = eas.submit || {};
  eas.submit.production = eas.submit.production || {};
  eas.submit.production.ios = { ascAppId: String(app.id) };
  fs.writeFileSync(easFile, JSON.stringify(eas, null, 2) + "\n");
  console.log("ASC_APP_ID", app.id);
}

function fileURLToPathFix() {
  // scripts/asc-create-via-session.mjs
  return path.join(process.cwd(), "scripts", "asc-create-via-session.mjs");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
