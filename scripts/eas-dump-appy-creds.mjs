import fs from "node:fs";
import path from "node:path";

const APPY_PROJECT_ID = "7efd1549-548c-45a9-aede-4603bb6efab0";
const state = JSON.parse(
  fs.readFileSync(path.join(process.env.USERPROFILE, ".expo", "state.json"), "utf8"),
);
const ss = state.auth.sessionSecret;
const r = await fetch("https://api.expo.dev/graphql", {
  method: "POST",
  headers: { "Content-Type": "application/json", "expo-session": ss },
  body: JSON.stringify({
    query: `query($appId:String!){
      app{byId(appId:$appId){
        iosAppCredentials{
          id
          appleTeam { id appleTeamIdentifier }
          appleAppIdentifier{id bundleIdentifier}
          appStoreConnectApiKeyForSubmissions{id}
          appStoreConnectApiKeyForBuilds{id}
        }
      }}
    }`,
    variables: { appId: APPY_PROJECT_ID },
  }),
});
const j = await r.json();
console.log(JSON.stringify(j, null, 2));

const r2 = await fetch("https://api.expo.dev/graphql", {
  method: "POST",
  headers: { "Content-Type": "application/json", "expo-session": ss },
  body: JSON.stringify({
    query: `query($accountId:ID!){
      account{byId(accountId:$accountId){
        appleTeams{id appleTeamIdentifier}
        appleAppIdentifiers{id bundleIdentifier}
      }}
    }`,
    variables: { accountId: "a3cf6400-01cf-4257-8e97-bc8e5b4679c7" },
  }),
});
console.log("ACCOUNT", JSON.stringify(await r2.json(), null, 2));
