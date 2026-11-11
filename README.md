# Blind Box Closet

App Expo iOS pour suivre une collection Smiski / blind boxes.

## Stack

- **App :** Expo SDK 58 · Sign in with Apple · React Navigation
- **API :** Fastify + PostgreSQL sur VPS `85.17.145.134:8787`
- **Catalogue seed :** Smiski (41 séries / 220 figurines), Sonny Angel (133 séries / 1022 figurines), Labubu (15 séries / 154 figurines)
- **Admin :** rôle `is_admin` (emails dans `ADMIN_EMAILS`)

## Démarrer l’app

```bash
npm install
npm start
```

Connexion : Sign in with Apple (device) ou bouton **dev / admin** (API avec `APPLE_AUTH_OPTIONAL=1`).

## API VPS

```bash
npm run deploy:vps
# health
curl http://85.17.145.134:8787/health
```

Service systemd : `blind-box-closet.service`  
Données : `/opt/blind-box-closet`

## App Store

Déjà fait automatiquement :
- Bundle ID `com.blindboxcloset.app` + Sign in with Apple
- Projet EAS `@dorian172/blind-box-closet`
- Certificat + profil App Store + build iOS lancé

À faire une fois dans App Store Connect (la clé API n’a pas le droit `CREATE` sur `/apps`) :
1. **My Apps → + → New App** : name *Blind Box Closet*, bundle `com.blindboxcloset.app`, langue FR
2. Coller l’App ID numérique dans `eas.json` → `submit.production.ios.ascAppId`
3. Privacy déjà en ligne : https://appigeek.github.io/blind-box-closet/privacy.html
4. Submit :

```bash
npx eas-cli submit --platform ios --profile production --latest
```

Build iOS prêt (build 2) : https://expo.dev/accounts/dorian172/projects/blind-box-closet/builds/c521f582-b9a3-4bb8-a530-29df7e0c1a40

## Scripts utiles

| Commande | Rôle |
|----------|------|
| `npm run deploy:vps` | Déploie API + seed |
| `node scripts/asc-create-app.mjs` | Bundle ID / sync ASC (si droits) |
| `npm run server:dev` | API locale |
