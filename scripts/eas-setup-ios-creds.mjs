/**
 * Create Apple app identifier + iOS credentials for Blind Box Closet.
 */
import fs from "node:fs";
import path from "node:path";

const BBC_PROJECT_ID = "5d07c67d-ecf3-49d1-9081-d91e72c296d0";
const BBC_BUNDLE = "com.blindboxcloset.app";
const ACCOUNT_ID = "a3cf6400-01cf-4257-8e97-bc8e5b4679c7";
const TEAM_ID = "ee0d6f85-572d-4139-a42c-8f8342d586b2";
const ASC_KEY_ID = "e72744b6-60c3-4300-94bb-53a09c26f131";
const EXPO = "https://api.expo.dev/graphql";

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

async function main() {
  const state = JSON.parse(
    fs.readFileSync(path.join(process.env.USERPROFILE, ".expo", "state.json"), "utf8"),
  );
  const ss = state.auth.sessionSecret;

  let identifierId;
  try {
    const created = await gql(
      ss,
      `mutation($accountId:ID!, $input:AppleAppIdentifierInput!){
        appleAppIdentifier{
          createAppleAppIdentifier(accountId:$accountId, appleAppIdentifierInput:$input){
            id
            bundleIdentifier
          }
        }
      }`,
      {
        accountId: ACCOUNT_ID,
        input: { bundleIdentifier: BBC_BUNDLE, appleTeamId: TEAM_ID },
      },
    );
    identifierId = created.appleAppIdentifier.createAppleAppIdentifier.id;
    console.log("Created identifier", identifierId);
  } catch (e) {
    console.warn("create identifier failed, listing…", String(e.message).slice(0, 300));
    const list = await gql(
      ss,
      `query($accountId:String!){
        account{byId(accountId:$accountId){
          appleAppIdentifiers{id bundleIdentifier}
        }}
      }`,
      { accountId: ACCOUNT_ID },
    );
    const found = list.account.byId.appleAppIdentifiers?.find(
      (x) => x.bundleIdentifier === BBC_BUNDLE,
    );
    if (!found) throw e;
    identifierId = found.id;
    console.log("Reusing identifier", identifierId);
  }

  const createdCreds = await gql(
    ss,
    `mutation($appId:ID!, $appleAppIdentifierId:ID!, $input:IosAppCredentialsInput!){
      iosAppCredentials{
        createIosAppCredentials(appId:$appId, appleAppIdentifierId:$appleAppIdentifierId, iosAppCredentialsInput:$input){
          id
          appleAppIdentifier{bundleIdentifier}
          appStoreConnectApiKeyForSubmissions{id}
          appStoreConnectApiKeyForBuilds{id}
          appleTeam{id appleTeamIdentifier}
        }
      }
    }`,
    {
      appId: BBC_PROJECT_ID,
      appleAppIdentifierId: identifierId,
      input: {
        appleTeamId: TEAM_ID,
        appStoreConnectApiKeyForSubmissionsId: ASC_KEY_ID,
        appStoreConnectApiKeyForBuildsId: ASC_KEY_ID,
      },
    },
  );
  console.log(JSON.stringify(createdCreds, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
