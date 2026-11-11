/**
 * Create Blind Box Closet in ASC using cached Apple session cookies,
 * then print the numeric app id for EAS submit / TestFlight.
 * Cookie folders under ~/.app-store/auth/ are discovered automatically.
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
const AUTH_ROOT = path.join(process.env.USERPROFILE, ".app-store", "auth");

async function restore(username) {
  const cookiePath = path.join(AUTH_ROOT, username, "cookie");
  if (!fs.existsSync(cookiePath)) return null;
  const cookies = JSON.parse(fs.readFileSync(cookiePath, "utf8"));
  console.log("Trying restore for", username);
  return tryRestoringAuthStateFromUserCredentialsAsync(
    { username, cookies, teamId: TEAM_ID },
    { autoResolveProvider: true },
  );
}

async function main() {
  const candidates = fs
    .readdirSync(AUTH_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.includes("@"))
    .map((d) => d.name);

  let auth = null;
  for (const username of candidates) {
    auth = await restore(username);
    if (auth) break;
  }

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
  return path.join(process.cwd(), "scripts", "asc-create-via-session.mjs");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
