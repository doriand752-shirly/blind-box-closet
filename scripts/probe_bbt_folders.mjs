const UA = "BlindBoxCloset/1.1";
const folders = [
  "zipperbite_vol_2",
  "zipperbite2",
  "zipperbite_2",
  "touch_light_vol_2",
  "touch_light_2",
  "touchlight_vol_2",
  "embroidery_sticker_vol_2",
  "embroidery_sticker_2",
  "ringcolle",
  "ringcolle_smiski_ring",
  "ring_colle",
];
const names = [
  "pullingzipper",
  "smiskipullingzipper",
  "kneeling",
  "smiskikneeling",
  "kneelinglight",
  "smiskikneelingtouchlight",
  "peeking",
  "smiskipeeking",
  "sitting",
  "smiskisitting",
  "hiding",
  "lookingback",
  "lotuspose",
  "fallingdown",
];
for (const folder of folders) {
  for (const name of names) {
    for (const ext of [".webp", ".png"]) {
      const url = `https://www.blindboxtracker.com/assets/collections/smiskis/${folder}/${name}${ext}`;
      try {
        const res = await fetch(url, { method: "HEAD", headers: { "User-Agent": UA } });
        if (res.ok) console.log("HIT", url);
      } catch {
        /* ignore */
      }
    }
  }
}
console.log("done");
