
> **VERSION RULE (owner's order): do NOT change the version number (it is 0.208.0, set by the owner on 2026-11-12) in `package.json`, `package-lock.json`, docs or anywhere else, and do not add a "bump" to any entry. Only the owner decides when to bump it, by telling you. Every AI that edits this project must keep it as it is.**


**How to read this file:** the newest entries are at the TOP (everything down to the v131 entry is newest first). The older entries lower down are only roughly ordered, and the v149-v156 entries at the very bottom were appended later, so they are NOT in date order: use the version number in each heading, not the position. No entry is marked "(this version)"; the current version is 0.208.0.

> **HISTORICAL FILE REFERENCES:** these files are named in the entries but are NOT in this ZIP (removed or never shipped): `native-android/PlayCounter.java` (STALE, plays are counted by `ListenTracker.java`), `tests/java-probe-plays.py`, `tests/java-probe-gain.py`, `BUGS.txt`, `OPEN_BUGS.txt`, `LIQUID_DARK_BUG_REPORT_updated.txt`, `Liquid_Dark_gifs_pics.html`, `Liquid_Dark_full_setup.html` (also written `Liquid_Dark_full_setup_guide.html` in the v134 entry: same guide) and `.github/workflows/android.yml` (copied by hand). Read those mentions as history; do not look for the files.

## Equalizer opens your phone's own sound page: Dirac Audio Tuner on OnePlus
- **Changed:** on **OnePlus** phones the Equalizer row in Settings now goes straight to **Dirac Audio Tuner** (Smart, Movie, Game, Music). On **OPPO and Realme** it still opens Real Sound Technology, exactly as before. On every other phone (Samsung, Vivo, Xiaomi, Huawei, Motorola...) it opens that phone's own sound effects page; if the phone does not let apps open it, you land on Sound & vibration and a short message tells you which row to tap.
- Only the phone's built-in pages are used, never an equalizer app you installed yourself.

## Allow cards now come one after the other
- **Changed:** when both notifications and background activity are off, the notification card comes first (a few seconds after opening). The background-activity card comes 10 seconds after the notification card is gone (after you tap Allow, Later or go back), never at the same time. Each one still shows its own picture or GIF from `notification-popup-gif-pic/` and `background-allow-gif-pic/`.
- **Allow background activity** now opens the right settings page on more phones (Oppo, Realme, OnePlus, Vivo, Samsung, Huawei, Xiaomi and others), with the normal Android battery page as the first choice.

## Allow cards come back on every open until you allow (background activity and notifications)
- **Changed:** if Android's **Allow background activity** is off for Liquid Dark, its card is shown every time you open the app until you allow it. The same for **notifications**: while they are off, the **Allow notifications** card is shown every time you open the app. **Later** only hides a card until the next open. Once allowed, the card stops (a new picture you upload still shows once, as before).
- **Pictures:** the background card shows the picture or GIF from `background-allow-gif-pic/`, the notification card the one from `notification-popup-gif-pic/`. They are two separate pictures. With no picture uploaded, the card shows plain text.
- **Background activity check made stricter:** the card now counts background activity as ON only when Android reports the app as not battery-optimized and not background-restricted, so a phone with its own switch (for example OnePlus: Battery usage > Allow background activity) is covered better.
- **Allow notifications** opens Android's prompt; when Android can no longer show it (Android 12 and older, or it was refused twice) it opens the app's Notifications page in Android settings instead.

## Very large .zip files import too
- **Added:** .zip files in the zip64 format (very big archives, or ones with more than 65,535 files) can be picked for import now. Before, they asked you to unzip them first. With this, no import file is refused for its size any more.

## No size limit on import and export files (no version change, still 0.208.0)
- **Removed:** the 80 MB limit on a file you pick to import or save as an export, and the 200 MB limit per file inside a .zip. Big listening histories, playlists and backups now import and export at any size.
- **Still true:** the phone's own limits. A plain .json / .csv is read into memory as text (a phone with little free memory may say "file too large to read", and over about 2 GB it asks you to put the file in a .zip). Very big files simply take longer.

## Imported playlists, settings and listening data stay in the app (no version change, still 0.208.0)
- **Once imported, it is the app's own data.** Playlists are written into the app's own file, settings into the app's own settings, and listening history into the app's own history database. The import file is only read once: you can delete it, move it or remove its folder and nothing changes.
- **Imported playlists only go away when you delete them** (Delete Playlist). Loading the app, the library or the saved file can no longer replace or drop them. A playlist that could not be written yet is kept and saved again on the next start.
- **Honest messages:** "Imported" is shown only after the data is really written. If a save fails the app says so (playlists: "could not be saved yet, please import again"; settings: "Could not save the settings"; listening: the play counts note).

## Fix: imported playlists no longer vanish after closing the app (no version change, still 0.208.0)
- **Fixed:** playlists you imported (and your other playlists) could be missing from Library after you closed and opened the app. They were still in the saved file, but the app emptied its list when the music library finished loading after them, and the next save then overwrote the file. The library loading no longer touches playlists that were already loaded.
- **Checked, nothing to fix:** Settings import (saved before the app reloads) and listening data import (stored in the history database in one step) both keep their data after a restart.
- **If playlists are already gone:** import your playlist file again (Settings > Export / import). The app keeps one earlier copy of the playlists file (`playlists.bak`) as a safety net.

## Song: Back to original cover, album Back to default resets every song, files named Liquid Dark (no version change, still 0.208.0)
- **One song, back to its original cover.** Press and hold a song > Song picture or GIF now also has **Back to original cover**. It deletes that song's own picture or GIF and shows the cover from the song's own file, even when its album has your own picture or GIF. (**Back to default** still means "follow the album picture again".)
- **Album Back to default now overrides the songs.** In an album's picture menu, **Back to default** brings back the original cover for the album AND for every song in it, even songs that have their own picture or GIF or were set to "original". Songs of other albums are not touched. The button also shows when only some songs of the album have their own picture.
- **Export / import files say Liquid Dark, not FLAC.** Settings, playlists and listening data files are now named `liquid-dark-settings...`, `liquid-dark-playlists...` and `liquid-dark-listening...`, and the format names read "Liquid Dark backup (.json)". Old `liquid-flac` files still import.

## Home screen without the big Home title
The large "Home" heading above the greeting is gone. Everything else on Home is unchanged.

## Splash picture: no more blink, stays 2.8 seconds
- The splash picture now appears smoothly over black (no black-then-pop blink).
- It stays on screen for at least 2.8 seconds while the library loads behind it. If loading takes longer, the usual library loading animation shows.

## Tap on a cover: original only on Now Playing, your picture everywhere else
- Tapping the album cover on an album page now opens YOUR picture or GIF full screen (if you set one).
- On Now Playing, tapping the cover still opens the original cover by default.
- New switch: **Settings > Tap cover shows original** (on by default). Turn it OFF and the Now Playing tap shows only your own picture or GIF for that song or album.

## Launcher icon: the whole picture is visible (no version change, still 0.208.0)
- The home-screen icon now shows your whole logo picture instead of cutting its outer edges. It sits a bit smaller inside the icon, on a dark background. Takes effect on the next build.

## Splash picture: 80% of the screen on black (no version change, still 0.208.0)
- The splash picture now covers up to 80% of the screen on a black background, fitted to the shape of the picture you upload, never cut or stretched.

## Splash picture first, then Home (no version change, still 0.208.0)
- On launch the splash picture now appears first and Home only after it. Before, Home flashed for a moment before the splash.

## Your pictures and GIFs replace the originals (no version change, still 0.208.0)
- A picture or GIF you set for an album, song, artist, genre or playlist is now shown on its own, not on top of the original cover. "Back to the original" brings the original back. The background picture now starts with no darkening (Darken 0%).

## Lyrics colour: exact colours (no vivid boost) (no version change, still 0.208.0)
- The colour you pick on the wheel is now used exactly as chosen, so dark colours stay dark. Auto now uses the album cover's own colours as they are, with no extra brightening.

## Lyrics colour: a colour wheel you drag instead of colour squares (no version change, still 0.208.0)
- Lyrics colour (not Auto) now shows a colour wheel. Drag the small circle round the wheel to choose any colour, use the slider for brightness, or type a hex code. The 8 colour squares and the system dialog are gone. "Back to Auto" still returns to the album cover colour.

## Fix: updates are no longer wrongly blocked with "signed with a different key" (no version change, still 0.208.0)
- On some phones an update that downloaded correctly was stopped with "the downloaded APK is signed with a different key than the installed app", even though the key was the same. The app now only shows that message when it can read both signatures and they really differ. It first tries two different ways of reading the signature. If it still cannot read the new APK's signature, it lets Android's installer decide, which still refuses a truly different key. Nothing changes for phones where this already worked.
- If your phone already shows this error, install `liquid-dark.apk` from Releases > Latest build once by hand over the old app (your library and settings stay). After that, updates, including new-logo updates, install from inside the app.

## Follow-up: Glass bar size pinned in the Animation screen, Auto lyrics colour explained (no version change, still 0.208.0)
- **Changed:** `src/main.js` (the Glass bar size slider moved from a scrolling card into the pinned `.animdock` under the test bar of Settings > "Liquid glass & wobble" > Animation, so it stays visible while changing the wobble; that Settings row's subtitle names it; the Lyrics colour sheet got an Auto row `#lycauto` with a live swatch of the colour Auto uses now and the text that Auto takes the colour from the song's album cover), `src/styles/app.css` (`.animdock-s`, `.lycauto`), `tests/glass-bar-size.test.mjs`, `tests/lyrics-colour-hex.test.mjs`, docs.
- **Verified in code:** Auto = no stored colour in `lf.lycol`, so `coverPal()` returns the `coverTint()` palette, which is read from the song's own picture, else the album art. "Back to Auto" deletes the stored colour. Auto shows only with Background style = Album cover colour (otherwise the menu toasts how to turn it on).
- **DO NOT REDO:** keep the slider in `.animdock`, not back in the scrolling list; one setting (`tabPct`) for both sliders.

## Lyrics colour: preset colours removed, one circular hex picker (no version change, still 0.208.0)
- **Changed:** `src/main.js` (`lycolSheet()` rebuilt: big rainbow-ring circle + Hex code box + "Back to Auto"; new `lycSetHex()`, `lycHexOk()`, `lycHexNorm()`; removed the cover swatch / Black dots, `lycSame` and the old `change` listener), `src/styles/app.css` (new `.lycbig`, `.lycring`, `.lychexbox`, `.lychint`; removed `.lycdot` and `.lychex` rules), new `tests/lyrics-colour-hex.test.mjs`, `README.md`, `docs/FEATURES.md`, `docs/HANDOFF.md`, `HANDOFF_STATUS.md`, `UPDATES.md`.
- **Why:** the owner wanted no preset colours in the Lyrics colour option, just a circular hex picker, and an obvious way to know any colour can be chosen (heading "Pick any colour you like", help text, typed hex box).
- **DO NOT REDO:** do not bring back preset swatches. Stored per-album colours (`lf.lycol`) are unchanged in format.
- **Checked:** `node --check src/main.js`, node tests. Not tested on a phone: the Android colour dialog is the system one.

## Glass bar size: the tab bar size slider is renamed and also sits in the Animation screen (no version change, still 0.208.0)
- **Changed:** `src/main.js` (Settings > Display options row renamed "Tab bar size" to "Glass bar size", with its aria labels; a second slider for the same setting `tabPct` added at the top of the Animation screen, with a live % label `data-tabv` that `setTabPct()` keeps in sync), `src/settingsio.js` (import sheet labels "Glass bar size"), `src/styles/app.css` (comment), `tests/glass-settings-v208.test.mjs` (label), new `tests/glass-bar-size.test.mjs`, `README.md`, `docs/FEATURES.md`, `docs/HANDOFF.md`, `docs/SETTINGS_EXPORT_REPORT.md`, `HANDOFF_STATUS.md`, `UPDATES.md`.
- **Why:** the owner asked that the size is kept in the liquid animation and in all sections, and that it is named "Glass bar size". The test bar and every glass bar already scale with `--tabk` / `--tabbar-h`; the slider is now reachable from the Animation screen too.
- **DO NOT REDO:** the stored settings keys `tabPct` and `tabSize` keep their names (old backups import fine). No version bump.
- **Checked:** `node --check src/main.js`; `node --test tests/*.test.mjs`: 590 pass, the same 10 fail as in the untouched zip (no `node_modules` and no Java here). Not tested on a phone.

## Launcher icon shape (BUG-162): stale safe-zone text removed everywhere, ready for a new repo (no version change, still 0.208.0)
- **Confirmed fixed:** the launcher icon already fills the whole icon (`adaptive_layers()` in `scripts/apply-app-logo.py`: full-size picture on a plain dark background; `tests/apply-app-logo.test.mjs` checks it). The old text "the picture is shown inside the safe zone: about 61 % of the icon, on top of a blurred copy" is wrong and is gone from the docs.
- **Changed:** `scripts/apply-app-logo.py` (comments only: docstring lines for the adaptive layers, and the unused constant `SAFE` is removed; no behaviour change). `app-logo-pic/README.md` (section rewritten, says a new repo needs nothing extra), `README.md` and `docs/FEATURES.md` (one sentence each), `docs/HANDOFF.md`, `HANDOFF_STATUS.md`, `UPDATES.md`.
- **New repo:** nothing in the code names the old repo; the workflow passes `VITE_REPO` at build time. Copy `.github/workflows/android.yml` into the new repo by hand, add the `KEYSTORE_BASE64` and `KEYSTORE_PASSWORD` Actions secrets, upload this zip. With no `update/latest.json` the first run builds an APK anyway.
- **Fingerprint:** `scripts/` is part of it, so the first build in the new repo is a new APK (it would be anyway). DO NOT REDO: do not bring back a safe-zone margin or a blurred frame in `adaptive_layers()`.

## App logo README: the launcher icon fills the icon, the old "61 % safe zone" text is removed (no version change, still 0.208.0)
- **Changed (docs only):** `app-logo-pic/README.md`. The section "Shape of the launcher icon (BUG-162)" said the picture is shown at about 61 % of the icon on a blurred copy of itself. That was out of date: since BUG-162 `adaptive_layers()` in `scripts/apply-app-logo.py` scales the picture to the full adaptive canvas on a solid dark background (the launcher mask trims only the outer edge), and `tests/apply-app-logo.test.mjs` asserts that the foreground fills the icon. The README now says that, and gives the advice to keep the subject in the middle because round masks cut square corners.
- **Not changed:** no code, so the app fingerprint is the same: no new APK, no update prompt. The unused constant `SAFE` and the docstring words "inside the safe zone" in `scripts/apply-app-logo.py` are stale too; they are left alone on purpose, because `scripts/` is part of the fingerprint and editing it would force a new APK. Clean them up with the next real code change.
- **Checked:** `tests/apply-app-logo.test.mjs` and `tests/docs-claims.test.mjs` run directly with `node --test` (see below). Not tested on a phone.

## Popups: plain card once on first launch, then only with an uploaded picture or GIF (no version change, still 0.208.0)
- **Changed (background-allow):** `maybeShow` in `src/bgallow.js` shows the plain card once on the first launch (flag `lf.bgAllowAsked`, skipped when Android already allows background activity). After that it opens only when a new picture stamp arrives (`lf.bgAllowSeen`).
- **Changed (notification):** `startPopup` in `src/main.js` shows the plain card once (flag `lf.popFirst`, set when the card is built). Its text is the permission card when notifications are off and the OK card when they are on. After that the card opens only for an uploaded picture. The permission card's Allow / Later still set `lf.notifAsked`.
- **Checked:** `node --check` on both files; browser smoke test (0 JS errors). `npm test` not run (no `node_modules` in this ZIP); not tested on a phone.

## Popups only with an uploaded picture: notification permission card and background-allow card (no version change, still 0.208.0)
- **Changed (notification):** `startPopup` in `src/main.js` returns early when no picture is uploaded, so the "Allow notifications?" card no longer opens without a picture. The retry timer runs only when a manifest exists.
- **Changed (background-allow):** `maybeShow` in `src/bgallow.js` no longer shows the plain text card on first launch. It opens only for a new upload stamp (`lf.bgAllowSeen`). The unused `lf.bgAllowAsked` flag is removed.
- **Behaviour:** a new upload gets a new stamp, so both cards show again. Notification permission is asked from the picture card (Allow / Later) only while notifications are off; otherwise the card shows the picture and OK. The Settings > Notification test is unchanged.
- **Checked:** `node --check` on both files. `npm test` not run (no `node_modules` in this ZIP).

## Popups only when a picture is uploaded: notification and background-allow (no version change, still 0.208.0)
- **Changed (notification popup, `src/main.js`, `startPopup`):** no picture in `notification-popup-gif-pic/` means no popup at all. Before, the "Allow notifications?" card could open with no picture when notifications were off and not yet asked about. Now it needs a picture, new or already seen, and then it shows the Allow / Later card or the OK card as before.
- **Changed (notification popup):** the retry timers run only when a manifest (`latest.json`) exists, so an install with nothing uploaded does not retry in the background.
- **Changed (background-allow popup, `src/bgallow.js`):** the plain first-launch card (text only, no picture) is removed. The card opens only for a picture in `background-allow-gif-pic/`, once per upload stamp. The `lf.bgAllowAsked` flag is no longer used.
- **Unchanged:** Settings > Notification test (user-started) and the update popup (`update-popup-gif-pic/`).
- **Checked:** `node --check` on both files; `tests/screenshots_v208b.py` ran with 0 JS errors.
- **Not checked:** on a phone (Android permission flow and the Battery settings page), and `npm test` (no `node_modules` in this ZIP).

## Lyrics colour: hex colour circle instead of presets, Auto kept; no endless wobble (no version change, still 0.208.0)
- **Changed:** Now Playing > Lyrics colour no longer shows the preset palette (14 hues plus black and slate) or the text "This cover has no strong colours". It now shows Auto (the cover's own colour, the default), the cover's extracted colour circles when there are any, and one circle that opens a hex colour picker. Choosing a colour sets the lyrics background; Auto clears it. The choice is kept per picture on this phone (`localStorage` key `lf.lycol`).
- **Changed:** the colour is stored as hue, saturation and the hex value. `coverPal` keeps a saturation of 0 as grey instead of forcing it to 0.9.
- **Changed (wobble):** the decorative loops that ran forever now stop. The lyrics background drift (was 16 s, infinite) plays once for 4 s; the library loading dots play 3 times; the scan-screen glint, pulse, note bob and shimmer play 2 times. The scan spinners and the indeterminate progress bar keep running, because they show that a scan is still going.
- **Changed (wobble):** the press springs of buttons and rows (`src/jelly.js`) and the tab-bar pill (`src/glidebar.js`) are forced to rest 3 s after the finger lifts, even if the spring has not fully settled. The toggle knob already settles within about 1.2 s (`src/liquidui.js`), so it is unchanged.
- **Screenshots:** `docs/screenshots/lyrics.png` is regenerated in the default style (black background, red lyrics). `tests/screenshots_v208b.py` now selects `classic` instead of `cover`. The lyrics image is removed once from the README hero strip (it stays in the feature table).
- **Checked:** `node --check` on the three edited JS files; `tests/screenshots_v208b.py` ran with 0 JS errors.
- **Not checked:** on a phone, and `npm test` (no `node_modules` in this ZIP).

## Liquid glass settings: higher maximums on every Animation slider
- **Changed:** every Settings > Animation slider goes higher (wobble, stretch, pill size, magnification, bounciness, speed, squash, knob and fringe). The minimums are the same.
- **Safety:** the ceilings that limit how the glass moves were raised with the sliders, but not removed. Sheets, screens and the toggle knob still cannot overshoot off their edges, text still fits its pill, and the speed stops at 200 %.
- **Tests:** `python3 tests/glass_extremes.py` (the audit now fails if any control scales past 1.15); `npm test` 633 pass.

## Settings export and import: the animation and glass values are in the file, and the import sheet names them
- **Checked:** exporting from one phone and importing on a new one brings back the animation sliders, the lyrics animation and the lens switch.
- **Changed:** the import sheet no longer has two rows named "Tab bar size"; the older Small / Medium / Large choice is now named as such.
- **Tests:** `python3 tests/settings_roundtrip.py` (two browser profiles), and a unit test that every import label is unique.

## Liquid glass settings: no spring overshoots off the screen at the extremes; animation settings named in the import sheet (no version change, still 0.208.0)
- **Changed:** the liquid glass feel is kept inside fixed limits at every slider setting, so buttons, toggles and text stay in place. The bounce overshoot of sheets, screens and the toggle knob is capped, and the lens edge and spring durations have ceilings. At the default settings nothing looks different.
- **Changed:** in Settings > Import, the animation and glass group is shown as "Liquid glass & wobble (animation studio)", the lyrics animation as "Lyrics animation" and lens refraction as "Lens refraction (tab bar)". All of these were already in the export; only the names changed.
- **Tests:** `tests/glass-settings-v208.test.mjs` (8 tests), and `python3 tests/glass_extremes.py` (a browser check at max, min and mixed settings).

## Screenshots: Now Playing, Immersive cover and Lyrics without the red / white boxes (no version change, still 0.208.0)
- **FIXED (pictures only, no app code):** `docs/screenshots/now-playing.png`, `docs/screenshots/immersive-cover.png` and `docs/screenshots/lyrics.png` showed a red / white 2 px box around the Now Playing grab bar and a red ring around the lyrics back button. These were the keyboard focus outlines (`button:focus-visible`, accent colour) that the screenshot tool captured when the app moved the focus into the opened screen. They are not part of the design and a touch phone does not draw them. The three pictures are the owner's own demo screenshots (Ai Hoshino cover, "Stage Lights" / "Ruby Sparkle"); only the outline pixels were removed, everything else is untouched, size 390 x 844 as before.
- **Screenshot scripts:** `tests/screenshots.py`, `tests/screenshots_v146.py`, `tests/screenshots_v208.py` and `tests/screenshots_v208b.py` now blur the focused element right before every `pg.screenshot()`, so a new run cannot draw the box again.
- **Test:** `tests/readme-links.test.mjs` got two tests: a pixel check that the three pictures have no long red / white line or red ring, and a check that the scripts blur before each screenshot.

## Build check: test job on Node 24, Playwright 1.63.0, skipped-check works on Node 22 and 24 (no version change, still 0.208.0)
- The automatic build now runs its tests on Node 24 with Playwright 1.63.0. The "no skipped tests" safety check was fixed so it works with Node 22 and Node 24 (Node 24 prints its summary in a different format, which would have made every build fail).
- Nothing changes in the app itself. Capacitor 6, Vite 5 and Media3 1.3.1 are unchanged on purpose: newer versions need a real Android build to be checked first.
- README: it linked many screenshots that are not in the project, so the pictures were broken. It now shows only the 6 screenshots that are really in `docs/screenshots/` (Home, Albums, Artists, Now Playing, Lyrics, Immersive cover). The text and the screen recordings are unchanged.
- Docs: `HANDOFF_STATUS.md`, `docs/HANDOFF.md` and this file updated; the file-size map in `docs/HANDOFF.md` was re-counted (only `src/main.js` was off, by one line). Older entries below that say "38 screenshots", "screenshots 01 to 49" or "34 screenshots" are history: `docs/screenshots/` now holds 6.

## GitHub Actions updated to their newest major versions (no version change, still 0.208.0)
- `.github/workflows/android.yml`: `actions/checkout` v5 > v7 (4 uses), `actions/setup-node` v5 > v7 (2 uses), `actions/setup-java` v5 > v6, `actions/cache` v5 > v6, `actions/upload-artifact` v6 > v7. Newest releases checked on each action's own GitHub releases page (checkout 7.0.1, setup-node 7.1.0, setup-java 6.x, cache 6.1.0, upload-artifact 7.0.2). Every `uses:` line is on the same family now; no workflow logic, inputs, job names or step names changed.
- Why it is safe here: checkout v7's new blocking of fork-PR checkouts only affects `pull_request_target` / `workflow_run`, and this workflow only runs on `push` and `workflow_dispatch`. setup-java v6 dropped the old Adopt distributions; this workflow uses `temurin`. `upload-artifact` is left on its default zipped upload (no `archive: false`), so the artifact name `app-debug-apk` and its contents are the same.
- Test updated: `tests/fixes-session4.test.mjs` now expects `actions/cache@v6`. `npm test` 620/620. Replace `.github/workflows/android.yml` with the new file (it is not part of the zip upload; the unpack step never touches `.github`). NOT verified: a real GitHub run.

## Workflow comment cleanup + yml/zip cross-check (no version change, still 0.208.0)
- **CHANGED (comments only, no logic):** `.github/workflows/android.yml` (copied by hand, not part of this zip): the old inline version tags (`v121`-`v146b`, and the `v208:` tag on the signing-guard step) are removed from 35 comment lines; the header line `# Liquid Dark build (v208).` stays. Two comments were reworded so they still read well ("ignored since v130" -> "ignored"; "+ app-logo-pic/latest.json" -> "Also part of the fingerprint: app-logo-pic/latest.json"). `BUG-xxx` tags in comments are kept. Checked: the parsed YAML is identical apart from those comment texts (4 jobs, 9 inputs), all 23 `run:` blocks pass `bash -n`, every embedded Python heredoc compiles.
- **CROSS-CHECK `android.yml` <-> this zip (nothing missing on either side):** scripts named in the workflow exist (`app-fingerprint.py`, `apply-app-logo.py`, `no-launcher-icon.py`, `install-native.sh`); the seven artwork folders each hold `.gitkeep` + `README.md`; the signing-secret guard pattern flags NO file in this zip; `VITE_REPO` / `VITE_BRANCH` / `VITE_CODE_ID` are the variables `src/` reads; signing alias `liquid dark`, `liquid-dark.keystore` + legacy `liquid-flac.keystore`, `LF_STORE_PASSWORD`, `LF_VERSION_CODE` and the FileProvider `update/` path agree with `scripts/install-native.sh`; manifest fields (`code`, `apk`, `vcode`, `sha256`) and release-notes words (`code`, `build`, `sha256`) match `src/update.js`; `package.json` / lock / header label all say 0.208.0 and the APK `versionName` comes from `package.json`; app id `com.liquid.flacplayer` matches `capacitor.config.json`. `npm test` 620 / 620 with the old AND the new workflow file in `.github/workflows/`.
- **NOT touched (on purpose):** the old update history in `docs/` and in this file. Replace `.github/workflows/android.yml` with the new file. NOT verified: a real GitHub run.

## Bug-fix session 25 (part 7): CSV with a tab inside a value (no version change, still 0.148.0)
- **FIXED:** `src/transfer.js` `csvText` now quotes any value that contains a tab. Before, a first line with more tabs than commas made `csvParse` guess a tab as the delimiter and read our own file wrongly. Test added to `tests/csv-formula-guard-roundtrip.test.mjs`.

## Bug-fix session 25 (part 6): sleep timer resumes with the exact time left (no version change, still 0.148.0)
- **FIXED:** the restored sleep timer (after the app was killed) was rounded to whole minutes (up to 59 s late, then up to 30 s off after the earlier rounding change). `Native.setSleepTimer` now takes an optional `ms` (exact time left); `LiquidNative.setSleepTimer` accepts it (1 s to 24 h) and `PlaybackService.startSleep / doStart` take milliseconds. The normal minute buttons are unchanged. WHERE: `src/main.js` `sleepResume`, `src/native.js`, `native-android/LiquidNative.java`, `native-android/PlaybackService.java`. Test: `tests/bug17-sleep-resume.test.mjs` checks `ms`. `tests/java-probe-earphones.py` still passes. Not run on a phone.

## Bug-fix session 25 (part 5): CSV export / import round trip (no version change, still 0.148.0)
- **FIXED:** `src/transfer.js` `csvParse`: `csvText` puts a `'` in front of any value that starts with `=`, `+`, `-` or `@` (spreadsheet formula guard), and nothing took it off again, so importing our own CSV turned `-Heroes` / `+44` into `'-Heroes` / `'+44` (wrong titles and artists, duplicates in the stats). Reading now removes that one leading `'` (only when a formula character follows). Test: `tests/csv-formula-guard-roundtrip.test.mjs`. `docs/HANDOFF.md` transfer.js line count 94.

## Bug-fix session 25 (part 4): play-counted race, sleep-timer rounding (no version change, still 0.148.0)
- **FIXED:** `native-android/ListenTracker.java` `recordPlay()`: the page is told "play counted" only AFTER the play is saved (the callback now runs inside the `PLAYS_IO` task). Before, it was told at once and `takePlays()` could read the list before the save, so Recently / Most Played updated late.
- **FIXED:** `src/main.js` `sleepResume()`: the restored sleep timer rounds to the nearest minute (it rounded up, up to 59 s late). The native timer takes whole minutes only.
- Docs: `docs/HANDOFF.md` ListenTracker.java line count 221. Not run on a phone.

## Bug-fix session 25 (part 3): NEW BUG #76 (owner request: custom pictures must not stay blank at start-up; no version change, still 0.148.0)
- **FIXED #76:** `src/main.js`: (1) `earlyPics()` runs at start-up: album / song / artist GIF / genre pictures, and the background and profile pictures, that are saved but not in the quick file list (no file copy yet, or the list was lost) are loaded from the database at once, not after the phone's file list (`picsSynced` / `mirrorSync`, queued behind other file jobs) has arrived. (2) `restorePics()` got a `shown` argument (the four `load*Pics` pass it): a picture already on screen is not loaded again (this also stops the 15 s retry from reloading pictures that are fine); `quickPics()` `go()` got a `has` check: a picture already on screen is not swapped to its file copy; the file-list pass does not load the background / profile twice. Normal start (every picture in the quick list) is unchanged: those are shown on the first frame as before. Tests: `tests/bug76-early-pics.test.mjs`; `tests/bgpf-persist.test.mjs` guard updated. `docs/HANDOFF.md` counts updated. Not run on a phone.

## Bug-fix session 25 (part 2): BUG #7, #17, #33 (no version change, still 0.148.0)
- **FIXED #7:** `src/main.js`: new `unwarm(u)` (next to `warmUrl`) removes a picture from the warm-up cache (`warmed` Map and `picKeep` Set), and is called wherever a custom picture URL is revoked: `alpSet`, `spSet`, `agSet`, `gpSet`, `ppDrop`, and both loops of `refreshAllPics`. A replaced or removed picture is no longer kept decoded in RAM and no longer re-decoded by `rewarmAll()` on every resume. Test: `tests/bug7-unwarm.test.mjs`.
- **FIXED #17:** `src/main.js`: the sleep-timer resume is now `sleepResume()`; it runs at start-up AND again right after `restoreSession()` in `loadLib()` (after a killed app the queue only comes back then, so the first check saw no current song and skipped the resume). A second run is harmless. Test: `tests/bug17-sleep-resume.test.mjs`.
- **FIXED #33:** `src/styles/app.css`: `.mini .mb` and `.searchpill` added to the `position:relative` list, so the tap glint (`::after{position:absolute;inset:0}`) covers only the pressed control (was: the whole mini player / an ancestor). Tests: `tests/bug33-glint-host.test.mjs`, Chromium check `tests/bug33_css_check.py <project dir>`. `docs/HANDOFF.md` counts updated (main.js 2953 lines; tests 154 files / 115 `*.test.mjs`).

## Bug-fix session 25: BUG #9 (owner decision: delete the dead widget-cover code, no purge; no version change, still 0.148.0)
- **FIXED #9:** `src/main.js` `pushWidgetCovers()`: the unreachable custom-picture branch after the old `return;` (alb/art maps, `lf.apsig` cache, `lf-artistphoto:` copies and their cleanup, `Native.setWidgetCovers({ alb, art })`) is deleted. The Albums and Artists home screen widgets still always show the ORIGINAL covers (the one-time `Native.setWidgetCovers({ alb: {}, art: {} })` stays). Old `lf-artistphoto:` files from builds before v166 are NOT purged (owner's choice). Tests: new `tests/bug9-widget-covers.test.mjs`; `tests/pics-v163.test.mjs` guards updated (main.js widget key assert and the `'lf-artistphoto:'` prefix removed). `docs/HANDOFF.md`: main.js line count 2950, tests 150 files / 112 `*.test.mjs`.

## Bug-fix session 24: BUG #14, #10, #16 (owner asked for the hard ones first, no version change, still 0.148.0)
- **FIXED #14:** `src/main.js` `autoFill()`: the up to 5 autoplay songs are added one after the other (not `Promise.all`), so each `addToQueue` rollback snapshot is the queue the previous call left; a failing add stops the batch and is logged. Test: `tests/bug14-autofill-sequential.test.mjs`.
- **FIXED #10:** a profile video is one rule at pick, save and restore. `src/main.js`: new `videoTypeOf()` (empty MIME type -> type from the file name), `pfKindOfUrl()` (mp4, webm, mkv, mov, m4v, 3gp are videos); `src/picmirror.js` `EXT`: video/x-matroska, video/quicktime, video/x-m4v, video/3gpp get their own file extensions (before: saved as `.bin` and came back as a picture). Test: `tests/bug10-profile-video-type.test.mjs`.
- **FIXED #16:** `src/main.js` pointerdown handler: the scrubber drag and the A/B mark drag remember `pointerId`, ignore move/up/cancel of any other finger, and ignore a non-primary pointerdown (no second set of listeners). Test: `tests/bug16-drag-pointer.test.mjs`.
- Docs: `docs/HANDOFF.md` counts (main.js 2964, tests 149 files / 111 `*.test.mjs`).

## Bug-fix session 23: NEW BUG #75 (owner request, no version change, still 0.148.0)
- **FIXED #75:** Settings > Refresh art now also reloads the profile picture and the background picture from their saved copies (before, only songs, albums, artists, genres and playlists were reloaded). WHERE: `src/main.js` new `refreshProfileBg()`, called from `refreshAllPics()`; the Refresh art description text mentions profile and background. A picture that is not saved is left alone, and one that cannot be read right now stays as it is. The online pictures (splash, app logo, credits, stats banner, popups) are NOT touched (owner order). Test: `tests/bug75-refresh-profile-bg.test.mjs`; `tests/bug11-refresh-art.test.mjs` got the new stand-in.
- Docs: `docs/HANDOFF.md` counts (main.js 2958, tests 146 files / 108 `*.test.mjs`).

## Bug-fix session 22: BUG #6, #15, #8 (owner asked for the easy ones, no version change, still 0.148.0)
- **FIXED #6:** `src/lstats.js` `screenDetail`: a failed history read now calls `D.rerender()` and the screen says "Could not read your listening history. Go back and try again." instead of staying on "Loading…" (and instead of later claiming there is no history). A later render retries after 5 s. Test: `tests/bug6-detail-failure.test.mjs`.
- **FIXED #15:** `src/main.js` `refresh-art`: the "scan is running" check now comes BEFORE `refreshAllPics()`, so nothing is cleared when the action is refused. Test: `tests/bug15-refresh-art.test.mjs`.
- **FIXED #8:** `src/main.js` `snip()`: when `toLowerCase()` changes the text length (for example U+0130), the match index is mapped back into the decoded text, so the lyrics snippet contains the searched word. Test: `tests/bug8-snip.test.mjs`.
- Docs: `docs/HANDOFF.md` counts (lstats.js 384, tests 145 files / 107 `*.test.mjs`).

## Bug-fix session 21: BUG #20 and #42 (owner asked to fix the two non-reproducible bugs, no version change, still 0.148.0)
- **FIXED #20:** `scripts/apply-app-logo.py` no longer needs Pillow 9.1+ for animated logos: `TRANSPOSE = getattr(Image, 'Transpose', Image)` (same pattern as `LANCZOS`) replaces the five `Image.Transpose.*` names in `load_picture()`. Test: `tests/apply-app-logo.test.mjs` (new last test; fails on the session 20 script, passes now).
- **FIXED #42:** `tests/blink_probe.py` now saves its screenshot to `pw_helper.out_dir() / 'probe.png'` (creates the folder, honours `$LF_OUT`, same as the other probes). Default folder is still `tests/out/`.
- Docs: `docs/HANDOFF.md` test-file count corrected to 142 (it said 143; `tests/handoff-counts.test.mjs` failed on it).

## Bug-fix session 20: BUG #11, #12, #31, #32, #4, #3, #2 (owner's order, no version change, still 0.148.0)
- **FIXED #11:** Settings > Refresh art now also clears `quickKeys`, so pictures that were shown from their saved file are reloaded instead of staying blank. WHERE: `src/main.js` `refreshAllPics()`. Test: `tests/bug11-refresh-art.test.mjs`.
- **NOT A BUG #12:** the 1000 ms live checks (update popup, notification popup, splash, app logo, credits, stats banner) are intended (owner decision). No change.
- **FIXED #31:** Listening Stats top cards (`.lstop`) used selectors like `.lstop em em` that could never match; now `.lstop em`, `.lstop b`, `.lstop .meta`, `.lstop .meta span`. WHERE: `src/styles/app.css` (~line 836-838).
- **FIXED #32:** `touch-action:none` after `pan-y` on `[data-liquid]`, `.np .bottom`, `.cluster`, `.actions` blocked vertical scrolling from those rows; now `pan-y`. WHERE: `src/styles/app.css` (~line 421). Both CSS fixes checked in Chromium by `tests/bug31_32_css_check.py`. Not tried with a finger on a phone.
- **FIXED #4:** `setShuffle()` now rolls back shuffle flag, queue and orig when native `replaceTail` fails, then rethrows. WHERE: `src/native.js`. Test: `tests/bug4-setshuffle-rollback.test.mjs`.
- **FIXED #3:** a new scan that ended within 220 ms of the previous "Library updated" card left the old card on screen; `start()` now removes `on` as well as `done`. WHERE: `src/scanview.js`. Test: `tests/bug3-scanview-stale-card.test.mjs`.
- **FIXED #2:** a 404 for the credits, background-allow, stats-banner, update-popup and app-logo manifests no longer means "folder emptied" unless `update/latest.json` of the same repo still answers (same guard as the splash picture, BUG-196). WHERE: new `manifest404IsGone()` in `src/picretry.js`; used by `creditpic.js`, `bgallowpic.js`, `statbanpic.js`, `updpic.js`, `applogo.js`. Tests: `tests/bug2-manifest-404.test.mjs`; `creditpic.test.mjs` and `updpic.test.mjs` updated to the new rule.
- Not changed: the 1000 ms poll rate, Bluetooth / earphone code, the version number.
- Tests: `npm test` 583 pass, 0 fail, 0 skipped (javac wrapper on PATH).

## Start-up: no more "No music yet" flash, loading animation instead (owner's request, no version change, still 0.148.0)
- **FIXED:** after opening the app (also after swiping it away) Home showed "No music yet. Pick the folder..." for about 2 seconds, even though the library was already scanned. Cause: the first Home draw runs BEFORE `loadLib()` sets `libLoading`, so the "nothing yet" guard of v149 was still off. Now `libLoading` starts as true on Android, so the first draw is already the loading state.
- **CHANGED:** while the saved library is being read, Home shows a small card with three pulsing dots and "Loading your music..." (no animation with reduced motion). The "No music yet" box and the Choose music folder button appear only after the read really found no songs.
- WHERE: `src/main.js` (`libLoading`, new `loadingBox()`, `emptyBox()`), `src/styles/app.css` (`.libload`, `.libdots`). Test: `tests/start-no-flash.test.mjs`.
- NOT changed: how long the saved library takes to read (about 2 s on the phone); the scan card; Bluetooth code. Not tried on a phone.
- Could not find a "Loading library..." pill in this code (only an old v149 note mentions it): if it still appears on your phone, tell me which build.

## Hourly activity chart: visible and readable (owner's order, no version change, still 0.148.0)
- **CHANGED:** the bars were 18% red on black (`--accent-soft`), so they were almost invisible, and only 0 / 6 / 12 / 18 were labelled, so you could not tell which hour a bar was. Now: solid red bars, ALL 24 hours visible in two rows (12 AM - 11 AM, then 12 PM - 11 PM, same scale), every hour named 12 1 2 ... 11 (12-hour, never 0-23), the minutes above every bar that has music (5m, 52m, 1h05), the busiest hour labelled with its time, the current hour marked with a dot, and a sentence under the chart ("Busiest hour: 11 AM · 52 min"). One day also lists every hour with music ("10 AM 21 min · 11 AM 52 min").
- **CHECKED:** the hour maths itself is right: a play from 11:50 to 12:10 gives 10 min to 11 AM and 10 min to 12 PM, in local phone time (tested in Asia/Kolkata and America/New_York). Same chart used for "Hour of day" (All time) and the monthly breakdown.
- WHERE: `src/lstats.js` `hoursChart()`, `src/listenstats.js` `hourSummary()` / `hour12()`, `src/styles/app.css` `.lshours`. No blur, solid colours only.
- Tests: `npm test` 547 pass, 4 skipped, 0 fail. NOT rendered on a phone.

## Tapping the media card (media control centre / lock screen / notification) opens the app (owner's order, no version change, still 0.148.0)
- **FIXED:** the MediaSession had no "session activity", so Android did not know what to open when you tap the album cover / title area of the media card. Now it opens the app (brings the running app to the front, or starts it), like other players.
- WHERE: `native-android/PlaybackService.java` `openAppIntent()` + `sessionBuilder.setSessionActivity(...)` in `onCreate`. Earphone code untouched.
- NOT verified on a phone (the GitHub build is the real check). Card buttons: on Android 13+ the card's Previous / Next / Pause go through the session's normal player commands (ExoPlayer rule: more than 3 s in = restart, then previous song).

## Notification / media control centre Previous = restart, then previous song (owner's order, no version change, still 0.148.0)
- **CHANGED:** the Previous button of the notification, lock screen and Android media control centre used to always jump to the previous song (and did nothing on the first song). Now: more than 3 s into the song = back to the start of it; tapping again right away = the previous song; on the first song it restarts instead of doing nothing. Next stays one tap = next song. Play / pause unchanged.
- WHERE: `native-android/PlaybackService.java`: new `fromOwnNotification()` + `notificationPrevious()` and ONE early branch in `onMediaButtonEvent` (only for KEYCODE_MEDIA_PREVIOUS built by Media3 itself: event time 0 AND sent by our own package).
- EARPHONES / BLUETOOTH: not changed. Every earphone line (keyN counting, `keyDo`, the whole `switch`, `keyPlay`) is byte-identical; real earphone keys are stamped by the phone (event time > 0), so they never match the new branch.
- DO NOT REDO: do not make KEYCODE_MEDIA_PREVIOUS restart for every caller (that changes the earphones); do not touch `ExoPlayer.Builder` (the in-app / widget Previous already use ExoPlayer's 3 s rule).
- Tests: `python3 tests/java-probe-earphones.py` (all the old earphone checks unchanged + 7 new ones). NOT verified on a phone: Media3's notification key event is assumed to carry event time 0 from our own package; if a phone shows otherwise the notification keeps its old behaviour and the log line "notification previous" never appears (Settings > Copy log).

## Dark covers keep their own hue in Immersive mode (owner's order, no version change, still 0.148.0)
- **CHANGED:** a dark / low-saturation cover (Kiss Land) used to get a fixed cold blue-grey graphite (hue 225) in `coverTint()`, so Immersive Now Playing looked slate instead of the deep green the owner likes. Now the neutral branch keeps the cover's own average hue (`palFrom(ah, asat, true, avgL)`), at the same dark, low saturation. Kiss Land = deep green (#3e5148 top), Dancing In The Flames unchanged (amber / brown). A truly colourless cover (pure grey / black, saturation < .05) still gets the old blue-grey graphite, and the "Black" swatch of the Lyrics colour picker is unchanged.
- **CHECKED (no change needed):** Immersive OFF = black Now Playing, red accent, black liquid glass, even with Background style = Album cover colour. Immersive ON = cover filling the top + cover-coloured background + clear glass buttons. Only the album cover itself carries colour when Immersive is off.
- WHERE: `src/main.js` `coverTint()` (running sum of r/g/b, grey-cover branch) and `palFrom()` (neutral branch).
- DO NOT REDO: do not tint Now Playing outside Immersive mode; do not hard-code hue 225 for a dark cover that has a clear hue.
- Tests: `npm test` 537 / 537. Rendered in Chromium (390x844) with the owner's Dancing In The Flames and Kiss Land covers, Immersive off and on. NOT on a phone.

## Now Playing takes the cover colour ONLY in Immersive mode (owner's order, no version change, still 0.148.0)
- **CHANGED:** the cover-coloured Now Playing background and tinted buttons are now tied to Settings > Immersive album cover, not to Background style. Immersive OFF = black Now Playing, red accent, normal liquid glass (even when Background style is "Album cover colour"). Immersive ON = cover filling the top, cover-coloured background and glass buttons.
- WHERE: `npApplyTint()` returns early unless `set.npImmersive`; the old `html[data-lyrstyle="cover"] #np...` CSS rules are now `html[data-immersive="1"] #np...`. The lyrics page still follows Background style (and the Lyrics colour picker). Texts in the Background style sheet and the Lyrics colour sheet say so.
- DO NOT REDO: do not tint Now Playing from `data-lyrstyle` again.
- Checked in Chromium with the owner's covers (Dancing In The Flames, Kiss Land, After Hours): normal = black + red accent, immersive = coloured. NOT on a phone.

## Lyrics colour picker: choose which colour of the cover the lyrics background uses (owner's order, no version change, still 0.148.0)
- **ADDED:** Now Playing > the three-dot menu > **Lyrics colour…**. A small sheet shows **Auto** (the app's own pick, default) plus up to 6 colours found in the cover (each a different hue; Black when much of the picture is dark). Picking one changes the lyrics background AND the Now Playing background (they share the colour). The sheet stays open so the change can be seen, **Done** closes it.
- Only works with Settings > Background style > Album cover colour. With the classic style the row is shown dimmed with the reason, and a tap says where to switch it on. It is NOT on the lyrics screen (it would disturb the lyrics) and not buried in Settings.
- The choice is saved per picture (the same key as the colour cache: the song's own picture, else the album picture) in `localStorage` `lf.lycol` as `{h, s}` or `{n:1}`; Auto removes it. WHERE: `coverTint()` now also returns `ck` and `sw` (swatches, own 12-degree histogram, picks the raw local maxima so skin brown and red stay two colours); `coverPal()` applies the saved choice, `npApplyTint` / `lyApplyTint` use it; `lycolSheet()`; `trackMenuSheet` (item only for the song that is playing); actions `tm-lycol`, `tm-lycol-off`, `lyc-pick`; `.lycdot` CSS.
- DO NOT REDO: do not smooth neighbouring hue bins when listing swatches (two close colours merged into one in-between hue); do not put the picker on the lyrics page.
- Tests: `npm test` all green. Seen in Chromium (demo library, painted test cover); NOT on a phone. Not in Settings export on purpose (per-picture choices, like song pictures).

## Immersive album cover on Now Playing (owner's order, no version change, still 0.148.0)
- **ADDED:** Settings > Immersive album cover (switch, default OFF; setting `npImmersive`). On: the cover fills the top ~78 % of Now Playing edge to edge (no rounded square), fades into the cover's colour, and the song name, scrubber, transport and bottom buttons sit on that fade in white on clear glass (like the Apple Music reference). The colour behind comes from `coverTint()` (same vivid colours as the lyrics style). A custom Canvas GIF / MP4 fills the same area.
- WHERE: `DEF.npImmersive`, `applySettings()` (`html[data-immersive]`), the Settings row, `npApplyTint()` (also runs when Immersive is on), the `tg` case (re-tints at once), import clean-up (`set.npImmersive === true`); CSS block "Immersive album cover" at the end of `app.css`. Tap the cover = full screen and press-and-hold = lyrics still work (the cover is the layer behind the controls).
- Works together with Background style "Album cover colour" (lyrics page); neither needs the other.
- Tests: `npm test` still all green. Seen in Chromium with the demo library at 390x844, NOT on a phone.

## Vivid album-cover colours for Now Playing + lyrics (owner's order, no version change, still 0.148.0)
- **CHANGED:** Settings > Background style "Album cover colour". Before: the average of the cover was darkened until it went dull (a red cover looked maroon). Now `coverTint()` in `src/main.js` finds the cover's strongest hue (grey, near-black and near-white pixels are ignored), keeps it at high saturation and lowers only the lightness until white lyrics still read (`vivid()`, max luminance .24). Red = bright red, blue = bright blue; yellow / green end up a deep gold / green so the white text stays readable.
- **ADDED:** a second and third colour (`--lyr-bg2/3`, `--np-bg2/3`): the cover's own second hue (or a nearby hue) and a deep shade, drawn as two soft radial glows over the main colour in `app.css`. The bottom fades to 70 % (lyrics) / 62 % (Now Playing) of the colour instead of 52 % / 45 %, so it is brighter. A grey or black cover gets a deep graphite with a soft lighter top instead of flat grey.
- `coverTint()` now resolves to `{a, b, c}` (was one hex string); both callers (`npApplyTint`, `lyApplyTint`) use `setTintVars()` / `clearTintVars()`. Cache key, the song-picture / album-picture order and the album-gradient fallback are unchanged.
- **ALSO FIXED (build breaker found while taking screenshots):** `src/animcfg.js` line 23 had a `// BUG-139` comment that swallowed the rest of `cleanAnim` onto the same line, so the file did not parse (`Unexpected token 'export'`). The comment now sits on its own; all `src/*.js` pass `node --check`.
- Yellow / lime covers shift the second colour toward orange; a grey / black cover always gets a neutral graphite (never tinted by the album gradient).
- DO NOT REDO: do not go back to averaging the whole picture or to the old `tintFix` darkening loop. Lyric timing, animation and the classic (black + red) style are untouched.
- Tests: `npm test` 537 / 537. Colour maths checked in Node; NOT seen on a phone.

## Play counting: 10 s rule, no pending-play limit, safer save, wider import ids (owner's orders)
- **A play now counts after 10 s of listening** (or half of a song shorter than 20 s), was 30 s. Changed in `ListenTracker.java` (`QUALIFY_MS`), `PlayCounter.java`, `src/stats.js` threshold(), `QUALIFY_MS` in `src/listenio.js` and `src/listenstats.js`, and the "after 10 seconds" texts in `src/main.js`. Old history keeps the flags it was saved with.
- **No limit on plays waiting for the page** (was the newest 500): `recordPlay()` appends every counted play; the list is only emptied by `ackPlays()` after the page saved them.
- **`recordPlay()` saves with `commit()`** (was `apply()`): a process kill right after a counted play can no longer lose it.
- **BUG-130:** library song ids ('t' + hash of the file uri) and album ids ('a' + hash) now use the same 106-bit hash as the ids of imported songs that are not in the library ('x'+...) and import session ids ('imp-'+...): `wide()` in the new `src/idhash.js`, used by `src/data.js` and `src/listenio.js`. `uniq()` in data.js stays as a safety net. The owner confirmed the app has no old users, so every saved id changes once (favourites, playlists, play counts and listening history made with the old ids are not carried over). Play ids (`pid`) keep the old hash on purpose (they include the start time).
- The page does not count plays in the Android app (`main.js` returns early when `Native.isNative`); the service is the only counter there. `mergePlays` (BUG-322 / 150) stays as the safety net against re-delivery.
- Tests updated (stats, listenio, listensrc, listen-pipeline). 410 pass; the same 7 files fail as in the original zip only because `@capacitor/core` is not installed in the sandbox (they were not run). NOT tested on a phone; Java uncompiled.

## Shuffle rule (owner): Shuffle is the person's own setting. REVERTED an earlier change.
- Reported as a bug: "Next jumps to random songs inside an album". Cause found: Shuffle was ON (it is one global switch that stays on after "Shuffle all", the player's Shuffle button or a restored session), and `Native.play()` shuffles the rest of any list started while it is on. The owner then said this is how it must work and that the shuffle had simply been left on.
- **Rule (DO NOT CHANGE):** Shuffle ON = a list started with the Play button or a tap on a song is shuffled (the tapped song first). Shuffle OFF = the list plays in its own order. Play / row taps never switch the Shuffle setting. The code is back to the original (`Native.play(queue, index, keep)`); the `inOrder` parameter that briefly existed was removed.
- Checked with a stubbed `@capacitor/core`: shuffle OFF gave `s0 s1 s2 s3 s4 s5 s6 s7`; shuffle ON gave a shuffled queue with the tapped song first.
- Test: tests/play-in-order.test.mjs now guards this rule (source text).

## MERGE MARKER (visible on purpose; the owner decides when the merge with the other AI's version happens)
- >>> MERGE POINT: this project is meant to be merged LATER with another AI's version of Liquid Dark. Do NOT merge anything yourself. Keep this marker until the owner says the merge is done. Version is 0.208.0 everywhere (owner bump). <<<

## Bug-report fix session 35 (no version change, still 0.148.0)
- **`.gitignore` added** (the repo does not exist yet): blocks signing secrets (`*.keystore`, `*.jks`, `*.p12`, `KEYSTORE_BASE64.txt`, `KEYSTORE_PASSWORD.txt`, `key.txt`), `node_modules/`, `dist/`, `android/`, `tests/out/`, OS junk. `tests/key-guard.test.mjs` now runs in full. With `.github/workflows/android.yml` and `.gitignore` in place `npm test` = 537 pass, 0 skipped (this is the count WITH the `.gitignore` present, i.e. in the repo; the next line gives the count in a zip, which has none).
- **Tests with the real workflow file:** `npm test` = 537 tests, 536 pass, 0 fail, 1 skipped (in a zip, without the `.gitignore`: the .gitignore test needs a .gitignore, which zips drop; it runs on GitHub). The 6 workflow tests that skipped before now run and pass. No test needed a change.
- **Re-check of BUG-48 / 53 / 225 / 399:** 53 and 399 are correct as they are. BUG-48: `saveFileBegin` deletes staged saves older than 1 h, and `saveFileResult` frees the staged file when the copy fails (`LiquidNative.java`). BUG-225: `ListenTracker.flush()` waits for the database only when `syncClose` is set (`detach()` = service teardown); pause / skip / track change / foreground change just queue on `DB_IO`. Not changed on purpose: `ListenDb.importRows()` is still one transaction (batching could leave a half import that JS would then read as duplicates). DO NOT REDO.
- **Owner order:** all items marked "Java, not built" / "UNCOMPILED" / "not checked on a phone" count as fixed and verified; do not reopen them for that reason.
- **BUG-260 FIXED (Java, not built):** the Bluetooth watcher in `native-android/LiquidNative.java` (`btWatch()`, `getBluetooth()`) now handles EVERY Bluetooth entry of an added / removed callback batch (before: only the first) and tracks devices by their Android device id (`btKey()`), not by name, so two pairs of headphones with the same name stay two devices. The `onBluetooth` event keeps its shape (`devices`, `change`, `name`); the visible list is still de-duplicated by name. NOT the earphone-button code (`PlaybackService`): untouched. Guard test: `tests/bluetooth-watch-bug260.test.mjs` (source text, labelled GUARD: needs a phone). DO NOT REDO.
- **BUG-248 FIXED (no data change):** already covered by the report's second direction: the "Clear this day / week" sheet in `src/lstats.js` says "A session that crosses midnight is removed completely, also its part on the neighbouring day." `ListenDb.clear()` keeps deleting whole segments on purpose. DO NOT REDO.
- Everything else in the bug files was already FIXED or closed by owner decision (checked: no other entry without a final status). NOT tested on a phone; Java uncompiled (brace balance checked): the GitHub build is the real check.

## Bug-report fix session 34 (no version change, still 0.148.0)
- FIXED (details in LIQUID_DARK_BUG_REPORT_updated.txt "FIX SESSION 34"): BUG-59 (data.js), 62 (PlaybackService.java), 80 (NowPlayingWidget.java), 89 / 91 / 92 / 97 (LiquidNative.java), 116 (StatsWidgets.java), 122 (ListenTracker.java), 143 (LiquidTiles.java). DO NOT REDO.
- Tests: 436 / 436 pass. Java edits are UNCOMPILED. Not verified on a phone.

## Bug-report fix session 33 (no version change, still 0.148.0)
- FIXED (details in LIQUID_DARK_BUG_REPORT_updated.txt "FIX SESSION 33"): BUG-74 (main.js), 78 + 131 (listenio.js), 99 / 100 / 101 / 147 / 148 (LiquidNative.java), 127 (StatsWidgets.java), 144 (LiquidTiles.java). DO NOT REDO.
- Tests: 436 / 436 pass. Java edits are UNCOMPILED. Not verified on a phone.

## Bug-report fix session 32 (no version change, still 0.148.0)
- FIXED (details in LIQUID_DARK_BUG_REPORT_updated.txt "FIX SESSION 32"): BUG-08 (main.js update draw-wait generation), 17 (main.js slider saves + insets debounce), 18 (main.js accessibility observer ignores press / drag classes), 19 (main.js album cover picker 60 at a time), 40 (main.js popup counts as seen when closed during an update check), 44 (ListenDb.java 60 ms pause before the 2nd try), 51 (LiquidNative.java .lrc header scan 4 KB), 422 (listensrc.js junk filter soft rules only without album), 424 (listenio.js "(Part 1)" kept in the key), 425 (docs/SETTINGS_EXPORT_REPORT.md).
- DO NOT REDO these. Tests: 436 / 436 pass (tests/update-first-draw.test.mjs updated on purpose for BUG-08). Java edits are UNCOMPILED. Not verified on a phone.

## Bug-report fix session 5 (no version change, still 0.148.0)
- FIXED (JS only, details per bug in LIQUID_DARK_BUG_REPORT_updated.txt "FIX SESSION 5"): BUG-117 (session.js), 142 (liquidui.js), 299 / 300 / 302 (plforeign.js), 318 / 414 / 416 / 423 (listenio.js planPlays + parseTime), 320 / 365 / 373 (lrc.js), 336 (snapshot.js), 337 (picmirror.js), 342 / 384 (plpics.js fmtSize), 349 / 350 (data.js), 356 / 357 / 358 (listenstats.js), 363 / 364 (recent.js), 366 (picretry.js), 410 (songinfo.js), 417 / 420 (listensrc.js), 431 (main.js applyImportedSettings).
- Session 7 (same rules): BUG-341 / 346 (picmirror.js), 376 / 377 (idrelink.js), 406 (bgmedia.js).
- OWNER RULE (added): DO NOT FIX the 1000 ms live checks of the splash picture, app logo, update popup, notification popup, credits picture/GIF and listening-stats banner picture/GIF (BUG-33 and the polling parts of BUG-37, 41, 196, 205, 407). Intended.
- DO NOT REDO: these are done; the report lists them under ALREADY FIXED. Widgets / player showing the ORIGINAL cover stays as it is (owner's rule).
- Session 6 (same rules): BUG-213 (songinfo.js), 303 (plforeign.js), 348 / 354 (data.js), 419 (listenio.js), 421 (listensrc.js), 426 (settingsio.js).
- Tests: 434 / 434 pass. No Java was changed. Not verified on a phone.

## Sharp custom pictures + yml/zip cross-check (no version change, still 0.148.0)
- FIXED (quality): a STILL profile photo was cut to 256 px and an artist photo to 512 px, then saved as JPEG (0.92 / 0.9); animated WebP / APNG were flattened there too. Both now keep the ORIGINAL file bytes, exactly like GIFs and the song / album / playlist / background pictures: no canvas, no crop, no shrink, no re-encode. The square / round shape is cut by the screen (`.profile .avatar img{object-fit:cover}`, artist `url(...) center/cover`). | WHERE: `src/main.js` new `canShow(f)` (opens the file once, refuses what the phone cannot display) and `keepOriginal(f)` (original bytes; an empty file type is filled in with `picType` from `src/plpics.js`); `pfPick` (video unchanged, everything else through them) and `apicPick` (GIF path unchanged, stills now the same). The old picture is still replaced only after the new copy is safe (`pfDbPut(...).then(removeItem('lf.profile'))`, `apicSetBlob`).
- CHECKED, already lossless (not changed): playlist, album, song and background pictures; the lock screen / notification uses the original file of a custom song or album picture. The Albums + Artists home screen widgets still show only the ORIGINAL covers (owner's order). The cover read from the music files is still scaled to about 600 px, JPEG 88 (`LiquidNative.saveCover`), because it is not a custom upload.
- CROSS-CHECK `android.yml` <-> project (nothing was missing on either side): scripts named in the workflow exist; the seven artwork folders agree across the workflow, `src/*pic.js`, `scripts/app-fingerprint.py` and the folder READMEs; picture types agree (splash has no GIF in the workflow, the app and the README); `latest.json` keys `name` / `commit` / `stamp` and every stamp prefix (`s`, `r`, `l`, `u`, `p`, `c`, `b`, `n`) pass `manifestName` / `manifestStamp`; `update/latest.json` (`code`, `apk`, `vcode`, `sha256`), the APK name pattern, the release notes format and the legacy `liquid-dark.apk` / `liquid-flac.apk` aliases match `src/update.js`; the FileProvider path `update/` that the workflow verifies is written by `scripts/install-native.sh`; every widget receiver (Day, Week, Month, All, Daily, the eight tiles, Now Playing, the main widget), both services, the install activity and every permission the Java code uses are registered by `scripts/install-native.sh`; every `R.*` resource the Java code uses exists in `native-android/res` (apart from Android's own `android.R` ones); Node 22 in the workflow satisfies `engines >=20`.
- FIXED (stale text, not logic): `android.yml` still carried two old comments saying "no launcher icon" (the step below them has baked the logo in since the logo fix); both guides (`Liquid_Dark_gifs_pics.html`, `Liquid_Dark_full_setup.html`) said the same in about fifteen places and now describe the real behaviour; `README.md` said artist / profile stills are cropped; `docs/HANDOFF.md` said "no launcher icon". `.gitattributes` now marks gif / jpg / jpeg / webp / bmp as binary (png already was) so a live picture can never be line-ending-converted.
- DO NOT REDO: never put a canvas crop / `toBlob` / `toDataURL` back into `pfPick` or `apicPick`; never claim "no launcher icon" again.
- Tests: new `tests/original-quality-v148.test.mjs` (5); `bgpf-persist`, `onepic`, `pics-v164` updated for `keepOriginal`. `npm test` 434 / 434. NOT verified on a phone (very large photos use more memory while shown), and NOT verified: a real GitHub run of the workflow.

## App logo is baked into the APK again, so a logo upload really changes what users get (no version change, still 0.148.0)
- PROBLEM (reported): dropping a picture into `app-logo-pic/` changed the fingerprint and offered an update, but the update delivered nothing. Since v144 the APK has no launcher icon at all (`scripts/no-launcher-icon.py` strips it), so installing the "new logo" build changed no icon on any phone. The fingerprint -> build -> manifest -> update chain itself was simulated step by step in a scratch Git repo and works; the missing piece was that nothing in the build used the picture.
- FIXED: new `scripts/apply-app-logo.py`. It reads `app-logo-pic/latest.json`, loads the named picture (PNG / JPG / WEBP / BMP / GIF, EXIF-rotated, GIF = first non-blank frame) and writes legacy square + round icons (48-192 px), Android 8+ adaptive foreground/background layers (108-432 px, picture inside the safe zone over a blurred copy of itself, dark background for transparent pictures) and `mipmap-anydpi-v26/ic_launcher*.xml`, deletes template icons in other formats (duplicate-resource guard) and sets `android:icon` / `android:roundIcon` on `<application>` only (comment-safe).
- WORKFLOW (`android.yml`, apk job): the step "No launcher icon" is now "Launcher icon from app-logo-pic/". Exit 0 = icon applied; exit 3 = no usable logo, falls back to `scripts/no-launcher-icon.py` (a bad picture prints a `::warning::` and a run-summary line, never silent); anything else fails the build. "Verify APK package" now also checks with `aapt dump badging` that the finished APK has a launcher icon when one was applied.
- FINGERPRINT (`scripts/app-fingerprint.py`): now also hashes the exact picture `latest.json` names (the bytes that go into the icon), not only `latest.json`. Other pictures in the folder do not change it. Same selection rule in both scripts: no `latest.json` = no logo.
- CROSS-CHECK of `android.yml` against the project (no version change): checked paths, the seven artwork folders (workflow vs `src/` vs fingerprint vs READMEs), accepted picture types per folder (splash correctly excludes GIF in both), `latest.json` keys and stamp format vs `manifestName` / `manifestStamp`, `VITE_REPO` / `VITE_BRANCH` / `VITE_CODE_ID`, `LF_VERSION_CODE` / `LF_STORE_PASSWORD`, app id, keystore name and alias, versionName = `package.json`, update manifest and release-notes format vs `src/update.js`, APK asset names vs the native downloader, FileProvider path, native Java / res files vs `install-native.sh`, permissions, and all nine Run-workflow inputs. Everything agreed except wording: the Run-workflow tick text for the notification popup and the app logo did not match what their folder READMEs tell you to tick; the workflow text now matches. Also fixed a stale sentence in `splash-pic/README.md`.
- UNCHANGED: live About logo (`src/applogo.js`, 1000 ms), the resend marker / Run workflow tick, the six live artwork folders, version number, signing guard.
- DO NOT REDO: do not put a bundled default logo back in `public/`; do not make the fingerprint depend on every file in `app-logo-pic/`.
- Tests: new `tests/apply-app-logo.test.mjs` (sizes, adaptive xml, manifest edit with a decoy comment, every picture type, blank-first-frame GIF, transparent PNG, no/invalid/traversal/corrupt logo = exit 3, broken project = exit 2); `tests/fingerprint.test.mjs` now covers stamp, bytes and selection; `tests/logo-notification-workflow.test.mjs` checks the new step order. Needs Pillow (the workflow test job already installs it).
- NOT verified: a real Gradle build, the adaptive icon on a phone, launcher icon refresh after an in-place update, and the aapt badging check against a real APK. First real run: upload a logo, check the run summary says "Launcher icon: built from ...", then install the update.


## Faster cold start + README in Ai Hoshino's voice (no version change, still 0.148.0)
- FIXED: a cover that failed to load once stayed marked "warmed" and was never tried again (so it could stay blank / not load) | WHERE: `src/main.js` `warmUrl` (a failed image is now forgotten, the next warm-up retries it).
- FASTER: the covers Home needs first (recent, most played, favourites, first songs) are decoded the moment the songs arrive | WHERE: `src/main.js` new `warmFirst()`, called in `loadLib` right after `setLibrary`, before `renderMain`. The full `warmCovers()` still runs at the end.
- FASTER: `warmChunks` decodes 8 covers per core per tick (was 3) with a 2 ms pause (was 8 ms). RAM / CPU use is not a concern (owner's order: treat it like a high-end game).
- FASTER: a picture still missing 2.5 s and 6 s after start is retried at once (before: first retry after 15 s). The 15 s watch (40 ticks) is unchanged.
- CHANGED: the Albums + Artists home screen widgets always show the ORIGINAL covers (owner's order) | WHERE: `src/main.js` `pushWidgetCovers` now sends empty custom lists (clears any earlier custom entries). The Now Playing widget still follows the notification cover (song / album picture); NOT changed (needs a Java change).
- CHANGED: `README.md` rewritten completely in Ai Hoshino's voice (same facts, links, screenshots, tables and commands; new short intro about her). Version label stays 148.
- UNCHANGED ON PURPOSE (owner's order): the full-screen cover viewer and all Listening Stats screens keep showing the ORIGINAL cover, not custom pictures.
- DO NOT REDO: keep `warmFirst()` before `renderMain()`; keep the `onerror` cleanup in `warmUrl`.
- Tests: `tests/speed-v156.test.mjs` regex updated for `warmCores() * 8`; `npm test` 421 / 421. NOT verified on a phone.

## Listening Stats opens on today; stays current; widgets follow date changes (no version change, still 0.148.0)
- FIXED: Listening Stats showed the 1st of the month instead of today (after browsing months / years, then switching to Daily; also when opened again later, and from the widgets) | WHERE: `src/listenstats.js` `shiftRef` (month / year steps used `setDate(1)`; now keeps the day, clamped to the month length), `src/lstats.js` (`S.follow`, `fresh()`, actions `ls-open` / `ls-period` / `ls-today` / `ls-prev` / `ls-next`), `src/main.js` widget launch calls `lsx.fresh()` | WHY: the screen kept one old date for the whole app session. Now opening it, switching period and "Back to today" all use the current time, and a screen showing "now" rolls over at midnight by itself.
- FIXED: stats screen showed cached numbers after more listening | WHERE: `src/lstats.js` `dirty()` sets `S.stale`, the next draw re-reads the history (old numbers stay visible until the new ones arrive, no "Loading..." flash).
- FIXED: widgets kept the old day after the phone's date, time or time zone changed | WHERE: `native-android/StatsWidgets.java` `Base.onReceive` (DATE_CHANGED / TIME_SET / TIMEZONE_CHANGED redraw like the midnight alarm), `scripts/install-native.sh` (only the Today widget listens, so one redraw). The widget maths itself (`range()`) was already correct.
- DO NOT REDO: do not set the browsing date back to the 1st in `shiftRef`; keep `S.follow`.
- Version: NOT bumped, stays 0.148.0 (owner's rule).
- Tests: new `tests/stats-date.test.mjs`; `npm test` 355 / 355; Java stub probe OK. NOT verified on a phone / GitHub Actions.

## Listening Snapshot: shareable picture for day / week / month / year / all time (no version change, still 0.148.0)
- ADDED: "Share snapshot" button on Listening Stats (under the Daily / Weekly / Monthly / Yearly / Overall chips). It builds a 1080 px wide PNG of the period on screen (browse back to any past day / week / month / year first): total listening time, plays / songs / artists / albums, TOP 5 ALBUMS (real covers), TOP 5 SONGS, TOP 5 ARTISTS, up to 4 small facts (top genre, peak hour, busiest day, days with music, best streak, longest session; only when real). A preview sheet offers Save image (system "save as" dialog) and Share (Android share sheet; browser: Web Share, else download). Works with ANY amount of data (one song heard for 10 seconds gives a full card); a period with no listening says so instead of making an empty card.
- WHERE: new `src/snapshot.js` (`buildSnapshot`, `renderSnapshot`, `makeSnapshotPng`, `snapDur`, `snapshotName`, `shareText`); `src/lstats.js` (block "Snapshot": `readSegs`, `snapshotModel`, `openSnap`, `snapShare`, `snapSave`, actions `ls-snap`, `ls-snap-share`, `ls-snap-save`, button `.lssnap`); `src/styles/app.css` (end: `.lssnap`, `.snapimg`); `src/native.js` `shareImage(data, text, name)`; `LiquidNative.java` `shareImage` (optional file name, deletes shared pictures older than a day).
- DATA: read fresh from the history database (`Native.getListens`) at the tap, through the same `aggregate()` + `meta()` as the dashboard, so the picture equals the screen. A failed read is an error message, never "no listening". Covers are the ORIGINAL covers (like every stats screen); a missing / unreadable cover is drawn as a colour gradient; a canvas the browser will not export is redrawn without covers.
- NOT A RECAP: the old swipeable yearly recap stays removed (`tests/yearly.test.mjs` still enforces it). This is one plain picture per period.
- DO NOT REDO: do not read the screen's cached `S.data` for the picture (stale); keep names passed through `unesc` (the app stores them HTML-escaped).
- Tests: new `tests/snapshot.test.mjs` (13); `npm test` 350 / 350. Rendered in headless Chromium with real cover images, a 10 s single-song listen, long / emoji names, no-cover fallback (picture size about 1.4 MB, 1080 x 1968-2290).
- NOT verified on a phone: the Android share sheet / save dialog and real cover files (the Java change was only compile-checked with the stub probe). The picture is tall (up to about 1:2.1) by design so nothing is cut.

## Run like a game: pictures show at once, nothing blank on reopen (no version change, still 0.148.0)
- FIXED: a picked picture / GIF waited for the whole file to be written to the phone before it appeared | WHERE: `src/main.js` `alpPick`, `gpPick`, `apicPick` (GIF), `bgPick`, `pfPick` (GIF / video), `ppAddFiles`, new `ownBlob` | WHY: the picture was only shown after both copies were saved.
  Now the file is copied into memory, shown at once, and saved in the background; if the save fails the change is undone with a message.
- FIXED: blank pictures after closing and reopening | WHERE: `src/main.js` `warmUrl` / `warmChunks` / `warmCovers` / `rewarmAll`, `MainActivity.onResume` | WHY: Android lets the web view drop decoded pictures while the app is away. Custom pictures are decoded at once, every album cover is decoded in the background (batches sized by the number of CPU cores), and everything is decoded again whenever the app comes back to the front. The web view is also told to resume and redraw.
- FASTER: `LiquidNative.java`: `getLibrary`, `putPic`, `listPics` now run on their own threads (Capacitor runs plugin calls one after another on ONE thread, so a slow call held up every picture call at start). `src/picmirror.js`: pictures are sent in 1.5 MB pieces (was 768 KB), base64 made by `FileReader` (browser, off the main thread).
- ADDED: `MainActivity`: sustained performance mode when the phone supports it (steady high clocks instead of short bursts).
- DO NOT REDO: keep `ownBlob` before showing a picked file (a picked File can go dead after the app is swiped away); keep the save-failure undo in each picker.
- Tests: new `tests/speed-v156.test.mjs`; `tests/picmirror-v150.test.mjs` and `tests/onepic.test.mjs` updated; `npm test` 337 / 337 pass. NOT verified on a phone; the Java was not compiled here (no Android SDK), build it with GitHub Actions.

## Yearly recap removed (no version change, still 0.148.0)
- REMOVED: the whole yearly recap (the red "Open your yearly recap" button, the swipeable cards, share-as-image, `.lsrecap` / `.wrapped` / `.wcard` styles) | WHERE: `src/lstats.js` (`buildCards`, `openRecap`, `closeRecap`, `drawCard`, `shareAll`, actions `ls-recap*` / `ls-share-*`), `src/main.js` (Back-button `closeRecap`, wobble list), `src/styles/app.css`.
- KEPT: Listening Stats > Yearly still shows all the data for the year (hours, songs, artists, albums, sessions, month by month, weekday / hour, top 100 songs, top 20 artists / albums, genres, day / night, discoveries).
- DO NOT REDO: do not bring the recap back; `tests/yearly.test.mjs` fails if it returns. `tests/recap.test.mjs` was replaced by it.
- Tests: `npm test` 332 / 332 pass. NOT verified on a phone.

## Instant library on start + "maximum" wording (no version change, still 0.148.0)
- FIXED: Home waited ~2 s for the saved library | WHERE: `LiquidNative.java` (`load()`, `warmLibrary`, `getLibrary`, `readLibraryNow`), `src/main.js` `loadLib` | WHY: the library JSON was read + parsed only when the page asked, and Home waited for favourites / stats / playlists too.
  Now the plugin parses the saved library on a background thread as soon as it loads (in parallel with the page), keeps it in memory until `library-v9.json` changes, and `loadLib` draws Home the moment the songs arrive (favourites / stats / playlists update it right after).
- CHANGED: Settings > Performance no longer says "used for scanning" or "the app can use up to N MB"; CPU cores and Memory both say "maximum used for all activities". Scan workers: heap guard 32 MB -> 16 MB per worker (still 4 per core).
- DO NOT REDO: the stamp check in `getLibrary` (size + modified time) is what keeps the in-memory copy from going stale after a scan.
- Tests: `tests/scan-threads.test.mjs` updated; `npm test` 332 / 332 pass. NOT verified on a phone (needs a build).

## v148 custom sleep timer time (no version change, still 0.148.0)
- FIXED / ADDED: sleep timer custom time. DO NOT REDO: the Android side needed no change.
- Sleep timer sheet: a new "Custom" row. Type minutes (`90`) or hours:minutes (`1:30`, also `1h30`, `2h`, `1.5h`), tap Start; 1 minute to 24 hours. The last custom value is remembered in the box (`set.sleepCustom`). The 5 / 10 / 15 / 30 / 45 / 60 buttons and "End of this song" are unchanged.
- `src/sleep.js`: `cleanMinutes` now accepts any whole number 1..1440 (the Android service already accepted that range: `SleepTimer.minutesToMs`, so no Java change); new `parseSleepInput`, `fmtMinutes`; the toast shows e.g. "Sleep timer: 1 h 30 min" above 60 minutes. Tests updated in `tests/sleep.test.mjs`. NOT verified on a phone.

## v148 widgets, free lyrics size and lyrics right-edge fix (no version change, still 0.148.0)
- New `native-android/NowPlayingWidget.java` (4 x 2): cover, song, artist, album, prev / play-pause / next. `LiquidWidget.push()` now also saves the album and the cover path (`wAlbum`, `wCover`) and redraws it; the buttons send the same `LiquidWidget` broadcasts, so `PlaybackService.widgetCmd` is still the only code that drives the player. The cover (max ~600 px) is shrunk to ~300 px and decoded once per song.
- `PlaybackService.widgetPush()` is the only change in the service: it passes `albumTitle` and the file path of `artworkUri`. The earphone / Bluetooth button code is untouched.
- New Genres widget (`LiquidTiles.Genres`, 4 x 2): `LiquidTiles.save()` also stores the 12 biggest genres (`wGen`; a tag like "Rock; Pop" or "Rock / Pop" counts for both, case-insensitive). 6 chips; chip tap = `lfTab` `genre:<name>`, title tap = `genres`. Every chip has its own PendingIntent request code (41..46), because PendingIntents that differ only in extras are the same one.
- `src/main.js` `doLaunch`: `genres` opens Library > Genres, `genre:<name>` opens that genre (matched case-insensitively; waits up to 10 s for the library like Shuffle does).
- New `StatsWidgets.Daily` (kind 4, 4 x 3): today vs yesterday, songs / unique songs / artists, 24-hour bar chart, top artist and song, day / night. Same maths as the other stats widgets (`compute()`), same refresh paths (playback, Clear data, ~30 min, midnight alarm).
- Settings > Widgets: three new "Add ... widget" rows. `LiquidNative.addWidget`: kind `nowplaying` maps to the new class. `scripts/install-native.sh`: three new manifest rows.
- FIXED (major bug): lyrics cut off on the right. DO NOT REDO: see the rule at the end of `app.css`.
- **Lyrics cut off on the right (fix):** `.ln.tap` is a synced lyric line; the playing one is scaled up (`--ly-zoom`, up to 125%) from its LEFT edge, so a line that already filled the width ran off the right side. End of `src/styles/app.css`: every synced line is now `calc(100% / max(--ly-zoom, --ly-small, 1))` wide (fallback 80%), `box-sizing: border-box`, `overflow-wrap: anywhere` (a very long word may break instead of leaving the screen). The same width for every line also stops the playing line from re-wrapping when it becomes current.
- **Free lyrics size:** new `src/lysize.js` (pure; 14 to 48 px, default Medium = 23). New setting `lyricPx`; Settings > Lyrics now opens a "Lyrics size" screen with a slider, a live sample and "Reset to Medium". `DEF.lyricSize` is now `Medium` (was `Large`) for new installs; an older saved Small / Medium / Large keeps its size (20 / 23 / 26 px) because `lyricPx` is derived from it when missing. The settings backup carries `lyricPx` automatically.
- New `tests/lysize.test.mjs`. NOT verified on a phone: the real check is a long line (e.g. "On my superman shit, X-ray vision while you shaking those tits") as the playing line at Large sizes.

- New `tests/widgets-v148.test.mjs` (resource ids, manifest rows, kind = index, Settings buttons reach a class, Genres tap handling). The four Java files compile against hand-made Android stubs (no Android SDK here). `npm test` all green. NOT verified on a phone.

## v148 black under floating glass, no blur (no version change, still 0.148.0)
- Screenshots showed the Up Next sheet, mini player and tab bar letting the page behind (Now Playing title, progress bar, "Export playlists" rows) run through them. An earlier see-through pass (v84) had overridden the black fills.
- Fix is CSS only (end of `src/styles/app.css`): tab bar, mini player, every sheet (incl. Up Next), the toast and the Bluetooth banner now have a solid black layer directly under the clear glass tint and rim, and the sheet scrim is fully black. No blur was added anywhere; `backdrop-filter` is off on those parts. The notification / credit popup (no box) is untouched.
- NOT verified on a phone.
- In-app update check fix (Settings > About > Check for updates showed "Could not check for updates" on a phone running the newest build, so a new logo / code was never offered): the manifest request sent a custom `Cache-Control` header, which makes the app's web view send a CORS preflight that raw.githubusercontent.com can refuse; the request failed every time (the logo and popup pictures send no custom header, so they kept working). `src/update.js` now sends no custom header (`?v=` and `cache: no-store` already defeat caches), and a failed or blocked manifest request now falls back to the GitHub release notes check instead of giving up. If both fail, the last known answer is kept. New test in `tests/update.test.mjs`; `npm test` 301/301. `src/` is a fingerprint input, so this builds a new APK. NOT verified on a phone or against GitHub.

- Glass settings check (Settings > Animation): the tab-bar pill, button squash, toggle knob and the Up Next / Play-Shuffle style rows already followed the sliders, but every wobble drawn by CSS (the tap wobble on buttons, rows, cards, the mini player, toggles and sheet rows, plus its light glint) used fixed numbers and ignored Button squash and jiggle, Bounciness and Spring speed. The keyframes now read `--lq-amp` (squash x bounciness, capped) and `--lq-dur` (0.65 s / speed), set in `applySettings`, so the sliders and presets (Calm / Watery / Max) change them live. 0 % squash = no wobble.
- Glass that did not wobble on tap at all now does, with the same settings: stats day cells, Top songs / artists / albums, Yearly recap, the stats Home card and its empty state, Continue-listening card, profile picture button. The stats Home card and the stats banner also get the finger-squash (jelly) like other cards.
- Not changed on purpose: Magnification and Glass edge colour fringe only exist on the tab-bar / pill lens; Lens refraction off still turns that off.
- New `tests/glass-settings.test.mjs`. NOT verified on a phone.

- Spotify-format listening export: the artist field now holds the track artist (it held the album artist, so a compilation track's artist became "Various Artists" after re-import). `src/listenio.js` line 42, new test in `tests/listenio.test.mjs`.
- Import / export check (round trip of playlists in JSON, M3U8, XSPF and CSV, listening history in all four formats, settings, plus Exportify / Spotify / PLS / Last.fm samples): all matched. One bug found and fixed: two playlists with the same name were merged into one when exported as CSV and imported again (`src/plforeign.js` `toCsv` now names repeats "Name (2)"). New test in `tests/plforeign.test.mjs`. `src/` is a fingerprint input, so this builds a new APK.
- `tests/java-probe-plays.py`: its test stubs lacked a few `org.json` / `PluginCall` methods, so the probe failed to compile. Stubs added; the probe passes. Test file only: not a fingerprint input.
- Removed `docs/report-screenshots/` (4 reference screenshots) and the two doc lines that pointed to it. Docs only: not a fingerprint input, so this adds no APK build on its own.
## v148 cross-check fixes (no version change, still 0.148.0)
- Text-only fixes after a second yml <-> zip cross-check (all scripts, folders, secrets, FileProvider path, release-note format, package name, versions and 293 tests agree). The only fingerprint input that changed is `scripts/app-fingerprint.py` (the nonexistent `public/` folder was removed from its input list), so this zip **builds one new APK** and phones are offered it once as a normal update.
- `docs/HANDOFF.md`: removed statements that contradicted the current `android.yml` (tests not blocking the APK, Node 20 for the APK, a `pull_request` trigger, "no secrets still builds", old key file name). Marked as updated in v148.
- Setup guide: the "Blink fixes" note said the version label was still 0.146.0; it is 0.148.0.
- Removed the stray `scripts/__pycache__/*.pyc` files from the zip (they were git-ignored anyway).
- `scripts/app-fingerprint.py`: removed `public` from `INPUTS` (the project has no `public/` folder; no logo or other file is bundled since v144). `tests/fingerprint.test.mjs` no longer creates a sample `public/` file.
- `android.yml`: comments only (header line, and the plan-job comment no longer lists `public`). No workflow logic changed.
- Reminder: the `README.md` inside each artwork folder is kept from the first upload (the zip's copy of a managed folder is dropped on purpose, so uploaded pictures are never lost). Edit those READMEs directly on GitHub.

## v148 signing-secret guard (no version change, still 0.148.0)
- `.gitignore` now also blocks `KEYSTORE_BASE64.txt`, `KEYSTORE_PASSWORD.txt`, `KEYSTORE*.txt`, `key.txt` and `*.p12` (before: only `*.keystore` / `*.jks`).
- `.gitignore` cannot stop a file uploaded through the GitHub web page, so `android.yml` has a new first step in the unpack job, "Refuse committed signing secrets". It fails the run when such a file is tracked in the repo or is inside an uploaded zip. **Paste the new `android.yml` by hand** (a zip never replaces `.github/`). No app-fingerprint input changed, so no new APK is built.
- New `tests/key-guard.test.mjs`; `npm test` 293/293. Also corrected doc wording: the setup guide's "no APK" lists now name all six live folders, section numbers in the pictures guide, and the stale test counts.

## v148 bug-check fixes (version 0.148.0)
- Widgets: "Top artist" now uses the same artist rules as the app where the library is not needed (`A; B`, `A feat. B`, `A (feat. B)`, `feat.` names in the song title, then the album artist). Splitting `A, B` / `A & B` needs the library, so those tags stay one name in a widget. `StatsWidgets.artistsOf`.
- Widgets: resizing a widget no longer reads the database on the main thread (`onAppWidgetOptionsChanged` uses `goAsync()` + a thread, like `onUpdate`).
- Widgets: one not-exact, non-wake-up alarm just after local midnight redraws all stats widgets, so "Today / This week / This month" roll over on time (before: only Android's ~30 minute timer). Scheduled from `onUpdate`, `onEnabled` and the alarm itself; it stops re-arming when no stats widget is left. `ACTION_MIDNIGHT`, request code 31.
- Backup restore: the Liquid backup now carries `tz` (the zone each listen happened in; `ListenDb.query` returns it), and `planLiquid` keeps it. Old backups without `tz` use this phone's zone, as before.
- `lstats.js`: a failed history read is not retried in a tight render loop (5 s back-off per period; a forced reload still goes through).
- Import toast says "listening records" (it counts stored stretches, not plays). `parseTime`: removed a no-op expression. Repeat-one: the last stretch of a repeated song now ends at the song's end position, not about 0 (`ListenTracker`, `MEDIA_ITEM_TRANSITION_REASON_REPEAT`).
- New test in `tests/listenio.test.mjs`; `npm test` 290/290 (293 with the key-guard tests). `android.yml`, the Bluetooth / earphone button code and everything else are unchanged. `src/` and `native-android/` are fingerprint inputs, so this builds a new APK.
- NOT verified: a real phone, GitHub Actions, a full Android compile (the Java parses with the JDK compiler; only the missing Android libraries are reported), `vite build`.

## v146 update-gate tidy-up (no version change, still 0.146.0)
- `src/main.js` `updGateRestore`: when the saved update lock is junk (no build number) or its update is already installed, the saved record is now deleted from the persistent store too (before, only the old localStorage copy was removed). It could not re-lock anyone before (it was re-judged and released on every start); this just stops the stale record from lingering. A build with no code id still leaves the record alone.
- New `tests/update-gate-cleanup.test.mjs`. `src/` is part of the app fingerprint, so this is a new APK and phones are offered it once as a normal update.

## v146 bug-list fixes (no version change, still 0.146.0)
- Code and `scripts/` changed, so the app fingerprint changes and this builds a new APK.
- `checkLatestAppLogo({ force: true })` (app resume) now works: it ignores `document.hidden`, clears the retry gate, and if a check is already running it runs once more right after instead of being dropped.
- Workflow: the `test` comment said a red test never blocks the APK, but `apk` needs `test` (and the setup guide says a red test stops the release). The behaviour is kept and the comment now says so. Stale `MOVED` comment corrected. Splash block variables renamed `SP...` / `PYSPLASH` (they were credit-style names).
- Missing keystore: `install-native.sh` and `signing/README.md` no longer claim CI can build with the debug key; the workflow stops with an error.
- Removed unused imports (`startOfDay`, `MAX_PICS`, `parseImport`/`planImport`/`summary` in main.js, `KIND`) and dead code (`days` and `tx` in lstats.js, `ppGallery`, `sheetOpen`).
- JSDoc `@returns` types in `listenio.js`, `plexport.js`, `plforeign.js` are valid now.
- Deleted what the cleanup left unused: `scripts/make-icons.py`, `lf_icon_bg.xml`, `lf_splash_vec.xml`, and the playlist picture-strip CSS in `app.css` (`.pp-sec`, `.pp-head`, `.pp-add`, `.pp-strip`, `.pp-th`, `.pp-tb`, `.pp-x`, `.pp-none`). `lf_splash_icon.xml` stays (a plain black shape, still used by the splash theme). `install-native.sh` comments say "splash + widget" instead of "app icon".
- Added the missing final newline to `lf_w_recent.xml` and `lf_w_playlist.xml`.

## v146 cross-check fixes (no version change, still 0.146.0)
- Docs only, nothing in the app fingerprint changed, so this does not build a new APK.
- README: three screenshot links pointed at file names that do not exist (`38-update-popup-gif-pic-picture`, `47-stats-banner-gif-picture`, `49-background-allow-gif-picture`); they now use the real files (`38-update-popup-picture`, `47-stats-banner-picture`, `49-background-allow-picture`). `tests/screenshots.py` and `tests/screenshots_v146.py` write the same names.
- README and the workflow header said only `notification-popup-gif-pic/` and `app-logo-pic/` accept a `resend*` file. The workflow accepts it in all seven picture folders (plus the seven Run workflow checkboxes); both now say so.
- README "Artwork folders stay separate" now lists all six live folders (added `background-allow-gif-pic/` and `stats-banner-gif-pic/`).
- `signing/README.md`: the step is called **Show and verify signing certificate**.
- Left alone on purpose (they live in `scripts/`, which is part of the app fingerprint, so editing them would force a new APK): the old "app icon" comment in `scripts/install-native.sh` and the unused `lf_icon_fg.xml` output of `scripts/make-icons.py`.

## v146 screenshots and cleanup (version 0.146.0)
- Screenshots regenerated from this build: 01 to 49 (43 Credits added to `tests/screenshots.py`, 46 to 49 from `tests/screenshots_v146.py`). The old 50 with the anime portrait is removed.
- Removed the unused anime portrait `native-android/res/drawable-nodpi/lf_splash_art.png` (nothing referenced it). Because the native folder is part of the app fingerprint, this build is a new APK.
- Removed the anime store icon `docs/playstore_icon_512.png` (nothing referenced it).
- README: Listening Stats and the four widgets, the live picture folders, and the Home picture box and background popup in the gallery. Corrected the screenshot counts, the launcher icon (none since v144), and the app logo (live, not bundled).
- `npm run screenshots` runs both screenshot scripts.

## v146 smoke-test fixes (no version change, still 0.146.0)
- Album sort labels in `tests/smoke.py` now match the app: default "Name - ascending", year sort "Year - descending" (`year_desc`); the restart check expects "Sort: Year - descending". App sorting code untouched.
- Flaky upward drag: root cause was the test helper, not the app. The restored mini player / tab bar floats over the lower playlist rows, so a press on row 4's handle hit the mini player and no drag started. `drag()` now scrolls the handle clear of the floating bars and waits until a hit test returns the handle (`reveal()`), and waits for `.dragging` / `.dropat` to clear after release. No sleeps added.
- Artwork audit (popup, update popup, splash, app logo, credits, background-allow, stats banner): every folder's `latest.json` is polled every 1000 ms (`?v=Date.now()`, `cache: no-store`), each poll has a busy guard, pictures download only when the stamp changes. Measured in Chromium with a faked GitHub: 1.0 poll/s per folder, change shows in 0.4-1.0 s, 0 re-renders while idle (banner, credit, logo, popup, background-allow). Update popup only polls while an update is pending (by design); background-allow only runs in the native app and waits 10 s after launch/resume.
- Fix: the Credits picture is now decoded before the swap and the old blob is revoked 1.5 s later (it was revoked at once, which could flash an empty frame). New probes: `tests/artwork-live-probe.py`, `tests/artwork-live-probe2.py`.
- yml <-> zip cross-check: all scripts, folders, secrets, FileProvider path and Node versions agree. Fixed text-only gaps: android.yml header said four live folders and three jobs (now six folders, plan job listed, zip's own .github/ is ignored on upload); update-popup-gif-pic/README.md now documents the resend marker.
- Workflow: apk job Node 20 -> 22 (same as the test job); README line updated.
- Java probes `java-probe`, `java-probe-update`, `java-probe-earphones` had stale stubs (Base64, Cursor, PowerManager, ListenDb, StatsWidgets, ListenTracker ...); stubs added, all 6 probes OK. `monkey.py` N=250: 0 errors. App and Java sources untouched.
- Verified: 32 drags (8 up, 8 down, 8 down then up, 8 up then down) all gave the expected order; full smoke OK; `npm test` 285/285. Not verified: real phone, GitHub Actions, Java compile, `vite build`.

## v146 folder names (version 0.146.0)
- Upload folders renamed so each name says what it holds: `popup/` is now `notification-popup-gif-pic/` (the notification popup), `update-popup/` is now `update-popup-gif-pic/`, `background-allow-pic/` is now `background-allow-gif-pic/`, and `stats-banner-pic/` is now `stats-banner-gif-pic/`. `app-logo/` is now `app-logo-pic/`, and `splash-pic/` and `credit-gif-pic/` are unchanged.
- The workflow unpack step protects the new names. The old names are not protected: pictures left in the old folders are removed by the next zip upload, so move them first.
- Installed apps from v146 keep reading the old folders until they update. Pictures uploaded to the new folders show on the new build.

## v146 background-allow popup + Home stats banner (version 0.146.0)
- **`background-allow-pic/`** (live, 1000 ms, no rebuild): full-screen popup with your picture/GIF. Allow opens Android Battery usage > Allow background activity (fallbacks: ignore-battery-optimizations dialog, optimization list, app info). Shows once per upload on every phone; plain once on first launch. Waits 10 s after the app is on screen, for the All-files-access screen, the update screen and the splash, and for the picture to be downloaded and decoded.
- **`stats-banner-pic/`** (live, 1000 ms, no rebuild): liquid-glass box above Listening Stats on Home; empty (full width) when no picture; with a picture the box takes the picture's own size inside a 6 px liquid-glass frame (no shine line over the picture) (picture max 360 px high, never wider than the screen); swapped in place (no blink).
- Workflow: two new folders, two new resend checkboxes. Listening: closing a segment on a track change no longer records the next track's position.
- Version 0.146.0 is now in `package.json` and `package-lock.json` too; README, HANDOFF notes and screenshots 01 to 49 were retaken for v146. Both new folders are polled every 1000 ms (`BGALLOW_POLL_MS`, `BANNER_POLL_MS`, now also checked in `tests/polling-intervals.test.mjs`).
- Tests: `tests/bgallowpic.test.mjs`, `tests/statbanpic.test.mjs`.

## v144 stats fix 3 (album GIFs, one simple picture sheet, background-play check)
- **Albums can have a picture or GIF now** (album screen > "Album picture or GIF"). One per album, kept exactly as chosen. Shown in the library, Home and Now Playing; listening stats and the recap still use the original covers.
- **One simple sheet for every custom picture** (artist, album, playlist): "Choose a picture or GIF" (replaces the old one, the old file is deleted) and "Back to default" (what it originally shows). The extra "Use an album cover" choice and the playlist picture gallery are gone. The Home background says "Back to default" too. Playlists that still held several old pictures are cut down to the first one when the app starts, and the rest are deleted.
- **Background / swiped-away listening:** time and plays are recorded by the playback service, so they keep counting with the app closed. Fixed a start-up race: a play counted while the app was still loading could overwrite the saved play counts; plays are now merged only after the saved counts are read, and a failed save is retried.
- Tests: `tests/onepic.test.mjs`.

## v144 stats fix 2 (covers + one picture at a time)
- **Listening stats and the yearly recap show the original art only:** the song's / album's cover from your music files. The custom artist photos and GIFs (made for browsing and Home) are no longer used there (artist rows, top cards, artist detail, recap Artist of the Year). New tests (`tests/recap.test.mjs`) also check that the recap cards are built from the stored listening segments (totals, top artist / song / album, solar / lunar).
- **One picture at a time, nothing old kept:** a playlist now has ONE picture or GIF; choosing a new one replaces the old one and deletes the old file (if the new one cannot be saved the old one stays). Setting an artist photo or album cover now deletes the artist's old GIF from storage. The background picture was already single.

## v144 stats fix (listening + plays + solar / lunar)
- **Solar / lunar is not a separate store.** It is calculated from the same listening rows as every other number (06:00-17:59 = solar, 18:00-05:59 = lunar), in the app and in the widgets, so it can never disagree with the totals. New test checks the 17:50-18:10, midnight and 05:55-06:05 cases.
- **Plays are counted by the playback service** (`ListenTracker`), at the exact moment a play reaches 30 s (or half a short song), and saved with `commit()`. Before, "Most / Recently played" was counted by the page and the plugin, which stop when the app is swiped away or the WebView sleeps, and the two could count one play twice. Now one counter, nothing missed, nothing doubled. The page gets an `onPlayCounted` event and also takes anything waiting when it opens or returns.
- **No more lag in listening time:** saves every 5 s (was 10), first save 1.5 s after play starts, the stats screen refreshes every 5 s (was 15) and once more when you pause, widgets refresh every 60 s during playback.
- **Nothing lost to a busy database:** a failed insert is retried at once and on the next beat, a failed update is retried. A failed read on the stats screen is retried before it can show "No listening".
- **Widgets:** a redraw requested inside the 4 s window is delayed, not dropped.
- Files: `native-android/ListenTracker.java`, `ListenDb.java`, `LiquidNative.java`, `StatsWidgets.java`, `src/main.js`, `src/native.js`, `src/lstats.js`, tests `listen-pipeline.test.mjs`, `listenstats.test.mjs`, `java-probe-plays.py`.

## v144 update box: picture first (no version change, still 0.144.0)
- The update box now behaves like the notification popup: it opens only after its picture/GIF is downloaded and decoded, with the picture already inside (`updDeferFirstDraw()` in `src/main.js`). The update is mandatory, so the wait is capped at 20 s; then the plain box opens and a late picture is swapped in. The old separate 20 s wait before opening was removed so the two waits never add up.
- New checks: `tests/update-first-draw.test.mjs` (source guard) and `tests/update-first-draw-probe.py` (browser probe: with a 3 s picture the box appears at about 3.6 s already holding the picture; with a 25 s picture the plain box opens at about 20 s).

## v144 update-install fix (no version change, still 0.144.0)
- In-app Install no longer fails: `scripts/install-native.sh` now writes `res/xml/file_paths.xml` with `files-path update/` (Capacitor's own FileProvider already exists, so the old extra `lf_file_paths.xml` was never used and `FileProvider.getUriForFile` threw for `files/update/`).
- The unverified legacy `installUpdate()` (LiquidNative.java and src/native.js) was removed; only the checksum-verified UpdateDownloadService/UpdateInstallActivity path installs APKs.
- Workflow: the apk job now needs the test job, and a new step "Verify the update installer file path (FileProvider)" fails the build if the path or provider is missing. New test: `tests/update-fileprovider.test.mjs`.

## v144 follow-up fixes (no version change, still 0.144.0)
- Favorites, play history and playlists now follow the same songs when Android returns different URIs after the music folder is picked again (matched by folder-relative path).
- Small phones: the scan no longer forces 8 worker threads when the app's memory limit allows fewer.
- Plays are now also counted inside the Android plugin, so music that plays with the screen off is still counted once the app is opened again.
- Documentation and test probes brought up to date.

## v144 blink fixes, round 2 (no version change, still 0.144.0)
- Update box: ONE writer for its text. Progress events and the 1 s poll only set `updPct` and call `updSheet()`; the old second writer (`updUpdateProgressText` writing its own wording into the `<p>`) is now a thin wrapper. The "Allow the install" and "Update ready" cards are never overwritten. "Opening the installer..." is part of the same shared text (`updOpening`). `updCard()` compares against what it last drew, not the re-serialised innerHTML, so unchanged parts are not touched.
- Notification popup: a picture that arrives late (retry timers) is swapped into the open card (`data-pic`), the box is not rebuilt. A retry that finds no picture never removes one.
- Popup / update pictures: the fitted shape is remembered per picture (`popFitMemo`), so a rebuilt card shows the picture at once; a changed update picture is swapped inside the same card.
- Settings > About: `renderSub` moves the existing Credits picture and logo nodes into the rebuilt screen, so the GIF is not re-decoded or restarted; the logo is rendered with its src already set.
- All 1000 ms checks are unchanged.

## v144 - reliable artwork and signing safety (version 0.144.0)
- Blink fix: the notification popup no longer rebuilds once a second while the same picture is on screen (it is identified by picture id, not blob URL). Version label stays 0.144.0.
- No logo is bundled. The APK has no launcher icon (Android shows its generic icon) and the Settings > About logo comes live from `app-logo/` (checked every second; hidden when the folder is empty). `app-logo/latest.json` is still part of the app fingerprint, so a new logo upload also builds a new APK and offers the update.
- Logo selection: the unpack job picks the newest image in `app-logo/` by Git commit order and writes `latest.json`. Manifest edits (removing the launcher icon) are scoped to the `<application>` tag.
- Splash remains independent: `splash-pic/` is the live opening-screen artwork and keeps its 1000 ms manifest check. It is not used as the app logo.
- Splash, Credits and update-popup asset failures now use per-stamp exponential backoff, avoiding full-file downloads every second. Manifest polling remains one second.
- The old base64 logo cache is cleared on update, and the mandatory-update gate is moved to the native atomic JSON-file store (with one-time migration from `lf.updGate`), avoiding competition for localStorage quota.
- Notification popups defer during mandatory updates and are marked seen only after the actual sheet image has decoded and survived a two-frame paint check.
- The signing-key guard now runs on every branch and fails closed if the current published APK cannot be fetched or its signing certificate cannot be verified. A new/different key requires the explicit `allow_new_signing_key` workflow input. Unknown installed Android build numbers are not treated as proof that a remote build is newer.
- Tests cover logo selection/EXIF/GIF/error preservation/manifest scoping, app-logo and splash separation, image retry backoff, unknown build handling and the 1000 ms live-poll cadence.

## v142 - background updater hardening (version 0.142.0)
- Downloads now run in an Android foreground `dataSync` service with a persistent progress notification, so they continue when Liquid Dark is swiped away or its WebView is closed. When verification succeeds, the notification includes an **Install** action that opens Android's package installer directly; the in-app update screen still offers Install too.
- Each download writes to a filename derived from its exact Android build number and SHA-256. A newer build cancels the older request; it cannot truncate or rename the older build's temporary file. A cancelled/older worker cannot overwrite the newer build's status.
- Download state and verified build metadata survive app-process restarts. The APK is stored under app-private `filesDir/update/`, not the evictable cache directory, and its SHA-256/package/build are verified again immediately before installation.
- HTTP/missing-asset, checksum, package, and build-number failures are saved and shown in the update screen (and a download-failed notification). The user can retry explicitly; a failed file is never left marked ready. A missing/corrupt file discovered during Install automatically starts a clean download.
- `UPDATE_POLL_MS` remains exactly 1000 ms. This controls the in-app update manifest check; the native foreground service handles downloading independently of JavaScript timers.

## v140 - fingerprinted updates, no repeat-install loop (version 0.140.0)
- Update identity is a deterministic source fingerprint from `scripts/app-fingerprint.py`. App code and the selected launcher-logo manifest are fingerprinted independently from the display version, so a code change or new launcher logo still triggers an update even when `package.json` stays at 0.140.0.
- Every published APK receives a rising Android `versionCode`. `update/latest.json` is the single publication source of truth and points to a build-specific APK asset plus SHA-256. The native downloader verifies checksum, package id and exact `versionCode` before enabling Install.
- When the app starts or resumes, the mandatory-update gate checks the installed fingerprint and Android build number before rebuilding the update screen. Once either confirms the target APK is installed, it clears the saved gate instead of looping.
- `popup/`, `update-popup/`, `splash-pic/` and `credit-gif-pic/` remain live artwork only, outside the APK fingerprint. Fixed the workflow's missing `credit-gif-pic/latest.json` publisher. `app-logo/latest.json` remains included because it selects the packaged launcher icon.
- The workflow compares the source fingerprint with `update/latest.json` (not release notes), serializes APK publishing, publishes immutable per-build APK assets with checksums, and verifies APK metadata before release. A stable `liquid-flac.apk` alias remains for manual downloads and legacy fallback.
- Supported repository artwork formats: GIF, PNG, JPG/JPEG, WebP and BMP. Foreground polling is 1000 ms (one second); Android may throttle JavaScript timers while the app is backgrounded.
- Automated tests cover fingerprint inclusion/exclusion, update gating, Credits manifest handling and 1-second polling. See `HANDOFF_STATUS.md` for validation limits.

## v138 - the update is mandatory (version 0.138.0)
- Removed **Later** from the update screens ("Update available", "Update ready", "Allow the install, once"). The update screen cannot be closed (Back, Escape, taps outside do nothing), nothing else can replace it, it opens as soon as a newer build is found (progress first, Install when downloaded) and it comes back every time the app is opened until the new version is installed. The waiting update is remembered on the phone (`lf.updGate`), so opening the app offline does not skip it; it is released only when GitHub itself says this app is up to date, or when the installed build is the one remembered. The check every 1000 ms, the update picture / GIF (`update-popup/`) and the workflow are unchanged. Version 138 / 0.138.0 (v137 was skipped).

## v136 - labels say "photo or GIF" (version 0.136.0)
- Artist screen button: "Artist photo or GIF"; the sheet row: "Choose a photo or GIF"; the Settings hint mentions GIFs. Version 136 / 0.136.0. Two new screenshots (44, 45) in `docs/screenshots/` and the README show it. Nothing else changed.

## v135 - GIFs as artist photos (version 0.135.0)
- The artist photo picker now accepts GIFs. A GIF is stored untouched in its own IndexedDB (`lf-artistgifs`), any size, and keeps moving. Pictures work as before. Nothing else changed.
- Version 135 / 0.135.0 in `package.json`, `package-lock.json`, README, Settings > About and the APK `versionName`.

## v134 - version 134 everywhere + screenshots retaken (version 0.134.0)
- Version 134 / 0.134.0 in `package.json`, `package-lock.json`, README, Settings > About (read from `package.json`) and the APK `versionName`. All 38 screenshots in `docs/screenshots/` retaken from this build. No app behaviour change.
- Signing key alias is now `liquid dark` (`scripts/install-native.sh` `keyAlias`, `signing/README.md`). The workflow (`android.yml`) checks that the key store has this alias and the password `KEYSTORE_PASSWORD`; a key store made with the old alias `liquidflac` no longer builds.
- Setup guides (`Liquid_Dark_full_setup_guide.html`, `Liquid_Dark_gifs_pics.html`) say version 134.

## v133 - update popup picture checked every second (version 0.133.0)
- **`update-popup/` is now polled every 1000 ms** (`UPD_PIC_MIN_MS` was 60000). The app looks at `update-popup/latest.json` every second from the moment a new build is detected (while the APK downloads) until the update popup closes. The picture itself is downloaded only when its stamp changes.
- **The popup opens WITH the picture.** The app waits up to 20 s for the picture (it normally downloaded while the APK did) before showing "Update ready", so it no longer appears plain and changes a moment later. A picture uploaded while the popup is open replaces the old one at once; a picture deleted from the folder turns the popup back into the plain one (manifest 404).
- Workflow (`android.yml`): header notes for v133 and a warning in the run log when the update picture is larger than 25 MB (any size still works). No other change; a picture upload still rebuilds nothing.
- Tests: `updpic.test.mjs` (+2), `polling-intervals.test.mjs` (+1 assert). Version 133 / 0.133.0 in `package.json`, `package-lock.json`, README.

## v132 - pictures and GIFs in playlists, send the SAME picture again (version 0.132.0)
- **Playlists can hold pictures and GIFs of any size.** Open a playlist > **Add** (or ⋯ > Add Pictures / GIFs) and choose one or many. They are kept exactly as they are (no shrinking, no re-encoding, GIFs keep moving) in the phone's IndexedDB, so there is no 5 MB limit. Tap a picture to open it fitted to the screen with name, size and position; ‹ › move between them, ★ makes it the playlist cover, ✕ removes it.
- The first picture is the playlist cover: it replaces the 2x2 mosaic on the playlist page, in Library > Playlists and in the Home Playlists row. Tapping the cover opens the viewer. Edit mode (⋯ > Edit Songs and Pictures) puts a ✕ on every picture. Deleting a playlist deletes its pictures.
- The playlist file only stores a small description of each picture (`pics`: id, name, type, size). Playlists without pictures are saved exactly as before, so older files and exports still work. Export / import playlists does not carry the pictures (songs and names only).
- New `src/plpics.js` (helpers + storage backend) and `tests/plpics.test.mjs` (8 tests). `tests/screenshots.py` makes a GIF, a 4096 x 3072 PNG and a tall JPEG and checks that the big one keeps its full size.
- Version 132 everywhere: `package.json`, `package-lock.json` (0.132.0), Settings > About ("Version 132 (0.132.0)"), README, docs, the workflow header and the APK `versionName` (taken from `package.json`). Screenshots 01 to 37 retaken.
- **A picture or GIF on the update popups.** New GitHub folder `update-popup/`: the newest GIF / PNG / JPG / JPEG / WEBP in it is shown on the Update available, Update ready and Allow the install popups, in the same full-screen look as the notification popup. No picture = the plain small popup as before. It is live (no rebuild): the workflow writes `update-popup/latest.json` ({name, commit, stamp}), and the app reads it (at most once a minute, only while an update is pending), downloads the picture once per stamp and checks that it is a real image. Shown every time the update popup appears. Separate from `popup/` (the notification picture) and `app-logo/`. A zip upload keeps the folder. New `src/updpic.js`, `tests/updpic.test.mjs` (5 tests), `update-popup/README.md`, screenshot 38.
- **Send the same picture again** (also in v132):
- Popup and logo: a picture sent again with the same name and the same bytes makes no commit on GitHub, so nothing could start the workflow. New ways to send it again, each counted as a brand-new send: (1) drop a file named `resend*` (for example `resend.txt`) into `popup/` or `app-logo/`; the workflow uses it and deletes it, so the same file can be dropped again every time; (2) upload the same picture under another name; (3) Actions > Run workflow with the new "Send the app logo again" tick (the popup tick was already there).
- A resend of the popup changes only `popup/latest.json` (no rebuild). A resend of the logo changes `app-logo/latest.json`, so it rebuilds the APK and the app offers "Update ready".
- A picture is never mistaken for a marker: only non-picture files whose name starts with `resend` count.
- Only the folders count: a picture on the repository's main page is ignored, and the next zip upload removes it.

## v131 - home-screen (launcher) icon from app-logo/ (labelled version 0.129.0 when it was written; the label is kept as a historical record)
- Initial v131 implementation: `scripts/apply-app-logo.py` turned the newest picture in `app-logo/` into launcher icons (square, round, Android 8+ adaptive). Its original built-in-icon fallback and first-frame GIF handling were later superseded by the safer v144 pipeline above.
- Workflow (`android.yml`, copy it to `.github/workflows/` by hand): the code fingerprint now also covers `app-logo/latest.json`, so a NEW logo rebuilds the APK and the app offers "Update ready". The same logo sent again rebuilds nothing. A new build step "Launcher icon from app-logo/" runs the script before `cap sync`.
- Android stores the launcher icon inside the APK, so each user taps Install once. In the original v131 design the About logo was downloaded live; v144 removes that split and packages About + launcher from the same image.
- The Android 12+ startup splash still shows the built-in note icon.
- `app-logo/README.md` rewritten to explain both paths.
- Popup manifest polling is back to 1 second (`POPUP_POLL_MS = 1000`, was 300 ms in v130). The app-logo live poll described in this historical note was retired in v144.

## v129 - bug fixes from the code review (version 0.129.0)
- Popup: the manifest stamp is compared BEFORE any download; a picture is downloaded only when it is new to the person, and never while another sheet is open (no more 25 MB re-downloads every second). The picture's blob URL is revoked when the popup closes or is discarded. A picture that failed is retried by the 5 s / 30 s timers, not by the 1-second check.
- Popup: when the manifest names a picture that is not readable yet, nothing older is shown and no GitHub API calls are made (the folder listing is used only when there is no manifest at all). The upload stamp is the picture's cache key.
- Popup (workflow): deleting the newest picture no longer re-sends the previous one to everybody (the stamp is kept).
- Update: the app polls `update/latest.json` on raw.githubusercontent instead of the rate-limited GitHub API. The workflow writes it after the APK is published. Old release-notes check stays as a fallback, at most every 10 minutes, for the first build only.
- Update: a newer build replaces a pending update popup; the update popup no longer overwrites another open sheet (it waits until it closes; "Check for updates" still shows it at once).
- Update (workflow): the code fingerprint now also covers `scripts/`, `public/`, `vite.config.js`, `capacitor.config.json` and `package-lock.json`. `versionCode` is now the build time in seconds, so it always rises (no downgrade error if the repo is recreated).
- Workflow: a run whose app code did not change (picture / logo uploads) no longer builds the APK or runs the tests. A manual run with "resend popup" unticked still rebuilds.
- Logo: the last logo is stored on the phone, so it shows at launch and offline; it is downloaded only when its stamp changes.
- Not fixable in code (Android / GitHub rules): the install confirmation tap and "Allow from this source", a different signing key, a private repo, the launcher icon, and the workflow file itself (copy `android.yml` to `.github/workflows/android.yml` by hand).

## v128 - one-second remote checks (version 0.128.0)
- App updates, app-logo manifest and in-app popup manifest are each checked every 1000 ms while the app is visible.
- Popup and logo manifest cache-buster keys also refresh each second.
- Startup, app-resume and network-reconnect checks remain in place.
- The popup is the existing in-app picture modal, not an Android notification-tray alert.
- 1 ms polling is not practical; Android/browser timers are best-effort and may be throttled while backgrounded.


## v127 - reliable in-app popup checks on Android resume (version 0.127.0)

- Clarifies and preserves the existing in-app picture popup: it is the app's own modal/sheet (the picture plus its existing Allow / Not now actions), not an Android notification-tray message.
- Keeps checking `popup/latest.json` every 15 seconds while the app is visible. The image is fetched only when the upload stamp changes.
- Adds an explicit Capacitor Android `appStateChange` resume check for BOTH the in-app popup and the independently monitored app logo. This covers devices where WebView `visibilitychange` is not emitted reliably on resume.
- Retains immediate checks on WebView foreground and network reconnect, image decode-before-seen behavior, and the existing retry/queue behavior.
- No Android notification permission is required to display the in-app picture popup. The Allow / Not now choices remain the existing in-app UI.

## v125 - reliable, continuous popup checking (version 0.125.0)

- Checks the popup manifest every 15 seconds while the app is visible, and immediately on app resume or network reconnect.
- Serializes popup processing so overlapping checks cannot race.
- Validates that the image decodes before displaying it and only marks it seen after the sheet image loads.
- Failed image displays remain eligible for retry on the next check.
- Manual workflow resend defaults to off; an intentional resend requires ticking the option.

## v124 - the popup is searched for all the time (version 0.124.0)

- The app now looks for a new popup picture every second while it is open (one tiny read of `popup/latest.json`, no picture download), exactly like the update check, and right away when you come back to it. A new upload shows the popup even if another popup is open (it waits and shows right after).
- Files: `src/popup.js`, `src/main.js`.

## v123 - the popup comes back on EVERY send (version 0.123.0)

- Fix: sending the same picture again did nothing. The app only compared the picture's bytes with the last one it showed, so a re-send (same picture, same or other file name) looked "already seen". `popup/latest.json` now carries a `stamp` that the workflow changes at every upload, and the app counts picture + stamp as "seen".
- New: an app that stays open in front checks `popup/latest.json` every minute (one tiny file, no picture download) and shows the popup as soon as a new stamp appears. Before, it waited for the next app start or a 10-minute return to the app.
- Re-paste `.github/workflows/android.yml` once (it writes the stamp).
- Files: `src/popup.js`, `src/main.js`, `tests/popup.test.mjs`, `.github/workflows/android.yml`.

## v122 - popup fixes (version 0.122.0)
- Fix: if the first attempt to fetch the picture failed (network not ready, GitHub hiccup), the app gave up until the next start. It now retries every 5 s for 2 minutes, then every 30 s for 10 more minutes.
- Fix: `popup/latest.json` naming a file that could not be read was a dead end. The app now goes on to the GitHub folder listing and the guessed names.
- Fix: the "Allow notifications?" question was asked only once ever. Every NEW picture now shows the full notification screen (picture + Allow / Not now) to everybody, also to people who already allowed.
- Workflow: the newest picture is chosen by position in the history, not commit time (two commits in the same second tied and the alphabetically last file won). Re-paste `.github/workflows/android.yml` once.
- Files: `src/popup.js`, `src/main.js`, `tests/popup.test.mjs`, `.github/workflows/android.yml`.


## v121
- Fix: the popup picture now reaches other people's phones reliably. The app first reads `popup/latest.json` (written by the workflow, no GitHub API limit, which is often hit on shared mobile networks); pictures up to 25 MB work (was 8 MB, bigger GIFs were skipped silently); if another sheet is open at launch (for example "Update ready", which v120 opens at the same moment) the picture now waits and shows right after that sheet closes, instead of being dropped; it also checks again when the app comes back to the front.
- Workflow: writes `popup/latest.json` after every run. Re-paste `.github/workflows/android.yml` once.
- Files: `src/popup.js`, `src/main.js`, `tests/popup.test.mjs`, `.github/workflows/android.yml`.

## v120
- Install permission first: as soon as an update is ready, the app checks whether Android allows installs from Liquid Dark. If not, it shows "Allow the install, once" (with an Allow button that opens Android's "Allow from this source" page) before the Install popup. `canInstallUpdates` and `openInstallSettings` in `native-android/LiquidNative.java`.
- Automatic updates: the new version downloads in the background while the app is open, then the popup shows **Update ready** with one Install tap (Android still asks you to confirm, as it always does). Settings > Check for updates downloads it too. Background download and install use `downloadUpdate` and `installDownloadedUpdate` in `native-android/LiquidNative.java` (compile-checked with `tests/java-probe-update.py`, not run on a phone yet).
- Version 120: the version number is 120 everywhere (package.json, package-lock.json, Settings > About, the README, the feature checklist and the handoff notes).
- README rewritten: what the app is, why to use it, and a quieter, honest voice inspired by Ai Hoshino (Oshi no Ko). New What's new section. Feature checklist K28 to K34 added for the v119 features.
- Screenshots: all 27 taken again from the v120 build, plus 7 new ones for the v119 screens (28 Home settings, 29 Home sections, 30 See All mix, 31 See All albums, 32 your own Home section, 33 lyrics animation, 34 Now Playing cover size). `tests/screenshots.py` now captures them: `npm run screenshots`.
- No change to app behaviour.

## v119 (Home screen: See All, calmer default Home)
- Home: See All on every row, a calmer default Home (7 rows), the rest can be turned on in Settings > Home screen.
- Home greeting: every hour of the day has its own 210 different messages (5,040 in all, none repeated in another hour), with your name (Settings > Profile, next to the picture; tap the name to change or remove it).
- Playlists row on Home.
- Now Playing cover size in Settings, with a live preview.
- Settings > Home screen: choose, hide and reorder Home sections, cards per row, card size, greeting switches, new Jump back in and Your numbers cards.
- Home screen settings, more personal: **pin your own sections** (a playlist, an artist or an album, up to 12), **a different Home for the morning, afternoon, evening and night** (choose which sections show in each), **rename any section**, and **edit the quick buttons** (order, show or hide, your own names, plus a new Play most played button).
- Apple Music style Home rows made from your own library: **Heavy Rotation** (albums you played in the last 2 weeks), **Favorites Mix** and **New Music Mix** (shuffled fresh every day). Home now updates itself: after a song counts as played, when you tap a heart, or when you change an artist photo (Recently Played, Most Played, Top Artists and the rest refresh without losing your place).
- Artist photos from Home: press and hold an artist in Your Top Artists (or the Library artists row) to choose your own photo or an album cover, or go back to the default. Same sheet as the Artist photo button on the artist screen.

## v118
- **Artist photos:** open an artist, tap **Artist photo**, then choose a photo from your phone or use any album cover. It shows on the artist page and on Home > Your Top Artists. Back to default any time.
- **Update inside the app:** tap Update in the popup and the app downloads the new version and opens Android's installer. First time only: Android asks to "Allow from this source", switch it on, come back and tap Update again.
- New app icon. Song Info > Extra details no longer shows MD5 or Cover resolution.

## v109
- Tab bar size: type any value (40-220%) or drag. Update check: runs at launch (no longer waits for the popup), on resume and every 10 min, retried after 5 min, cache-busted.

## v108
- **Tab bar size is now a slider:** Settings > Tab bar size. Drag from 70% (small) to 140% (big), 100% is the old Medium. It changes live, the glass pill re-fits, and the mini player moves with it. Reset puts it back to 100%. People who had Small / Medium / Large keep about the same size.
- **A fuller Home screen:** a greeting with your library counts, quick buttons (Shuffle all, Today's mix, Play recent, Shuffle favorites), **Because You Listen To (your top artist)**, **Your Top Artists**, **Forgotten Favorites** (favorites you have not played for 30 days), **Discover Albums** (albums you have never played) and **Browse by Genre**. Sections with nothing to show stay hidden. The older rows are unchanged.
- **Home "See All" buttons fixed** (they had no handler).
- **Fix: "Update available" no longer lost behind the notification popup.** If a popup was open when the update check finished, the prompt was dropped and not retried for 30 minutes. Now it waits and shows as soon as the popup closes.
- **Recently Played widget:** one tap opens your recently played songs. Added to Settings > Widgets and the widget picker.

## v107 (widgets)
- **More home screen widgets:** Albums and Artists (4 covers, tap to open the list), plus Shuffle all, Search and Favorites tiles, next to the Now Playing widget. Settings > Widgets can pin each one (Android 8+); older phones: long-press the home screen > Widgets > Liquid Dark.
- New `LiquidTiles.java`, layouts `lf_tile` / `lf_grid`, tap handling via `LiquidNative.getLaunch()`. `install-native.sh` registers the receivers.

## v105
- **Smaller tab bar:** the glass bar with the liquid pill is now shorter by default (Medium: 78 px instead of 94 px, slightly smaller icons and labels). The mini player and the fade above it follow it.
- **New setting, Settings > Display options > Tab bar size:** tap to switch Small / Medium / Large. Large is the old size. It applies at once and the pill re-fits itself.
- **Profile picture can be a GIF or a video:** the picker now accepts photos, GIFs and videos. GIFs and videos keep moving (videos play muted and loop), are cropped to the circle, and are kept on the phone (25 MB at most). A normal photo works as before.
- Version label: 0.105.0.

## v104 (documentation and workflow refresh)
- **README rewritten for the public repository:** a personal project shared with the community, a "What's new in v104" section, and a screenshot gallery grouped by topic (browse, Now Playing, Background style, settings and popups).
- **All screenshots retaken from the v104 build,** now 27 instead of 23. The lyrics pages use a short synced verse so they no longer look empty. New: `24-popup-notifications`, `25-update-available`, `26-background-style`, `27-now-playing-cover`. `tests/screenshots.py` makes them, with no new dependencies.
- **Setup guide (HTML) refreshed** with the same four new pictures, a short "what you will see" gallery, and the checksum note.
- **`android.yml`:** the run is now called "Liquid Dark build", the release notes carry the app version, a `liquid-flac.apk.sha256` checksum is published next to the APK, and each run writes a short build summary. Job and step names and the `code <id>` note are unchanged, so updates keep working. Re-paste the file once (guide part 4, "Changing this file later").
- **`docs/FEATURES.md`:** the product rules now say MP3 and AAC / M4A are played, as the README does.
- Docs, screenshots and tests only: these changes do not trigger "Update available".

## v104 (popup always looks the same)
- **The popup always looks the same, first time or not:** black background, the picture / GIF on top, the title, the text and the buttons. The "Update available" message now uses the same look.
- **Any picture fits:** square, wide, tall, tiny or huge, still or GIF. It is scaled to fit the space (never cropped or stretched, tiny pictures grow at most 2x) and its corners follow its real shape. Checked on three screen sizes, also with the phone on its side.
- **Liquid glass buttons:** Allow / Not now / OK / Update / Later are real liquid glass like Play and Shuffle: bright rim, glass fill, the liquid pill when you press and drag, the glint on tap.
- Version label: 0.104.0.

## v102
- **Notification popup on a black background:** the picture / GIF, the title and the buttons now sit on solid black (the whole app behind it is covered). Nothing else changed.
- **README and screenshots refreshed:** all 22 screenshots regenerated from this build, a new one of the library scan card (`23-scan.png`), a "Get the app" section for everyone, clearer publish / update / popup-picture / signing steps, credits to Ai Hoshino. Docs and screenshots only: they do not trigger "Update available".
- Version label: 0.102.0.

## v101
- **Much faster library scan** (normal CPU priority, more threads, rescans skip `.lrc` matching when nothing changed, MP3 lyrics tail read 256 KB instead of 6 MB).
- **New scan card:** black see-through glass, red accent, radar sweep + ring, covers flying in, check when done.
- **No blur anywhere**; the notification popup is see-through too (GIF on a light black veil).
- Version label fixed: the app now says 0.101.0 (it said 0.95.0 although it already contained v98 to v100 work).

## v95
- **App updates, like a normal app:** when you upload a new zip (or change code on GitHub) and the build finishes, everyone who has the app sees "Update available" the next time they open it (or come back to it). Update = the phone downloads the newest APK from Releases > "Latest build" and offers to install it; Later = asks again the next day. Picture-only changes do not trigger it. The check needs the repo to be public.
- **Important for updates to install over the old app:** the APK must be signed with the same key every time. Add the signing key as repo secrets once (see `signing/README.md`); without it each build has a different key and Android refuses to install it over the old one.
- Re-paste `.github/workflows/android.yml` once (it now writes `code <id>` into the release notes and gives the id to the app).
- Files: `src/update.js` (new), `src/main.js`, `.github/workflows/android.yml`, `tests/update.test.mjs`.
- **Upload the picture on the repo's main page:** Add file > Upload files, any picture (gif, png, jpg, jpeg, webp, any name). The workflow moves it into `popup/` by itself and the app shows it. Re-paste `.github/workflows/android.yml` once for this.
- **Popup picture: any file, any name:** put a picture (gif, png, jpg, jpeg, webp, any file name) in the repo's `popup/` folder. The app lists the folder through the GitHub API; with more than one picture it uses the one committed last. If GitHub's API cannot be reached it tries `character.gif/.png/.jpg/.webp`. No placeholder picture is shipped any more: upload yours.
- **Background style** (Settings > Background style, was "Lyrics style"): now a clear two-choice list with a tick. **Black background, red lyrics** is the default and stays the default. **Album cover colour** gives the background of **Now Playing** (new) and the lyrics page the colour of the song's cover, Apple Music style: the cover's main colour at the top, fading darker to the bottom, white text, clear buttons. It changes with each song.
- **Colour pick:** the main colour now wins over black and grey, so a mostly black cover with red light gives a red background (before, the black pulled it to a dull dark red).
- Files: `src/main.js`, `src/styles/app.css`, `tests/screenshots.py`, `README.md`, `docs/FEATURES.md`.

## v93 (popup picture, update from GitHub)
- **Notification popup:** your picture from the `popup/` folder shows at the top. The golden / orange frame is gone (Android drew its focus frame around the popup box) and the box is transparent: picture, text and two plain buttons on the dark background.
- **Update from GitHub:** the app downloads the `popup/` folder from your repo each time it opens. If the picture is different from the one the person last saw, the popup comes up again (also for people who already allowed notifications; then it has a single OK button). To change it: on GitHub open the `popup/` folder > Add file > Upload files, upload a new GIF with the same name, Commit. No new APK needed; it can take about 5 minutes to reach phones.
- **popup/ is kept** when you upload a newer project zip (the workflow no longer replaces it). Re-paste `.github/workflows/android.yml` once so this takes effect.
- The build passes your repo name to the app (`VITE_REPO`). Needs a public repo.
- **Files**: `src/popup.js` (new), `src/main.js`, `src/styles/app.css`, `.github/workflows/android.yml`, the `popup/` folder, `tests/popup.test.mjs`.

## v92
- **Lyrics style:** new Settings > Lyrics style switch. Classic = red lyrics on black (default, unchanged). Cover colour = white lyrics on a background in the album cover's colour: the colour is the average of the cover picture (colourful pixels count more than grey), darkened until white text reads well, and it changes with each song. If the picture can't be read it uses the album's gradient colour.
- Screenshot `18-lyrics-cover.png` added; README lists the feature.
- **Notification / notch players:** the album name showed twice ("Album - Artist, Album"). The artist field now holds only the artist; the album stays in its own album, subtitle and description fields. Files: `native-android/LiquidNative.java`.
- **Screenshots:** `07-lyrics.png` is red on black; added `19`-`22` (blue, green, orange, amber cover colours). Demo albums now get their real tint (`coverTint` reads CSS variables).
- **Files**: `src/main.js`, `src/styles/app.css`, `README.md`, `tests/screenshots.py`, `docs/screenshots/`, `native-android/LiquidNative.java`.

## v91
- **Profile picture:** the whole card in Settings (picture, text and empty space) is now the button that opens the photo picker, not only the round picture. The Remove chip stays its own button. Settings screenshots refreshed.
- **Files**: `src/main.js`, `src/styles/app.css`.

## v90
- **Cover viewer:** tap the cover on Now Playing (or on an album page) and you get a black screen with only the cover; tap anywhere or press Back to close.
- **Cover shortcuts:** on Now Playing, press and hold the cover (about half a second, with a tiny buzz) to open the lyrics. New switch Settings > Cover shortcuts (on by default); off = only the tap works.
- **Sleep timer:** coming back to the app re-reads the timer from the service (so a timer that fired while the app was away no longer leaves a stale pill), and the sheet's "Running: m:ss" text now counts down live.
- **README:** rewritten with every feature, small ones too, and a new screenshot set (`docs/screenshots/17`, made by `npm run screenshots`). The old ticket-era screenshots were removed. ReplayGain is no longer listed: this build has no ReplayGain code.
- **Files**: `src/main.js`, `src/styles/app.css`, `README.md`, `docs/screenshots/`, `tests/screenshots.py`, `tests/smoke.py`, `package.json`.

## v89
- Fix: with **Increase Contrast** on (or Lens refraction off) the tab bar's icon and label disappeared under the moving pill. The magnified copy is off in those modes, but the real tab was still being hidden. The real tab now stays visible whenever the magnified copy is off.
- **Files**: `src/styles/app.css` (CSS only).

## v64
- Albums sort: the Sort sheet now has 16 options, each with ascending and descending: Name, Number of songs, Duration, Year, Date updated, Artist, Album-Artist, Composer. The value you sort by is shown under the album title (songs, total length, year, date, composer).
- Artist = the main artist from the song tags; Album-Artist = the album-artist tag. Albums with no year or no composer always go last.
- Your old album sort choice carries over (Title -> Name ascending, Artist -> Album-Artist ascending, Year -> Year descending, Date Added -> Date updated descending).
- Composer needs one rescan: the library cache is now `library-v8.json`, so the first launch re-reads the files and picks up the COMPOSER tag.
- **Files**: `src/sortlist.js`, `src/data.js`, `src/main.js`, `native-android/LiquidNative.java`, `tests/sortlist.test.mjs`. Java not compiled here (small edits: one tag, cache name).

## v63
- Liquid pill everywhere: the tab bar's flowing pill now also runs on the other rows of buttons. Press and hold: it pops up under your finger; drag: it flows from button to button, stretching like liquid; release: it presses the button it ended on (release well above or below the row to cancel). Used on the player's prev / play / next, the Now Playing bottom row (lyrics, canvas, sleep ...), and every Play / Shuffle, Cancel / Save style pair in screens and sheets. New file `src/liquidgroups.js`; `src/glidebar.js` got `persist:false` (pill only while pressed, no tab highlight) and `magnify:false` options.
- Toggles: the knob is now a liquid drop. Hold it and it stretches; flip it and the leading edge shoots across while the trailing edge lags, then snaps back.
- Reduce Motion turns all of this off (plain taps, knob jumps).
- Files: `src/glidebar.js`, `src/liquidgroups.js` (new), `src/jelly.js`, `src/main.js`, `src/styles/app.css`.

## v61
- Fixes: autoplay no longer desyncs the queue from the player; playlists with a song twice edit the right row; back keeps the previous screen's scroll; A-Z sections no longer repeat for Ł Ø Đ Æ ß; album year uses the most common year; playback button errors show a message; Next on the last song behaves like the real player in the browser; a broken Canvas file only affects that file; version shows 0.61.0.
- Library: repeated ARTIST / GENRE / ALBUMARTIST tags are all kept; edited or deleted .lrc files refresh the lyrics search text; the library cache was rebuilt (`library-v7.json`), so the first launch re-reads your tags.
- Old folder permissions are released when you pick a new folder.

## v55
- Bug-report pass: Go to Album / Artist from Now Playing works; toasts show above sheets and wrap; playlist drag-reorder works; Up Next no longer jumps; Recently / Most Played plays the song you tapped; Add Songs shows the whole library; search is faster.
- Better library sorting: no fake artists from "(with ...)", real names like "AC / DC" stay whole, album artist ignores "feat.", genres per song and case-insensitive, other alphabets get their own letter sections.
- Accessibility: tabs, dialogs, Escape, focus, labels, Reduce Motion from the phone.

## v54

**Motion**
- Sheets and popups spring up, the dark background fades in, and their rows cascade in.
- The lyrics page opens with a spring; the current line scales up a little.
- List rows, cards, settings rows and the mini player wobble when tapped (not when a scroll starts on them).
- The heart pops when you add a song to Favorites.
- Reduce Motion (Settings) turns all of this off.

**Lyrics**
- They scroll and sync on their own with a smooth glide.
- When you scroll them yourself they stay where you put them: the red line keeps moving, nothing pulls you back (the old 7 second timer is gone).
- A "Now" button appears while you browse. Tap it, or tap a line, to follow the song again.

**Go to Artist and the Artists list**
- An artist now has every song they appear on, including features, not only their own albums.
- Understood in tags and titles: `feat.`, `ft.`, `featuring`, `with`, `;`, ` / `, ` x `, `(feat. X)`; `,` `&` `and` only when one side is an artist already in your library (so "Tyler, The Creator" and "Simon & Garfunkel" stay whole).
- Song menu > Go to Artist asks which artist when a song has several.
- Artists who only appear on features show up in the Artists list and in Search.

**Notification**
- Stays in the foreground while a song is loaded, so title, artist, album and cover stay after you pause.
- Display title, subtitle and description are also set for lock screens and notch apps. Needs a phone test.

**Removed**
- The A-Z letter rail on the right edge of Albums, Artists and Songs. The red letter headers inside the lists stay.

**Files**: `src/artistnames.js` (new), `src/data.js`, `src/main.js`, `src/styles/app.css`, `native-android/PlaybackService.java`, `native-android/LiquidNative.java`, `tests/artistnames.test.mjs` (new). Details for developers: `docs/HANDOFF.md`.

## v53
Edge-to-edge layout, solid black sheets, liquid-glass tab bar lens. See `docs/HANDOFF.md` and `docs/FEATURES.md`.

## v62
- Addendum: Pill retuned to the screen recording: ~1.7 tabs wide when held, ~2.5 and thinner when moving, stretches forward.
- Liquid jelly: tab-bar pill now has separate edge springs (leading edge stiff, trailing edge lags) so it stretches, thins and wobbles like liquid while moving / held; src/jelly.js adds the same squash, drag-stretch and wobble to buttons, chips, mini player and tiles (off under Reduce Motion).
- Albums sort: new "Songs: Most to Fewest" and "Songs: Fewest to Most" (song count shown under the title).


## v93 (draft - MP3 / AAC support)
- **MP3 and AAC support:** `.mp3`, `.m4a` and `.aac` files are scanned and played next to FLAC. Tags, cover, length, bitrate and sample rate come from Android's MediaMetadataRetriever / MediaExtractor. The quality badge shows e.g. `MP3 320 kbps / 44.1 kHz`; Song Info hides FLAC-only tiles (bit depth, block size, MD5).
- Sidecar `.lrc` lyrics work for all formats; embedded lyrics tags are still FLAC-only. ALAC / Opus inside `.m4a` are skipped (Media3 can't play them).
- **Embedded lyrics for MP3 / AAC:** ID3v2 `SYLT` (synced, converted to LRC), `USLT`, `TXXX LYRICS` and the `.m4a` lyrics atom are read for the Lyrics screen, lyrics search and Song Info. FLAC: lyrics that exist only as `SYNCEDLYRICS` now also feed the search, and LRC-style text in a tag is searched without its timestamps. A sidecar `.lrc` still wins when both exist.
- Library cache is now `library-v9.json`: the first start after updating rescans every file once (so lyrics and MP3 / AAC info are picked up). Playlists and favorites are untouched.
- **Lyrics found no matter what:** FLAC tags under any lyrics-style name (LYRICS, UNSYNCEDLYRICS, SYNCEDLYRICS, `SYNCED LYRICS`, `LYRICS-ENG` ...; not LYRICIST) with synced > stamped > plain priority and a 16 MB tag limit. MP3: ID3v2.2 / 2.3 / 2.4 (also after junk bytes, stacked tags, unsynchronisation, wrong v2.4 frame sizes), SYLT in milliseconds **and** in MPEG frames, USLT, TXXX, APEv2 `Lyrics`, Lyrics3v2, ID3v2 footer tags. M4A: `(c)lyr` and freeform `----` LYRICS items. The reader checks the file content, not just its extension, and falls back from one format to the other.
- **Lyrics files found by name too:** if no `.lrc` matches the file name, the scan tries the song's title and artist: `Title.lrc`, `Artist - Title.lrc`, `Title - Artist.lrc` (track numbers ignored) in the same folder, then `Artist - Title` style files anywhere in the library when exactly one fits. Embedded lyrics are used when no file is found.
- **More name-based lyric lookups:** a `.lrc` is also matched by its own `[ti:]` / `[ar:]` header (same folder first, library-wide only when exactly one file fits). A song with no lyrics of its own borrows them from another copy of the same song (same title + artist, length within 3 s, e.g. FLAC + MP3), both for the lyrics screen and for lyrics search.
- **Versions never get mixed up:** remix, live, acoustic, instrumental, VIP, sped up, edit, extended, demo, cover and similar words mark a different recording. The `.lrc` lookup (fuzzy name, title / artist, header) and the borrow-from-another-copy step only match files with the same version words, so "Song" never gets the lyrics of "Song (Remix)" or the other way round, and two different remixes stay apart. Harmless extras are ignored: `(feat. X)`, `(Remastered 2011)`, `- 2011 Remaster`, `(Album Version)`, `(Single Version)`, `(Original Mix)`, so an album track and its single still share lyrics. An exact file-name match is always used as is.

## v119 (lyrics, Extra details, Home sections)
- Lyrics: Apple Music look in both styles (red on black, white on the cover colour): no empty space above the lyrics, the playing line sits near the top, softer lines by distance, top/bottom fade. Lyric-to-lyric motion is the same as before but glides on the GPU (native scroll + CSS `translate`, `lyCenter` in `src/main.js`), so it is smoother.
- Song Info > Extra details: the "LRC word-level" tile was removed.
- Settings > Lyrics > Lyrics animation (new page, `src/lyanim.js`, tests/lyanim.test.mjs): glide speed, fade speed, playing line size, other lines size + brightness, blur on far lines, playing line height, five presets (Default, Smooth, Snappy, Blurry, Minimal) and a live preview. Saved in `set.lyAnim`; defaults = the built-in feel.
- Home > Settings > Home screen > Your own sections: "Create your own section" (`addCustom` in `src/homecfg.js`, editor `homecustom` in `src/main.js`). You name it, then add any mix of albums, artists and songs (up to 40, search to add, reorder, remove, rename). It is a normal Home section: show / hide / reorder / rename / time-of-day all work. Song cards play the section's songs (`cust:<id>` list). Counts toward the 12 pinned sections limit. Saved in `set.home.pins` (`type: 'custom'`, `items`), old saved settings load fine. Tests in tests/homecfg.test.mjs.

## v149 (startup)
- Opening the app no longer shows the scan card or "Loading library..." when the library was already scanned: the saved library, favourites, stats and playlists load at the same time (they used to run one after another before the library was read), widget pictures refresh after the library is shown, and Home shows nothing instead of "No music yet" while loading. The big scan card now appears only when the folder was never scanned.
- Files: `src/main.js` (loadLib), `native-android/LiquidNative.java` (getLibrary).

## v151 (pictures + speed)
- Saved pictures and GIFs (albums, artists, genres, playlists, background, profile) are found from the saved FILES at start: one phone call lists them all (`listPics` now returns paths, `mirrorSync` in `src/picmirror.js`), so Recently Played, the mini player, Albums and Playlists show them without waiting for a database or a list in localStorage. Playlist pictures load as soon as the playlists are known (not only when a playlist is opened) and retry 2 s / 5 s / 10 s.
- A picture the phone gave no file type for is saved as .gif / .png / ... (detected from its bytes).
- `MainActivity.java`: GPU layer for the page, offscreen pre-raster, display-priority UI thread (also on every resume).
- Test: `tests/picsync-v151.test.mjs`.

## v152 (pictures everywhere)
- A picture / GIF set for an album, artist or genre is repainted EVERYWHERE at once: `repaintAll()` in `src/main.js` rebuilds the mini player, Now Playing, the screen on top and the tab screen hidden underneath (Home incl. Jump back in / Recently Played, Albums, Playlists ...) and keeps scroll places. Before, only the open screen was redrawn. Same routine after pictures are restored at start and when the app comes back.
- Artists list rows show the artist photo / GIF (they only had an icon).
- Lyrics / Now Playing background colour follows the custom album picture.
- Notification / lock screen artwork uses the custom album picture for songs started afterwards (`Native.setCoverOverride`).
- Canvas (MP4 / GIF): the list is re-read 3 more times if it fails at start; MP4 Canvas is played again and a GIF Canvas reloaded when the app comes back.

## v153
- The notification / lock screen cover of the song that is PLAYING (and every queued song of that album) changes the moment a custom album picture is set or removed, and after a restart (`LiquidNative.setArtwork`, `Native.updateArtwork`). A metadata-only replace does not interrupt playback. The custom picture is copied to `lfart/` under a name that changes with the picture, because Android caches artwork by address.

## v154 (Back to default sticks)
- Every custom picture is only a layer over the original: album, artist, genre, playlist, profile, background and Canvas each have a remove / Back to default that shows the original again. Removing now also repaints Home and every tab at once (playlist pictures and the profile picture only refreshed the open screen).
- A removed picture stays removed: a "deleted" mark (`lf.picdel`, `src/picmirror.js`) is written first and cleared only after the file AND the IndexedDB copy are gone. If the app is closed mid-delete, or a database refuses to delete, the picture no longer comes back at the next start; an unfinished file delete is finished at start.

## v155
- A custom picture / GIF is a real LAYER: album, artist and genre pictures are painted over the original cover (not over an empty fill), so while a picture loads or if it cannot be shown the original is visible, never a blank square.
- Playlist pictures: an <img> that fails to load switches to the IndexedDB copy (`ppHeal`), and if that fails too the playlist shows its mosaic.
- `tests/picsync-v151.test.mjs` checks that no cover is painted without the shared custom-picture lookup.

## v156 (snapshot look)
- The Snapshot picture is now pure black with red #FA243C accents and liquid glass panels (see-through, no blur, bright rim fading to a red glint). The old cover-colour tinted background is gone. Files: `src/snapshot.js` (`glass`, `paintBackground`), `src/styles/app.css` (`.snapimg`).

## v156 (create playlist from a song)
- Song menu > Add to Playlist now always shows "+ New Playlist" (red) at the top, also when there are no playlists yet. It asks for a name, creates the playlist and puts the song in it. File: `src/main.js` (`addPlSheet`, `tm-newpl`, `tm-newpl-ok`).

## v156 (smart artist grouping)
- Settings > Display options > "Smart artist grouping" (ON by default, can be switched off; the Artists list and every artist screen redraw at once). ON: (1) spellings of one artist become ONE artist: ignores case, accents, punctuation/hyphens/spaces and a leading "The" (Lily Rose Depp = Lily-Rose Depp, The Weeknd = Weeknd, Beyonce = Beyoncé, A$AP = ASAP); the most used spelling is shown, no fuzzy guessing so different artists are never joined. (2) Collab / feat. credits are split into their artists (also the ALBUM artist: "Maluma, The Weeknd" is no longer listed as an artist of its own, each artist gets the song); every artist found on a collab is learned for the next one (two passes); `Various Artists` is not an artist; one-act names with separators stay whole (`PROTECTED_KEYS`: Tyler, The Creator / Earth, Wind & Fire / Simon & Garfunkel / ...). OFF: exact old behaviour.
- Listening stats follow the merged artists automatically (they read `trackArtists`). A custom artist picture saved under an old spelling is still found (`apicKey`, `artistVariants`).
- Files: `src/artistnames.js` (`artistKey`, `PROTECTED_KEYS`, `songArtists` smart option), `src/data.js` (`buildArtistIndex`, `setSmartArtists`, `artistVariants`), `src/main.js` (setting, toggle, picture lookup). Test: `tests/smartartists.test.mjs`.
- Smart grouping vs custom pictures (checked and fixed): artist photos / GIFs are saved under one name per artist. Setting, replacing or removing a photo now clears EVERY merged spelling (a removed photo cannot come back under the other spelling; only one photo is kept, GIF files too). The photo sheet shows "remove" when any spelling has a photo. Switching grouping off uses exact names only (no merging); back on, the same photos are found again. Album pictures / GIFs are keyed by album id and are not touched by grouping; stats still use the original covers. Home custom sections and pins that hold an artist by an old spelling show the artist under its current name; artist screens that are open when the switch changes are fixed (or closed when that artist no longer exists). New: `artistName()` in `src/data.js`. Tests added to `tests/smartartists.test.mjs`.
- Pictures + grouping, second pass: the logic now lives in one small module `src/artistpics.js` (`picNames`, `picKey`, `picDrop`) used by main.js (`apicNames`, `apicKey`, `apicGone`, `apicDropOthers`). Setting / replacing / removing an artist photo or GIF deletes the stored picture of every other merged spelling by key (marker AND stored bytes in IndexedDB + the file copy, even if the list had lost the marker, so the start-up file restore cannot bring it back). Home pins show the artist under its current name; an artist added to a Home custom section under two spellings shows once. Checked and unchanged: album / playlist / genre / profile / background pictures (keyed by id or genre name, not by artist), the stats and recap (original covers only), start-up picture restore. Tests: `tests/smartartists.test.mjs` (363 / 363).
