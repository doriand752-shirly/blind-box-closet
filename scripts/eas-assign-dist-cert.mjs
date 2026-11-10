import fs from "node:fs";
import path from "node:path";

const CRED_ID = "14dec1c9-5e96-4920-815f-9959419c68b4";
const DIST_CERT_ID = "f812b1b5-23be-454b-83d0-52bc4a2f78db";
const IDENTIFIER_ID = "71b4cda9-2bf6-44c3-a682-a089fd399dee";
const ACCOUNT_ID = "a3cf6400-01cf-4257-8e97-bc8e5b4679c7";
const TEAM_ID = "ee0d6f85-572d-4139-a42c-8f8342d586b2";
const ASC_KEY_ID = "e72744b6-60c3-4300-94bb-53a09c26f131";

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
  const j = await r.json();
  if (j.errors?.length) throw new Error(JSON.stringify(j.errors, null, 2));
  return j.data;
}

// Introspect ios mutations for dist cert setters
const types = await gql(`{
  ios: __type(name:"IosAppCredentialsMutation"){ fields { name } }
  build: __type(name:"IosAppBuildCredentialsMutation"){ fields { name args { name type { name kind ofType { name } } } } }
  buildInput: __type(name:"IosAppBuildCredentialsInput"){ inputFields { name type { name kind ofType { name } } } }
}`);
console.log(JSON.stringify(types, null, 2));

// Try create build credentials with dist cert
try {
  const res = await gql(
    `mutation($iosAppCredentialsId:ID!, $input:IosAppBuildCredentialsInput!){
      iosAppBuildCredentials{
        createIosAppBuildCredentials(iosAppCredentialsId:$iosAppCredentialsId, iosAppBuildCredentialsInput:$input){
          id
          distributionType
          distributionCertificate{id}
        }
      }
    }`,
    {
      iosAppCredentialsId: CRED_ID,
      input: {
        distributionType: "APP_STORE",
        distributionCertificateId: DIST_CERT_ID,
      },
    },
  );
  console.log("build creds", JSON.stringify(res, null, 2));
} catch (e) {
  console.error("create build creds", e.message);
}

// Create provisioning profile via ASC if needed - try mutation that generates it
try {
  const res = await gql(
    `mutation($appleAppIdentifierId:ID!, $accountId:ID!, $appleTeamId:ID){
      appleProvisioningProfile{
        createAppleProvisioningProfile(
          appleProvisioningProfileInput:{
            appleAppIdentifierId:$appleAppIdentifierId
            appleTeamId:$appleTeamId
          }
          accountId:$accountId
        ){ id }
      }
    }`,
    {
      appleAppIdentifierId: IDENTIFIER_ID,
      accountId: ACCOUNT_ID,
      appleTeamId: TEAM_ID,
    },
  );
  console.log("profile", JSON.stringify(res, null, 2));
} catch (e) {
  console.error("create profile", e.message.slice(0, 800));
}
