/**
 * Create Blind Box Closet in ASC using cached Apple session cookies.
 */
const fs = require("fs");
const path = require("path");
const { App, Platform, Auth, Token } = require("@expo/apple-utils");

const BUNDLE_ID = "com.blindboxcloset.app";
const APP_NAME = "Blind Box Closet";
const TEAM_ID = "2QKC854C2J";

async function restore(username) {
  const cookiePath = path.join(
    process.env.USERPROFILE,
    ".app-store",
    "auth",
    username,
    "cookie",
  );
  if (!fs.existsSync(cookiePath)) return null;
  const cookies = JSON.parse(fs.readFileSync(cookiePath, "utf8"));
  console.log("Trying restore for", username);
  return Auth.tryRestoringAuthStateFromUserCredentialsAsync(
    { username, cookies, teamId: TEAM_ID },
    { autoResolveProvider: true },
  );
}

async function main() {
  let auth =
    (await restore("dorian172@icloud.com")) ||
    (await restore("dorian172@outlook.com"));

  if (!auth) {
    throw new Error(
      "Apple session expired. Re-login with: npx eas-cli credentials",
    );
  }

  console.log("Auth keys", Object.keys(auth));
  console.log(
    "Provider",
    auth.session?.provider?.name || auth.session?.provider?.providerId,
  );

  // AuthState typically has .context as RequestContext
  const context = auth.context || auth;
  console.log("Context keys", Object.keys(context));

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

  const easFile = path.join(__dirname, "..", "eas.json");
  const eas = JSON.parse(fs.readFileSync(easFile, "utf8"));
  eas.submit = eas.submit || {};
  eas.submit.production = eas.submit.production || {};
  eas.submit.production.ios = { ascAppId: String(app.id) };
  fs.writeFileSync(easFile, JSON.stringify(eas, null, 2) + "\n");
  console.log("ASC_APP_ID", app.id);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
