// Each documentation / config fix from the bug report is asserted here, so the claim is checked by npm test.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = p => readFileSync(join(root, p), "utf8");
const lines = p => read(p).split("\n");

// #19: the Android workflow (.github/workflows/android.yml) is kept in the GitHub repo by the owner, not in the project zip
// (a .github folder inside an uploaded zip is ignored by the unpack job), so nothing here requires it.

test("#57 EXTRA_DETAILS marks the Hi-res items as superseded", () => {
  assert.match(read("docs/EXTRA_DETAILS.md"), /SUPERSEDED/);
});

test("#58 HANDOFF says FLAC first and MP3 / AAC also play", () => {
  assert.match(read("docs/HANDOFF.md"), /FLAC first.*MP3 and AAC \/ M4A also play/);
});

test("#59 HANDOFF file counts match the project (checked in full by handoff-counts.test.mjs)", () => {
  assert.match(read("docs/HANDOFF.md"), /^Tests \(tests\/\): \d+ files \(\d+ \*\.test\.mjs\)/m);
});

test("#60 HANDOFF marks the stale ReplayGain / sleep-timer lines as stale", () => {
  assert.ok((read("docs/HANDOFF.md").match(/STALE/g) || []).length >= 3);
});

test("#61 EXTRA_DETAILS tile counts: 16 tags, 3 cover tiles", () => {
  const t = read("docs/EXTRA_DETAILS.md");
  assert.match(t, /"Tags" \(16 tiles/);
  assert.match(t, /3 Cover tiles/);
  assert.doesNotMatch(t, /4 Cover tiles/);
});

test("#62 SETTINGS_EXPORT_REPORT: the profile photo is not exported", () => {
  assert.match(read("docs/SETTINGS_EXPORT_REPORT.md"), /not exported/);
});

test("#63 README: 'More widgets' sits under Listening Stats, not under the pictures list", () => {
  const l = lines("README.md");
  const more = l.findIndex(x => x.includes("**More widgets.**"));
  const pics = l.findIndex(x => x.startsWith("### Pictures you can send live"));
  const stats = l.findIndex(x => x.includes("**Listening Stats**"));
  assert.ok(more > -1 && pics > -1 && stats > -1);
  assert.ok(stats < more && more < pics, "bullet is between Listening Stats and the pictures heading");
});

test("#66 package-lock engines.node matches package.json", () => {
  const pkg = JSON.parse(read("package.json"));
  const lock = JSON.parse(read("package-lock.json"));
  assert.equal(lock.packages[""].engines.node, pkg.engines.node);
});

test("#68 UPDATES.md has no duplicate version headings and no stray top-level '# Updates'", () => {
  const heads = lines("UPDATES.md").filter(l => l.startsWith("## "));
  const seen = new Set(), dup = [];
  for (const h of heads) { if (seen.has(h)) dup.push(h); seen.add(h); }
  assert.deepEqual(dup, []);
  assert.ok(!lines("UPDATES.md").some(l => l === "# Updates"));
  assert.ok(!heads.some(h => h.includes("(this version)")), "no heading carries the (this version) marker");
});

test("#69 UPDATES.md and HANDOFF point out the files that are not in the ZIP", () => {
  assert.match(read("UPDATES.md"), /HISTORICAL FILE REFERENCES/);
  assert.match(lines("HANDOFF_STATUS.md")[0], /BUGS\.txt/);
});

test("#70 the sleep timer text matches src/sleep.js", () => {
  const sleep = read("src/sleep.js");
  assert.match(sleep, /SLEEP_MINUTES = \[5, 10, 15, 30, 45, 60\]/);
  assert.match(read("UPDATES.md"), /5 \/ 10 \/ 15 \/ 30 \/ 45 \/ 60/);
});
