import fs from "node:fs";
import path from "node:path";

const state = JSON.parse(
  fs.readFileSync(path.join(process.env.USERPROFILE, ".expo", "state.json"), "utf8"),
);
const ss = state.auth.sessionSecret;

const query = `{
  ios: __type(name: "IosAppCredentialsMutation") {
    fields { name args { name type { name kind ofType { name kind ofType { name } } } } }
  }
  apple: __type(name: "AppleAppIdentifierMutation") {
    fields { name args { name type { name kind ofType { name kind ofType { name } } } } }
  }
  input: __type(name: "IosAppCredentialsInput") {
    inputFields { name type { name kind ofType { name } } }
  }
}`;

const r = await fetch("https://api.expo.dev/graphql", {
  method: "POST",
  headers: { "Content-Type": "application/json", "expo-session": ss },
  body: JSON.stringify({ query }),
});
console.log(JSON.stringify(await r.json(), null, 2));
