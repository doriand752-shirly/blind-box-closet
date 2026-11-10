import fs from "node:fs";
import path from "node:path";

const ACCOUNT_ID = "a3cf6400-01cf-4257-8e97-bc8e5b4679c7";
const state = JSON.parse(
  fs.readFileSync(path.join(process.env.USERPROFILE, ".expo", "state.json"), "utf8"),
);
const ss = state.auth.sessionSecret;

async function gql(query, variables = {}) {
  const r = await fetch("https://api.expo.dev/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json", "expo-session": ss },
    body: JSON.stringify({ query, variables }),
  });
  return r.json();
}

const types = await gql(`{
  apple: __type(name:"AppleMutation"){ fields { name } }
  dist: __type(name:"AppleDistributionCertificateMutation"){ fields { name args { name type { name kind ofType { name } } } } }
  adhoc: __type(name:"AppleProvisioningProfileMutation"){ fields { name } }
}`);
console.log("TYPES", JSON.stringify(types, null, 2).slice(0, 3000));

const account = await gql(
  `query($accountId:String!){
    account{byId(accountId:$accountId){
      appleDistributionCertificates{
        id
        serialNumber
        validityNotBefore
        validityNotAfter
        appleTeam{id appleTeamIdentifier}
      }
      appleProvisioningProfiles{
        id
        appleAppIdentifier{bundleIdentifier}
      }
    }}
  }`,
  { accountId: ACCOUNT_ID },
);
console.log("ACCOUNT CERTS", JSON.stringify(account, null, 2).slice(0, 5000));
