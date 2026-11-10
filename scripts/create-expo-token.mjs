import fs from "node:fs";
import path from "node:path";

const state = JSON.parse(
  fs.readFileSync(path.join(process.env.USERPROFILE, ".expo", "state.json"), "utf8"),
);
const ss = state.auth.sessionSecret;

async function gql(query, variables) {
  const r = await fetch("https://api.expo.dev/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json", "expo-session": ss },
    body: JSON.stringify({ query, variables }),
  });
  const j = await r.json();
  if (j.errors) {
    console.error(JSON.stringify(j.errors, null, 2));
    process.exit(1);
  }
  return j.data;
}

const mode = process.argv[2] || "create";

if (mode === "introspect") {
  const data = await gql(`{
    __schema {
      mutationType {
        fields {
          name
          args { name type { name kind ofType { name kind ofType { name } } } }
          type { name kind ofType { name fields { name type { name kind ofType { name } } } } }
        }
      }
    }
  }`);
  const fields = data.__schema.mutationType.fields.filter((f) =>
    /token|Token|access/i.test(f.name),
  );
  console.log(JSON.stringify({ userId: state.auth.userId, fields }, null, 2));
} else if (mode === "type") {
  const data = await gql(`{
    t: __type(name: "CreateAccessTokenResponse") {
      fields { name type { name kind ofType { name kind ofType { name } } } }
    }
  }`);
  console.log(JSON.stringify(data, null, 2));
} else {
  const data = await gql(
    `mutation($input: CreateAccessTokenInput!) {
      accessToken {
        createAccessToken(createAccessTokenData: $input) {
          token
          accessToken { id note createdAt }
        }
      }
    }`,
    {
      input: {
        actorID: state.auth.userId,
        note: "github-actions-bbc-local-ios",
      },
    },
  );
  const created = data.accessToken?.createAccessToken;
  const token = created?.token;
  if (!token) {
    console.error("No tokenPayload", JSON.stringify(data, null, 2));
    process.exit(1);
  }
  fs.writeFileSync(path.join(process.env.TEMP, "expo-token.txt"), token, "utf8");
  console.log("TOKEN_OK");
  console.log("ID", created.accessToken?.id);
}
