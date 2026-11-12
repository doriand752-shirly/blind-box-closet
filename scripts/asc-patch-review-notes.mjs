import { createAsc, errorText } from "./lib/asc-client.mjs";

const VERSION_ID = "47bed424-c8f5-4f6f-af2b-fb50f15dad3d";

const notes = `=== APP REVIEW INFORMATION (Guideline 2.1) ===

NO ACCOUNT / NO Sign in with Apple in this build.
Blind Box Closet is fully local: the collection is stored only on the device.

Please watch the attached screen recording (physical iPhone).

---
1) SCREEN RECORDING — typical user flow
- Launch Blind Box Closet
- Tap Start collecting (Commencer)
- Choose brands → continue
- Open Smiski → expand a series → tick a figure as owned
- Settings → Export / Import collection, or Clear local collection

There is no login, no Apple Sign In button, and no cloud account.
Account creation endpoints on the API return HTTP 410.

No paid content / IAP. No user-generated content feeds or messaging.

---
2) PURPOSE AND TARGET AUDIENCE
Collectors track blind-box figures (owned, duplicates to trade, wishlist) series by series.
Audience: hobbyist collectors. Ages 4+. Languages: FR / EN / ES.

---
3) SETUP
- No demo account. No credentials.
- Path: Start collecting → catalogue → checklist → Settings.
- Contact: doriandood.pro@gmail.com / +33600000000

---
4) EXTERNAL SERVICES
- Read-only catalogue API: http://85.17.145.134:8787 (brand/series/figure metadata + images)
- No authentication, ads, analytics, payments, or AI services

---
5) REGIONAL DIFFERENCES
Same features worldwide. Language follows in-app choice (FR / EN / ES).

---
6) THIRD-PARTY MATERIAL
Independent collector utility. Brand names used only to identify catalogue items.
Not affiliated with Dreams Inc., Pop Mart, or other brand owners.

Contact: Dorian Dood — doriandood.pro@gmail.com`;

const asc = await createAsc();
const existing = await asc("GET", `/v1/appStoreVersions/${VERSION_ID}/appStoreReviewDetail`);
const id = existing.j.data?.id;
if (!id) throw new Error("no review detail: " + errorText(existing.j));

const patch = await asc("PATCH", `/v1/appStoreReviewDetails/${id}`, {
  data: {
    type: "appStoreReviewDetails",
    id,
    attributes: {
      contactFirstName: "Dorian",
      contactLastName: "Dood",
      contactEmail: "doriandood.pro@gmail.com",
      contactPhone: "+33600000000",
      demoAccountRequired: false,
      notes,
    },
  },
});

if (!patch.ok) {
  console.error(errorText(patch.j));
  process.exit(1);
}
console.log("OK notes length", notes.length);
