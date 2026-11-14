# Liquid FLAC Player: STATUS + HANDOFF (read this first)  [v25]

## WHAT WE ARE BUILDING (one paragraph, for any AI)
A personal, local-only, FLAC-only Android music player **inspired by Apple Music** (classic red look, large bold titles, 2-column album grid, 4 tabs) where **EVERYTHING is transparent black liquid glass** (pure black background, glass rim light + sheen, no solid grey) with **red `#FA243C` as the only accent**, plus our own extras (FLAC quality details, lyrics, loop media, queue tools). The user builds the APK **only on GitHub Actions** (workflow in `.github/workflows/android.yml`) and downloads it from the run's Artifacts. **No Android Studio, no Replit, no local Gradle.** The user works on a phone and has limited tokens: do ONE ticket per reply, output changed files, and ALWAYS hand back the whole project as ONE zip with this MD first.

## TICKET BOARD (OUTDATED: the live board is in HANDOFF.md; T17, T18, T19 are DONE, T4c step 1 was moved to the END of the list in v29)
**Accent = red `#FA243C` only. Look = transparent black liquid glass. Build = GitHub Actions APK (no Android Studio).**

**DONE (do not redo):** T14 stable signing key (v14) | T15 app icon + black splash (v14) | T16 Copy log button (v14) | T4c step 3 cover art incl. cover.jpg / folder.jpg (v14) | T3 library scan + tags (bug fixed v11) | T4 Media3 playback + notification | T4b whole app black liquid glass | T5 Genres, Folders, Artist page | T4c step 2 Android Back button (v12) | T4c step 4 Recently Added by file date (v12) | T6 Playlists: create, rename, delete, add, remove, reorder with arrows, saved (v12).

**LEFT, in this order (the next AI takes the FIRST one it can; ONE ticket per reply):**
| Order | Ticket | What | Needs from the user |
|---|---|---|---|
| 1 | T4c step 1 | Get the GitHub build green, run the phone QA checklist (section 9). T3 + T4 + v12 code were NEVER run on a phone or in CI. If the user reports a red build or a bug, fix that BEFORE anything else. | log lines / test result |
| 2 | T4c step 3 | **DONE v14** (embedded PICTURE + `cover.jpg`/`folder.jpg` fallback; phone test pending) | none |
| 3 | **DONE v16** (phone test pending) | 3-dot track menu on every song row + Now Playing, Add to Playlist sheet (uses the T6 playlist code in `main.js`: `plAction`, `savePl`), Play Next, Add to Queue, Go to Album/Artist | none |
| 4 | **PART 2 DONE v19** (phone test pending; left: drag handle, smart shuffle, persistence) | Queue / Up Next view, drag reorder, swipe remove, Clear, Save as playlist, Autoplay fill, smart shuffle, queue restored after restart | none |
| 5 | T9 | Lyrics (.lrc, word-level, synced view, tap to seek) | none |
| 6 | T10 | Loop media per song/album (GIF/MP4/image) | none |
| 7 | T11 | Song Info + Extra details sheet (read `docs/EXTRA_DETAILS.md`, needs T7) | none |
| 8 | T12 | Polish: lens refraction, long-list performance, A-B loop, T6 drag-handle reorder | none |
| 9 | T13 | Library health screen | **ask the user first** |
| 10 | T17, T18 | Playlist export / import; scan progress + auto-check (section 10). Small and independent, good right after T7 | none |
| 11 | T19, T20 | Favorites; Recently / Most Played (need T7) | none |
| 12 | T21, T22 | ReplayGain; sleep timer | none |
| 13 | T23, T24, T25, T26 | Sorting + A-Z index; gapless / calls / Bluetooth / resume; polish; accessibility | none |
| 14 | T27 | Equalizer | **ask the user first** |

**T14 to T27 (full briefs in section 10).** T14, T15, T16 are DONE in v14. The user asked for these "missing essentials" in the v13 chat, but the zip that came back to the AI did NOT contain them (HANDOFF_STATUS.md ended at T13 and FEATURES.md had no section K), so v14 wrote them in from the user's message.

**Other known leftovers (not tickets yet):** custom island-style notification layout (E4/E5), bit-perfect hi-res output check, escape-at-render for search of "&", `Native.play` sends the whole queue each time. Details in section 8.


**v25 (full verification pass, no feature change):** Passed: every JS module parses; web build; browser smoke test (0 console errors); Node tests (12 for lrc.js and songinfo.js: offsets, multi-stamps, year rules incl. leap years, pickYear, LRC meta skipping); workflow YAML; install script syntax; Java has no syntax errors (only Android/Media3 framework names unresolved here: Uri, Log, Intent, C, super, etc.); every data-act in the markup has a handler. **Known rule exception:** `src/data.js` holds the DEMO album gradient colours as hex literals (used by the browser demo only, the real library gets its colours from the cover files); the 'no hex outside tokens.css' rule is not met there. **NOT verified:** the Java against the real Android SDK, the GitHub build, any phone test. The code is NOT perfect: treat it as untested until the GitHub build and the phone checklist pass.

**v24 (T4c step 1 prep, no phone yet):** Fixed a bug that would have stopped EVERY GitHub build: `.github/workflows/android.yml` had an unquoted step name containing `T14: ...`, which YAML reads as a broken mapping, so the workflow file itself would be rejected. Now quoted and parsed OK (11 steps). Re-tested `scripts/install-native.sh` on a mock Capacitor project: Java copied, icon/splash copied, Media3 deps + service + permissions + signing added, and a second run changes nothing (idempotent). **Still open for T4c step 1:** the real GitHub run and the phone QA checklist (section 9). Possible first-run issue to watch: Media3 1.3.1 needs the Guava `ListenableFuture` on the classpath; if the build reports that class missing, add `implementation "com.google.guava:guava:33.0.0-android"` in `install-native.sh`.

**v23 (T11 Song Info):** Track menu > Song Info opens a sheet. Basic view by default (album, artist, album artist, year, genre, track, disc, length, quality). **Extra details** button shows the report's sections (TAGS incl. cover tiles and LRC file, LYRICS FILE, AUDIO, PATH), one tile per field, missing values flagged in the accent colour. Ported from `liquid_all.py` (`liquid_flac_report`): `src/songinfo.js` holds the rules (year validation for YYYY / YYYY-MM / YYYY-MM-DD / YYYY/MM/DD / YYYYMMDD with range and month/day checks, year fallbacks ORIGINALDATE / ORIGINALYEAR / RELEASEDATE, LRC analysis, cover low-res < 3000 px, bitrate, hi-res, block size, MD5 12 chars). Java `getSongInfo({uri,lrc})` reads all Vorbis values per key, STREAMINFO (channels, min/max block, MD5), every PICTURE's metadata, file size, and the matched .lrc text with encoding detection. **Checked:** songinfo.js in Node (year cases, LRC, tiles); browser test of the sheet and the toggle (no errors); Java compile check (only Android framework names unresolved, no syntax errors). **NOT done:** album-level extra details (user asked for song or album); Part 2 library health (T13); the report's custom Comment check (only empty comments are flagged, because the expected comment text is user-specific); colours per label (locked rule: no per-label colours). **Open items: 16.**

**v22 (Canvas icon):** the Canvas button icon is now a tall rounded vertical frame with a play triangle (Canvas is a 9:16 vertical loop). Search did not give Spotify's exact icon drawing, so this is a close match, not a copy; swap `I.canvas` in `src/icons.js` if the user wants another shape.

**v21 (T10 part 1, Canvas):** Now Playing has a second button next to Lyrics/Queue: **Canvas** (`I.canvas`). It is NOT the repeat button (repeat is still the song-repeat control in the transport row). Named 'Canvas' after Spotify's feature. Album cover stays the default. Tapping Canvas with no file set opens a sheet: add/change for this song, add/change for the whole album, remove. Once set, a tap toggles Canvas on/off (state in `lf.canvasOn`, default off). The track menu has 'Canvas…' too. Song-level beats album-level. Media plays muted and looped (video) or as an image (GIF/WebP). Android: `pickMedia` (MP4/WebM/GIF/WebP) copies the file into `filesDir/canvas/` (survives moving the original); `getCanvas` / `saveCanvas` persist the map in `filesDir/canvas.json`. **Known limits:** removing a Canvas does not delete the copied file yet; the video restarts when Now Playing re-renders (play/pause). **Checked:** JS syntax only; Java NOT compiled; NOT run on a phone.

**v20 (visual pass, not a ticket; user request):** (1) **See-through glass:** a slowly drifting red ambient glow now sits behind every screen (`#app::before` in `app.css`), so the glass has something to show. Sub-screens and Now Playing are no longer solid black. Glass tints lowered (`--glass-fill` .72 to .36, `--bar-fill` .86 to .50, `--sheet-fill` .84 to .52). Buttons, pills, sheets, tab bar and mini player have a real backdrop blur. **Rows stay blur-free** for long-list speed. This CHANGES the old locked rule 'pure black background': the background is black plus a red ambient glow. (2) **Fluid lens motion:** `src/glidebar.js` is now a real spring (requestAnimationFrame), not CSS transitions. The lens follows the finger with slight lag, overshoots a little on release, and stretches with speed. **Checked:** JS syntax only; NOT looked at on a phone or in a browser. Watch the phone for frame drops from the blurred ambient layer; if slow, drop `filter: blur` from `#app::before` or reduce the blur radii.

**v19 (T8 part 2, T9 done):** Up Next sheet now has **Save as playlist** (new playlist from the queue, from the current song on). **Autoplay fill** (`autoFill` in `main.js`): when fewer than 3 songs are left after the current one, adds up to 5 songs from the same album artist or genre that are not in the queue, using the existing `addToQueue` (so no new native code). Respects the existing Autoplay setting. **Checked:** JS syntax only. **NOT done in T8:** drag handle reorder (arrows only), smart shuffle (artist/album not back to back), queue restore after restart (needs SharedPreferences in Java). **T9:** done, search of full lyric text not done (search still uses the 300-char preview). **Remaining open items: 17.** Next in order: T8 leftovers (smart shuffle, persistence), then **T10 (loop media)**, then T4c step 1 (waiting for the user), T11, T12, T13 (ask user), T17-T27.

**v18 (T9 part 1):** Lyrics view from Now Playing's lyrics button (`lyricsAction`/`syncLyrics` in `main.js`): full-screen, current line highlighted, enhanced `<mm:ss.xx>` word highlight, tap a line to seek. `src/lrc.js` = pure LRC parser (`[offset:]`, several stamps per line, metadata skipped, plain text) — tested in Node. Lyrics source: a `.lrc` file in the SAME folder as the FLAC, matched by name (accent/case/punctuation-insensitive exact, else fuzzy ratio >= 0.55), stored as `lrc` on the track during scan; if none, embedded SYNCEDLYRICS / LYRICS / UNSYNCEDLYRICS read from the FLAC on demand. Java: `normName`, `ratio`, `lrcFor`, `readText` (BOM/UTF-16/UTF-8/GBK), `readVorbisText`, `getLyrics({uri,lrc})`; walk() collects `.lrc`. **Checked:** lrc.js in Node; JS syntax. **NOT compiled:** the Java; NOT run in a browser or on a phone. Search still matches only the 300-char preview. **Remaining open items: 18.** Next: finish T9 (search full lyrics), then T10.

**v17 (T8 part 1):** Up Next sheet from Now Playing's queue button (`queueSheet`/`queueAction` in `main.js`): play a queued song, move up/down (arrows, same as playlists), remove, Clear (keeps the current song). Native: `moveItem({from,to})`, `removeItem({index})`, `clearQueue()` in `LiquidNative.java`; `native.js` keeps `s.queue` in sync. **NOT done in T8 yet:** drag handle reorder, swipe remove, Save as playlist, Autoplay fill, smart shuffle, queue restore after restart. **Checked:** JS syntax only; Java NOT compiled; NOT run in a browser or on a phone. **T9 and T10: not started.** **Remaining open items: 18** (T8 part 2 counted as open).

**v16 (T7 DONE):** ⋯ on every song row (`songwrap`, `trackAction` in `main.js`) and on Now Playing. Menu: Play Next, Add to Queue, Add to Playlist (sheet of existing playlists), Go to Album, Go to Artist, Song Info (stub, T11). Native: new plugin methods `addNext({item})` / `addToQueue({item})` (`LiquidNative.java`, `itemFrom()`); `native.js` keeps `s.queue` in sync; `play()` now copies the queue. **Checked:** JS syntax only (`node --check`). **NOT compiled:** the Java; NOT run in a browser; NOT run on a phone. Go/Album/Artist push uses the same ids as the list screens; verify on phone. **Remaining open items: 18.** Next ticket: **T8** (queue view; it reuses `addNext`/`addToQueue` and needs `getQueue`/`moveItem`/`removeItem`/`clearQueue` plugin methods).

**Previous session (v15, handoff only, NO code changed):** The user asked to keep going, then clarified that the NEXT AI should do the remaining work. v15 = v14 code + this updated handoff. Nothing from T7 onward was started. **Remaining open items at v15: 19** (T4c step 1, T7, T8, T9, T10, T11, T12, T13, T17, T18, T19, T20, T21, T22, T23, T24, T25, T26, T27). Blocked on the user: T4c step 1 (CI / phone log), T13 (ask first), T27 (ask first). First available ticket: **T7** (its files: `src/main.js` `songRow` line ~50, `plAction` ~252, sheets via `sheetHtml` / `#sheet`, `Native` in `src/native.js`, plugin `LiquidNative.java`).

**For the user:** after each session the AI must return ONE zip with this file first (`liquid-flac-vNN.zip`), and must update this board (move finished tickets to DONE).

---

## 0b. What changed in v14 (T14, T15, T16, cover art)
| Change | Where | Status |
|---|---|---|
| **T14 stable signing.** `signing/liquid-flac.keystore` (PKCS12, alias `liquidflac`; password REMOVED from this history) was committed. OBSOLETE: keys are no longer in the project. `scripts/install-native.sh` appends a `signingConfigs` block to `android/app/build.gradle` and signs debug AND release with it. The script FAILS with a clear message if the keystore is missing from the repo. A CI step prints the APK certificate (`apksigner verify --print-certs`); the SHA-256 must be the same on every build (the old fingerprint is removed from this history). **NEVER regenerate the keystore**: a new key means another uninstall. | `signing/`, `scripts/install-native.sh`, `.github/workflows/android.yml` | script tested on a mock Capacitor project (twice, idempotent, fails without keystore); real Gradle run pending |
| **First install after v14:** the old APK was signed with a random GitHub key, so ONE uninstall is needed (playlists are lost; T17 will fix that for the future). After that every update installs over the old app. | user | tell the user |
| **T15 icon + splash.** Red `#FA243C` beamed note on black. Adaptive icon (vector, `lf_icon_fg.xml` + `lf_icon_bg.xml`), legacy PNGs for old phones, colours in `values/lf_colors.xml`. Splash = plain black (`styles.xml` patched: `@drawable/splash` -> `@color/lf_black`, plus Android 12+ `windowSplashScreenBackground`). Resources live in `native-android/res/` and are copied into `android/` on every build. Regenerate PNGs: `python3 scripts/make-icons.py`. | `native-android/res/`, `scripts/make-icons.py`, `scripts/install-native.sh` | XML well-formed, patch tested on mock; look: `docs/screenshots/t15_icon_preview.png` |
| **T16 Copy log.** Settings > Diagnostics > Copy log. Copies device info + last 300 JS errors/warnings (`src/log.js`, hooks `console.error/warn`, `error`, `unhandledrejection`) + the phone log (`Native.getNativeLog()` = this app's own `logcat` warnings/errors, so a crash of the previous run is included). If the clipboard is blocked a sheet with the text opens. Native errors in scan/play are now logged with `Log.w/e`. | `src/log.js`, `src/main.js`, `src/native.js`, `LiquidNative.java`, `app.css` | click-tested in Chromium (copy + fallback sheet); look: `docs/screenshots/t16_copy_log.png` |
| **T4c step 3 cover art.** `readFlac` parses PICTURE blocks (front cover preferred, else biggest), shrinks to ~600 px, saves `filesDir/covers/<sha1>.jpg` (same picture = one file). No picture in the FLAC: `cover.jpg / folder.jpg / front.jpg / albumart.jpg / album.jpg` (jpg, jpeg, png; that order) in the same folder is used. Album art is read once per album when the tags come before the picture. Cache renamed `library-v3.json` (old cache deleted; first launch rescans by itself). JS: `native.js` turns the path into a WebView url with `Capacitor.convertFileSrc` (raw path kept as `coverPath`); `data.js` puts the image on top of the gradient inside `--g`, so every cover (grid, rows, mini player, Now Playing, mosaic) shows it with no template change and a broken image falls back to the gradient. The notification gets `setArtworkUri(file://...)`. | `LiquidNative.java`, `native.js`, `data.js` | `readFlac` + `saveCover` + folder cover run against real FLAC files made with ffmpeg (see below); look: `docs/screenshots/t4c3_covers_albums.png`; phone test pending |
| About text now says Version 0.6.0 | `main.js` | done |

**How v14 was verified (more than v13):** all Java was COMPILED with javac against hand-written stubs of Android / Capacitor / Media3 (0 errors), then `readFlac`, `saveCover`, `folderCover`, `imgRank` were RUN against real 24-bit/96 kHz FLACs (with picture before the comment block, as ffmpeg writes them, and without picture). The stub test also showed that **ffmpeg-tagged files put the picture BEFORE the Vorbis comment**, so the read-once-per-album shortcut does not trigger for them (every track reads its picture; the sha1 file name still makes it one file). It is a speed matter on the first scan, not a bug. **Still not verified anywhere:** `vite build`, the Gradle build, the Actions run, `_capacitor_file_` image loading on a real phone, anything on a phone.

---

## 0a. What changed in v12 (v13 = same code, only this board was added)
| Change | Where | Status |
|---|---|---|
| Merged v10 base + v11 changed files into one tree (v11 replaced 8 files, added `sheet_t5_pages.png`). Uploaded `HANDOFF_STATUS.md` was identical to the v11 one. Old flat-look screenshots deleted. | whole project | done |
| **Mismatch found + fixed:** the v11 brief for T4c step 4 said native "already has `d.m` in the track JSON". It did not (`m` lived only in the cache entry). `tracksFrom()` now adds `added` (file mtime ms) to every track. | `LiquidNative.java` | done, phone test pending |
| **T4c step 4 DONE:** Home "Recently Added" = newest file date first (`recentAlbums(n)` in `data.js`; demo data keeps its order). | `data.js`, `main.js` | done |
| **T4c step 2 DONE:** Android Back button: closes sheet > closes Now Playing > goes back one screen > `App.minimizeApp()`. `@capacitor/app` added to `package.json`, loaded with a dynamic `import()` only on Android. | `main.js`, `package.json` | done, phone test pending (needs `npm install` in CI, which already runs) |
| **T6 Playlists DONE** (except drag handle): create (+ then Add Songs picker opens), rename, delete (confirm), add songs (search picker, 60 results, tap to toggle), remove, reorder with up/down arrows in Edit mode, persisted. Native: `getPlaylists()` / `savePlaylists({playlists})` -> `filesDir/playlists.json` (browser = `localStorage lf.playlists`). Playlist `ids` = track ids (`'t'+hash(uri)`), so they survive rescans; ids of deleted files are skipped by `plTracks()`. Names are stored RAW in the file and HTML-escaped in memory. | `main.js`, `data.js`, `native.js`, `LiquidNative.java`, `app.css` | done, click-tested in Chromium (create, add, reorder, remove, reload, rename, delete; 0 console errors) |
| Look reference for T6 | `docs/screenshots/t6_add_songs.png`, `docs/screenshots/t6_playlist_edit.png` | new |

**Still NOT verified anywhere:** `vite build`, the Gradle build, the Actions run, and anything on a real phone (no network in the AI sandbox). New Java code (`getPlaylists`, `savePlaylists`, `tracksFrom` change, `JSONArray` import) was only read-checked, not compiled.

---


Personal, local-only, FLAC-only Android player. Apple Music layout, red `#FA243C`, **everything black liquid glass**.
Stack: Vite + vanilla JS web UI, wrapped by Capacitor. **GitHub Actions builds the APK** (no Replit, no Android Studio).

**Honest progress: about 78% overall (v14).** The whole web UI is done, restyled (T4b) and now has Genres, Folders and real Artist pages (T5). It runs and was click-tested in headless Chromium (no console errors). **T3 (library scan) and T4 (playback + notification) are written but have NEVER run on a phone or in CI.** In a browser the app still shows demo data and a fake player.

## 0. What changed in v11 (read this, then section 4)
| Change | Where | Status |
|---|---|---|
| **T3 bug fix:** the FLAC tag reader skipped the Vorbis vendor string wrongly, so NO tags were read (every song became "Unknown Artist / Unknown Album"). Fixed, verified on a real 24-bit FLAC. Cache renamed `library-v2.json` so old wrong entries are ignored. | `native-android/LiquidNative.java` | fixed, phone test pending |
| **Tab bar tap bug fix:** tapping a tab did nothing (pointer capture sent the release event to the bar, not the tab). Only dragging or `window.__lf.go()` worked. Same bug hit the Color style switch. | `src/glidebar.js` | fixed + tested (tap and drag) |
| **T4b DONE: whole app is black liquid glass.** Plain list rows, Library rows, cards, settings cards, switches, genre tiles, empty boxes, Now Playing buttons, sheets and toast are now glass with a hairline rim. Strong glass (blur 14 + dark tint) only on overlays: tab bar, mini player, sheets, toast. No solid greys left. No hard-coded hex left in `app.css`. | `src/styles/tokens.css`, `src/styles/app.css` | done, screenshot-verified |
| **T5 DONE:** Library > Genres (list + genre page), Library > Folders (real folder tree from the file path), real Artist page (Play, Shuffle, Albums, Songs). Search "Browse Library" tiles open the genre page. Fixed a bug where `listOf()` cut keys at the second `:` (artist names with a colon). | `src/main.js`, `src/data.js` | done, click-tested |
| Updated look reference | `docs/screenshots/sheet_blackred.png` (12 screens), `docs/screenshots/sheet_t5_pages.png` | NEW look. The per-screen `docs/screenshots/blackred_*.png` and `vibrant_*.png` are the OLD flat look: do not match them for rows/cards/settings. |

## 1. Get the APK from GitHub (6 steps)
1. Create a private GitHub repo. Upload everything in this folder (keep the folder structure, including the hidden `.github` folder) (OBSOLETE: keys are no longer in the project; see signing/README.md).
2. Open the repo > **Actions** tab. If asked, click "I understand, enable workflows".
3. Run **Build debug APK** (it also runs on every push). Wait about 5 to 8 minutes.
4. Open the finished run > **Artifacts** > download `app-debug-apk`, unzip, install `app-debug.apk` (allow "install unknown apps").
5. If the run is red: copy the last 40 log lines and the failing file to an AI. Ask for the changed file only.
6. The workflow creates the `android/` folder itself on first run (`npx cap add android`) and copies the Java plugin from `native-android/` into it on EVERY build (`scripts/install-native.sh`, idempotent). So edit the files in `native-android/`, never inside `android/`. Committing `android/` is optional.

**Review fixes already applied (earlier rounds):** CI no longer needs a lockfile (removed `cache: npm`), Songs list sorted by title, artist pages work for names with & < > quotes, notification permission is a real prompt.

**Not verified:** this sandbox has no network for npm/Gradle, so `vite build`, the Gradle build and the Actions run were NOT executed. v11 was checked by serving the source in headless Chromium (stubbed `@capacitor/core`), by `node --check` on every JS file, and by re-running the exact tag-parsing logic of `LiquidNative.readFlac` in Java against a real FLAC. Likely first-run CI problems if red: Capacitor version pin, Java/Gradle version, Media3 1.3.1 dependency (guava `ListenableFuture` import), manifest patch.

To run the UI in a browser: `npm install && npm run dev`.

## 2. What it looks like
`docs/screenshots/sheet_blackred.png` = the 12 core screens in the CURRENT glass look. Order: home, albums, library, search, search-results, search-albums, album-detail, playlists, playlist-detail, mini-player, now-playing, settings. `docs/screenshots/sheet_t5_pages.png` = Genres, Artist, Folders root, Folder (album).
Regenerate after changes: serve the app and run Playwright against `window.__lf` (section 6). Browser test trick used in v11: serve `/` with an import map `{"@capacitor/core": "/stub.js"}` where the stub exports `Capacitor = { isNativePlatform: () => false }` and `registerPlugin = () => null`, and rewrite `import './x.css'` to a `<link>` (Vite does this normally).

### Design reference (user decision: the OLD red Apple Music look, NOT the new one)
- Colour: Apple Music red `#FA243C` (it appears as "Music Red" in the design tokens of Apple Music's web pages). It is the ONLY accent. Never add blue or any other colour. (The user said the newest Apple Music look is blue and black and does not want it; I could not verify that on the web, the rule is simply: red only.)
- Classic layout kept: large bold left titles, red selected tab, red Play / Shuffle pills, round glass header buttons, 2-column album grid, list rows with small cover + title + grey second line.
- iOS 26 "Liquid Glass" facts found on the web (MacRumors, MacStories): floating translucent tab bar that shrinks on scroll, mini player docked to it, selection "bubble" with lensing. We keep our own glass (floating pill + gliding lens, locked) and do NOT copy the shrinking tab bar or any iOS 26 colour treatment.

## 3. Done
| Area | State |
|---|---|
| Project, Capacitor config (`com.liquid.flacplayer`), `android.yml` workflow | done, CI unverified |
| Tokens: all colours via CSS variables, `html[data-style="blackred"]` remap (DEFAULT), contrast + reduce-motion switches | done |
| Glass kit: strong (`--sheen`, `--spec`, `--glass-fill`, `--bar-fill`, `--sheet-fill`) and light (`--sheen-lite`, `--spec-lite`, `--row-fill`) + rim light + spring/jelly | done |
| Floating 4-tab pill (Home, Albums, Library, Search), gliding lens, tap + drag | done (tap fixed in v11) |
| Screens: Home, Albums, Library root, Search (browse tiles, artists, albums, songs, lyrics text), Album detail, Artists, Artist page, Songs, Genres, Genre page, Folders (tree), Playlists grid + detail | done, demo data in browser |
| Mini player (glass pill), Now Playing (art, "Artist, Album", FLAC badge, scrubber with lens thumb, glass transport, shuffle, repeat Off/All/One, glass bottom buttons) | done, fake player in browser |
| Settings: Color style, Motion, Lyrics size, Increase Contrast, Autoplay switch, Diagnostics (Notification test, Music folder, Rescan) | done |
| JS bridge `src/native.js` with fixed method + event names | mock in browser, real on Android |
| Music folder picker, FLAC scan + tags, cached by mtime+size (`LiquidNative.java`) | written, tag bug fixed, phone test pending |
| Real playback, background play, media notification (`PlaybackService.java`, Media3) | written, phone test pending |

## 4. Tickets (in order). ONE ticket per reply unless the user asks for more.
Feature IDs refer to `docs/FEATURES.md`.

| # | State | Goal | Touch | Done when (phone test) |
|---|---|---|---|---|
| T3 | written, bug fixed v11, **needs phone test** | Pick folder, scan, read tags, SQLite-free JSON cache (C4, F3-F7) | `native-android/LiquidNative.java`, `src/native.js`, `src/data.js` | Your real albums appear with real artist/album names |
| T4 | written, **needs phone test** | Media3 playback, background, notification | `PlaybackService.java`, `LiquidNative.java` | Plays with screen off; notification shows title + "Artist, Album" |
| T4b | **DONE v11** | Whole app black liquid glass, red only accent, default Black & Red | `src/styles/*.css` | Looks like `sheet_blackred.png`; text readable on the phone |
| T5 | **DONE v11** | Genres, Folders, real Artist page (C1, C3) | `src/main.js`, `src/data.js` | Rows open real pages |
| **T4c** | **steps 2 + 3 + 4 DONE (3 in v14); step 1 (CI + phone test) remains** | Phone-test fixes (below, 4 sub-steps) | see brief | App survives a real test session |
| T6 | **DONE v12** (drag-to-reorder not done: up/down arrows instead; "Add to Playlist" from a song row comes with T7) | Playlists: create, rename, delete, add/remove/reorder, persist (I1-I4, I7) | `src/main.js`, `LiquidNative.java`, `src/native.js` | Build a playlist, survives restart and rescan |
| T7 | **DONE v16** (phone test pending) | 3-dot track menu, Add to Playlist sheet, Play Next, Add to Queue (I3, J4) | `src/main.js`, css, plugin | Menu works from every song row |
| T8 | **DONE v27** (T8-rest: JS smart shuffle, queue + position restored after restart; only drag handle left, moved to T12) | Queue / Up Next view, drag reorder, swipe remove, Clear, Save as playlist, Autoplay fill, smart shuffle, persistence (J3, J5-J9) | `src/main.js`, plugin | Queue survives closing the app |
| T9 | **DONE v19** (phone test pending; search still matches the 300-char preview, full-text search is a later nice-to-have) | Lyrics: .lrc parse, word-level, fuzzy match, embedded tags, synced view, tap to seek (H1-H8) | plugin, new `src/lrc.js`, `src/main.js` | Song with .lrc scrolls in time |
| T10 | **PART 1 DONE v21 (named "Canvas" in the UI, NOT loop; repeat button untouched)** | Loop media per song: GIF/MP4/image, fallback song > album > blurred cover (G1-G4) | `src/main.js`, plugin | GIF loops on Now Playing |
| T11 | **SONG INFO DONE v23 (song level; album-level extra details not done yet; phone test pending)** | **Read `docs/EXTRA_DETAILS.md` first.** Song Info sheet: Basic + Extra details tiles (F1-F8). Needs T7 first | `src/main.js`, css, plugin | Extra details match the user's FLAC report |
| T12 | todo | Lens refraction (optional SVG), perf pass, A-B loop (E7, J2) | `src/`, `glidebar.js` | Smooth on your phone |
| T13 | **ask user first** | Library health screen from EXTRA_DETAILS Part 2 (summary, problem chips, filters, sort, group) | new screen | only if the user confirms |

### 4a. Briefs for the remaining tickets (each reply = one ticket; keep the 4 locked Native method names untouched)

**T4c: phone-test fixes (do these first, one sub-step per reply if the build is red).**
| Step | What | How |
|---|---|---|
| 1 | CI green + folder + playback test | Follow section 1. If red: last 40 log lines + failing file. Then run the QA checklist (section 9). |
| 2 | DONE v12. Android Back button exits the app | add `"@capacitor/app": "^6.1.2"` to `package.json`; in `main.js` `import { App } from '@capacitor/app'`; `App.addListener('backButton', ...)`: if `#np` is open close it, else if `stack.length` pop + `renderSub()`, else `App.minimizeApp()`. |
| 3 | DONE v14. Album cover art (E1, E4); original brief: In `LiquidNative.readFlac` parse PICTURE (block type 6): type, mime, w, h, depth, data. Save the best one (type 3, else biggest) as `filesDir/covers/<hash>.jpg`, return `cover` path. JS: `Capacitor.convertFileSrc(path)`; set `--img:url(...)` on `.cover` (keep gradient as fallback, rim stays). Add `setArtworkUri(Uri.fromFile(f))` to the `MediaMetadata` in `play()`. Do NOT cache pictures inside `library-v2.json` (size). Bump the cache file name again. |
| 4 | DONE v12. Recently Added by file date | `added` (mtime) is now in the track JSON; Home sorts by it. |

**T6 Playlists (I1-I4, I7): DONE v12, the text below is the original brief. Left over: drag handle reorder (pointer events, lens feel), "Add to Playlist" sheet from rows (T7).** Model: `{ id, name, ids: [trackId] }` where `trackId` = `'t' + hash(uri)` (already stable, survives rescans). Store in the plugin: new methods `getPlaylists()` -> `{ playlists }` and `savePlaylists({ playlists })` writing `filesDir/playlists.json` (add to `native.js` as real, browser = localStorage mock). Replace `playlists` in `data.js` (`setLibrary` currently sets `playlists = []`: load them after the library). UI: header "+" (currently a toast stub) opens a glass sheet with a text field; playlist page gets rename + delete (glass action sheet), row drag handle to reorder (pointer events, same lens feel), swipe/button to remove. `mosaic()` already makes the 2x2 cover. Done when: create, add songs, restart app, still there; rescan keeps it.

**T7 Track menu (I3, J4).** Add a `⋯` glass button (`.gbtn.sm`) to every `songRow` and wire the Now Playing `⋯` (currently a toast). Menu = bottom sheet in `#sheet` (reuse `.scrim` + `.sheetbox`, dark tint + blur already styled): Play Next, Add to Queue, Add to Playlist, Go to Album, Go to Artist, Song Info (opens T11 sheet; until then a toast). Native: `addNext({item})` = `mc.addMediaItem(mc.getCurrentMediaItemIndex() + 1, mediaItem)`, `addToQueue({item})` = `mc.addMediaItem(mediaItem)`. Keep JS `state.queue` in sync (insert into the same index).

**T8 Queue (J3, J5-J9).** Queue button in Now Playing (stub now). Sheet/page "Up Next": current + list. Native: `getQueue()`, `moveItem({from,to})` (`moveMediaItem`), `removeItem({index})`, `clearQueue()`. Persist queue ids + index + position in SharedPreferences on every change and restore in `play`-less mode on start (prepare, don't auto-play). Autoplay (setting exists, saved as `autoplay`): when `remaining < 3`, append similar songs (same artist, album artist, genre, year +-3, hi-res tier; skip last 50 played). Smart shuffle: when building a shuffled order avoid same artist/album back to back (do the shuffle in JS and send the order, instead of ExoPlayer's shuffle).

**T9 Lyrics (H1-H8).** New `src/lrc.js` (pure JS, unit-testable in Node): parse `[mm:ss.xx]`, several stamps per line, `[offset:]`, enhanced `<mm:ss.xx>` word stamps, metadata tags, plain text. Native: during the SAF walk remember `.lrc` docs per folder; attach `lrc` (document uri) to a track by same base name (case + accent insensitive), else fuzzy (ratio >= 0.55); new method `readText({uri})` returns base64 bytes, JS decodes with `TextDecoder` after detecting BOM / UTF-16 / UTF-8 / `gbk` / `latin1` (that order). Embedded lyrics already come as the first 300 chars (`lyric`); T9 needs the full tag: extend `readFlac` (LYRICS, UNSYNCEDLYRICS, SYNCEDLYRICS). UI: Lyrics button in Now Playing (stub now): full-screen glass view, current line big and white, others `--text-3`, auto-scroll, tap a line = `Native.seek`, size from `--lyric-size`. Search already matches the 300-char lyric.

**T10 Loop media (G1-G4).** Per song or album: pick GIF / MP4 / image (ACTION_OPEN_DOCUMENT), copy into `filesDir/loops/`, map `{ trackId | albumId -> file }` in `loops.json` (plugin methods like T6). Now Playing: `<video loop muted autoplay playsinline>` or `<img>` in `.np .art` with the cover rim; fallback song > album > blurred cover. Button already exists (stub).

**T11 Song Info + Extra details (F1-F8).** Spec: `docs/EXTRA_DETAILS.md` (the top block wins) (its screenshots were removed in v148). Native: extend `readFlac` as listed at the end of that file; per-song details are loaded on demand with a new `getSongInfo({uri})` (do NOT put all 12 tags + MD5 for every song into `library-v2.json`). UI: tiles = light glass (`--sheen-lite`, `--spec-lite`, `--row-fill`), label `--text-2`, value `--text` bold, section headings in `--accent`, one tile per row, sticky headings, "missing" tiles flagged in red. NO per-label colours.

**T12 Polish.** Lens refraction (optional SVG filter), perf pass (the Songs/Genre/Artist/Folder pages render ALL rows; `content-visibility:auto` is on `.row.song`, add windowing if scrolling stutters on 5000+ songs), A-B loop.

## 5. Locked rules (do not change)
- FLAC only, local only. 4 tabs: Home | Albums | Library | Search.
- **The ENTIRE app is black liquid glass, clear and transparent (rim light, sheen, no solid grey fills), with red `#FA243C` as the ONLY accent, like the classic red Apple Music.** Every screen, row, card, sheet, tile, button, settings row, tab bar and mini player. Covers/artwork stay images. Pure black background. All via variables in `tokens.css` (no hex in `app.css`; add a token instead).
- **Readability rule (implemented in v11, keep it):** things that overlay moving content (tab bar, mini player, sheets, toast) = dark tint + backdrop blur (`--bar-fill` / `--sheet-fill`). Plain list rows, cards, settings and tiles = clear light glass, hairline rim, **no backdrop-filter** (long lists stay fast). Do not add `backdrop-filter` to rows.
- Extra-details tiles: NO per-label colours. Tiles = light glass with red accent, labels grey, values white (variables only).
- Red is the ONLY accent colour. Black & Red is the default Color style; Vibrant still exists in Settings until the user says to remove it.
- Do not rename `Native` methods or events: `play, pause, resume, seek, next, prev, setRepeat, setShuffle`; events `onTrackChanged, onState, onProgress, onRepeatChanged`. New methods may be added.
- The tab bar and mini player use `backdrop-filter: blur(14px)`. Fallback if slow: remove the blur and raise `--bar-fill` alpha.
- The 4 original glass files (`liquid_glass.css`, `liquid_glass_lens.js`, `liquid_glass_glidebar.js`, `liquid_glass_overrides.css`) were **not provided**; the glass was re-created from `docs/archive/HANDOFF_ORIGINAL.md`. If the user has them, replace the `src/styles` glass rules and `src/glidebar.js`, keeping the token names (and keep the v11 tap fix: remember the pressed item on `pointerdown`).
- Strings coming from tags are HTML-escaped once in `data.js` (`esc`). `dataset` values come back decoded, so always run them through `E()` (main.js) before comparing with stored names (see `listOf`).

## 6. File map
```
index.html  package.json  capacitor.config.json  vite.config.js
.github/workflows/android.yml      CI: build web > cap sync > gradle assembleDebug > upload APK
src/main.js        shell, screens (home/albums/library/search + sub screens), events, settings, Now Playing
src/data.js        demo library, setLibrary(), relPath(), genreTracks/artistTracks/folderEntries, recentAlbums(), setPlaylists/plTracks/savablePlaylists
src/native.js      mock player (browser) + real bridge (Android); keep method/event names
src/glidebar.js    gliding lens bubble (tab bar + Color style switch)
src/log.js         T16 in-app log + copy-to-clipboard
signing/liquid-flac.keystore   T14 permanent signing key (NEVER regenerate)
native-android/res/   T15 icon + splash resources (copied into android/ on every build)
scripts/make-icons.py   regenerates the legacy icon PNGs + preview
src/icons.js       inline SVG icons
src/styles/tokens.css   all colours/tokens, Black & Red remap
src/styles/app.css      layout + glass components
native-android/    LiquidNative.java, PlaybackService.java, MainActivity.java (copied into android/ by scripts/install-native.sh in CI)
scripts/install-native.sh   adds plugin, Media3 deps and manifest entries after `cap add android`
docs/FEATURES.md   feature IDs     docs/EXTRA_DETAILS.md   T11 spec     docs/archive/HANDOFF_ORIGINAL.md   original notes
docs/screenshots/       sheet_blackred.png + sheet_t5_pages.png + t6_*.png = CURRENT look (old flat per-screen PNGs were deleted in v12)
```
Test hook: `window.__lf` exposes `go(tab)`, `push(screen,id)`, `openNP()`, `setQuery(q)`, `Native`. Sub-screen names: `album, playlists, playlist, songs, artists, artist, albumsAll, genres, genre, folder, settings`.

### Data model (JS) and native payloads
| Thing | Fields |
|---|---|
| Track (JS) | `id` ('t'+hash(uri)), `uri`, `path` (relative to the music folder), `albumId`, `title`, `trackArtist`, `dur` (s), `bits`, `khz`, `lyric` (first 300 chars), `no`, `disc`, `cover` (WebView url or ''), `coverPath` (raw file path or '') |
| Album (JS) | `id` ('a'+hash(albumArtist\|album)), `title`, `artist` (album artist), `year`, `genre` (from the first track), `g` (gradient), `hires` |
| Native track JSON | `uri, title, artist, albumArtist, album, genre, year, track, disc, dur, bits, khz, lyric, added, cover` (`cover` = saved file path, optional) |
| Playlist | `{ id: 'p'+base36 time, name, ids: [trackId] }` (file: raw name; memory: escaped name) |
| Native methods | `getPlaylists()` -> `{playlists}`, `savePlaylists({playlists})`, `getNativeLog()` -> `{log}`, `pickFolder()`, `getLibrary()` -> `{tracks, hasFolder}`, `scan()` -> `{tracks, added, reused}`, `play({items:[{id,uri,title,artist,album}], index})`, `pause`, `resume`, `next`, `prev`, `seek({sec})`, `setShuffle({on})`, `setRepeat({mode})`, `notificationStatus()`, `requestNotifications()`, `notificationTest()` |
| Native events | `onTrackChanged {index}`, `onState {playing}`, `onProgress {pos}` (`onRepeatChanged` is JS only) |

## 7. Paste this into the next AI (with this whole folder)
```
Read HANDOFF_STATUS.md, docs/FEATURES.md (incl. section K) and docs/EXTRA_DETAILS.md. Continue the Liquid FLAC Player. Next: T7 (3-dot track menu + Add to Playlist + Play Next / Add to Queue), then T17/T18 or T8 (queue), see the ticket board. If I
report that the GitHub build or phone test failed, fix that first (T4c step 1). DONE: T4b, T5, T6, T4c steps 2-4, T14 (stable signing: never regenerate signing/liquid-flac.keystore), T15 (icon + splash), T16 (Copy log). T3, T4, T14, T15, T16 and cover art are written and compile-checked but never run on a phone or in CI: if the GitHub build, the folder scan, covers or
playback fail, fix that first. Ask me to paste the Settings > Copy log text when something fails.
Do ONE ticket per reply, output only the changed files, keep the GitHub Actions build green, respect the locked rules
in section 5 (black liquid glass everywhere, red #FA243C is the only accent, no hex outside tokens.css), and match
docs/screenshots/sheet_blackred.png, sheet_t5_pages.png and t6_*.png. Deliver the WHOLE project as ONE zip with HANDOFF_STATUS.md
as the FIRST entry (update this file every time). The user builds only on GitHub Actions, never Android Studio.
Test UI changes in headless Chromium before answering. Ask at most 1 question.
```

## 8. Known issues + next steps
1. **Not verified on a phone:** CI build, folder scan with real files, playback, notification, first-launch permission sheet. (T4c step 1.)
2. **Android Back button** exits the app instead of going back or closing Now Playing. (T4c step 2.)
3. **Album cover art (v14):** done, phone test pending. If covers do not show on the phone, first suspect `Capacitor.convertFileSrc` / the `_capacitor_file_` path (fallback: return a `data:` url from a native method, or `file://` with `allowFileAccess`). A cover.jpg in a folder that holds several albums is used for all of them (embedded pictures win).
4. **Notification is the Media3 default style.** Title bold + "Artist, Album" works; the custom island-style layout (E4/E5) needs a custom `MediaNotification.Provider`.
5. **Hi-res output** may be converted by Android (not bit-perfect). Check on the phone; if wanted, enable float output / USB DAC path.
6. **Search and escaping:** titles are HTML-escaped at load, so searching "&" will not match. Better: escape at render time (touches `data.js` and every template).
7. **Home "Recently Added"** is alphabetical, not by file date. (T4c step 4.)
8. **Queue after restart is not restored**, Autoplay / smart shuffle do nothing (T8).
12. **Playlists (v12):** no "Add to Playlist" from song rows yet (T7); picker shows max 60 matches (type to search); reorder is up/down arrows. Browser demo playlists are plain demo data until the first save.
9. **Folders (T5):** the path comes from the Android document id (`primary:Music/...`). It is right for normal storage; for cloud / Downloads providers the id is opaque and folders will look flat. A genre is taken from the FIRST track of each album.
10. `Native.play` sends the WHOLE queue to the service each time (fine up to a few thousand songs; if it stutters, send a window around the index).
11. **Extra details (T11):** do not start before T7 (the 3-dot menu opens Song Info). Part 2 of EXTRA_DETAILS is unconfirmed by the user (T13).

## 9. Phone QA checklist (T4c step 1; tell the user to run it and report)
| # | Check | Expect |
|---|---|---|
| 1 | Install APK, open | Black glass UI, "No music yet" + Choose music folder |
| 2 | Choose folder, wait | Toast "N songs", real album/artist names (not "Unknown") |
| 3 | Tap each of the 4 tabs, drag the lens | Screens switch |
| 4 | Tap a song, lock the screen | Keeps playing; notification shows title + "Artist, Album" |
| 5 | Prev / Next from the notification | Track changes, app UI follows |
| 6 | Settings > Notification test | A sample notification appears |
| 7 | Genres, Folders, Artist page | Real rows, tapping plays the right song |
| 8 | Close and reopen the app | Library appears at once (cache), no rescan wait |
| 9 | Playlists: + > name > pick songs > Done; kill app, reopen | Playlist still there; rescan keeps it |
| 10 | Press Android Back on a sub screen, in Now Playing, on a tab | Goes back / closes / minimises (does not exit) |
| 11 | Home > Recently Added after copying a new album in | New album comes first |
| 12 | (v14) First install of the v14 APK: uninstall the old app first, then install. Later, install a NEWER build on top without uninstalling | Installs as an update, library and playlists still there |
| 13 | (v14) Look at the home screen and open the app | Red note on black icon; black splash, no Capacitor logo |
| 14 | (v14) Albums tab | Covers from the FLAC pictures (or cover.jpg / folder.jpg); albums with none keep the gradient |
| 15 | (v14) Play a song, pull down the notification shade / lock screen | The cover is shown in the notification |
| 16 | (v14) Settings > Diagnostics > Copy log, then paste into a chat | Text with device info, app log and phone log appears |

## 10. Tickets T14 to T27 (the "missing essentials")
Status: **T14, T15, T16 DONE in v14** (phone test pending). T17 to T27 are todo. Same rules as everything else: red `#FA243C` only, black liquid glass, no hex outside `tokens.css`, do not rename the 4 locked Native methods, ONE ticket per reply, keep the build green, test in headless Chromium, compile-check Java if you touch it (see 0b for the stub-javac method). Feature IDs are in `docs/FEATURES.md` section K.

| # | State | Goal | Touch | Done when (phone test) |
|---|---|---|---|---|
| T14 | **DONE v14** | Stable signing key so updates install over the old app (K1) | `signing/`, `install-native.sh`, `android.yml` | New APK installs over the previous one; CI cert fingerprint is identical every build |
| T15 | **DONE v14** | Own app icon (red note on black) + black splash (K2) | `native-android/res/`, `install-native.sh` | Home screen shows our icon; no white/Capacitor splash |
| T16 | **DONE v14** | Settings > "Copy log" (K3) | `src/log.js`, `main.js`, `LiquidNative.java` | Pasted text contains the errors |
| T17 | todo | Export / import playlists so they survive an uninstall (K4) | `main.js`, `native.js`, plugin | Export, uninstall, reinstall, import: playlists are back |
| T18 | **DONE v29** (phone test pending) | Scan progress "n / total" + automatic check for new / removed files (K5, K6) | plugin, `main.js` | Progress counts up during a scan; a copied-in album appears without a manual rescan |
| T19 | **DONE v29** (phone test pending) | Favorites (K7). Needs T7 (menu / heart) | `main.js`, plugin | Heart a song, restart, still there |
| T20 | **DONE v30** (phone test pending) | Recently Played and Most Played (K8). Needs T7 for the Library rows only | `main.js`, plugin | Play counts survive a restart |
| T21 | **DONE v31** (phone test pending) | ReplayGain volume levelling (K9) | plugin (`readFlac` + volume) | Loud and quiet albums sound similar with it On |
| T22 | **DONE v31** (phone test pending) | Sleep timer (K10) | plugin, `main.js` | Music fades and stops at the set time |
| T23 | todo | Sorting + A-Z side index (K11, K12) | `main.js`, css | Fast jump to a letter on 5000 songs |
| T24 | todo | Gapless, phone-call and Bluetooth checks, resume last song (K13-K16) | plugin | See brief |
| T25 | todo | Small polish: disc headers, Various Artists, recent searches (K17-K19) | `main.js`, plugin | See brief |
| T26 | todo | Accessibility (K20) | `main.js`, css | TalkBack reads every button |
| T27 | **ask the user first** | Equalizer (K21) | plugin, `main.js` | Only after the user answers the question |

### 10a. Briefs
**T17 Export / import playlists.** Export = `ACTION_CREATE_DOCUMENT` (`application/json`, name `liquid-flac-playlists.json`) so the user chooses where (e.g. Downloads or Drive); import = `ACTION_OPEN_DOCUMENT`. New plugin methods `exportPlaylists()` / `importPlaylists()` (new names are allowed). Track ids are `'t'+hash(uri)` and the uri contains the music-folder tree id, so ids can differ after a reinstall with a re-picked folder. **Therefore export, for every song, `{ id, path, title, artist, album }` (path = `relPath`, folder-relative) and match on import by path first, then by title + artist + album (case/accent-insensitive); report "N of M songs matched".** Import ADDS playlists (never silently overwrites; on a name clash append " (2)"). Settings > Playlists > Export / Import. Also auto-backup a copy to `filesDir/playlists.bak` on every save (cheap safety).

**T18 Scan progress + auto-check.** `scan()` already walks first (so `total` is known) and then reads tags. Emit a plugin event `onScanProgress {done,total}` about every 25 files and show "Scanning 120 / 4,310" in the existing toast or a small glass pill (no new colours). Run the scan on a background thread so the UI stays alive. Auto-check: on app start and on resume (Capacitor `App` `appStateChange`), at most once per 10 minutes, run a cheap pass: walk, compare `uri + m + s` with the cache, and only read new / changed files; removed files already drop out because `fresh` is built from the walk. Do NOT block the UI and do not toast when nothing changed. Setting "Check for new music automatically" (default On).

**T19 Favorites.** A heart on Now Playing and in the T7 track menu. Store ids in `filesDir/favorites.json` (same pattern as playlists; browser = localStorage). Library > Favorites (a real list with Play / Shuffle). Red heart = favorite, grey outline otherwise. Optional: "Favorites" shows as the first playlist.

**T20 Recently / Most Played.** `filesDir/stats.json` = `{ trackId: { plays, last } }`. Count a play when a song has played 50% or 30 s (whichever first). Library > Recently Played (by `last`) and Most Played (by `plays`, top 100). Keep writes batched (save on pause / track change, not every tick). A "Clear history" button in Settings.

**T21 ReplayGain.** Read `REPLAYGAIN_TRACK_GAIN`, `REPLAYGAIN_ALBUM_GAIN`, `REPLAYGAIN_TRACK_PEAK`, `REPLAYGAIN_ALBUM_PEAK` in `readFlac` (small numbers, fine to cache; bump the cache name again). Setting Off (default) / Track / Album. Apply as `player.setVolume(min(1, 10^(gain/20)))` and lower the gain further if `peak * factor > 1`. Only attenuates (never boosts above 1.0), which keeps it simple. **Warn in the setting text that ReplayGain stops "bit-perfect" output** (it changes the volume digitally). Files without tags are left alone.

**T22 Sleep timer.** Now Playing "..." / Settings: 15, 30, 45, 60 minutes or "End of this song". Runs in the service-side `Handler` (it must survive the screen being off). Fade out over the last 10 s with `setVolume`, then `pause()` and restore volume. Show the remaining time in a glass pill; cancel option.

**T23 Sorting + A-Z index.** Sort menu for Songs / Albums / Artists: Title, Artist, Year, Date Added (and Duration for songs); remembered per list. Sticky letter headers + a thin A-Z rail on the right edge (touch + drag to jump, `#` for non-letters). Use `localeCompare` with `{ sensitivity:'base', numeric:true }` and ignore a leading "The " for artists. If lists stutter, do the windowing from T12 first.

**T24 Gapless, calls, Bluetooth, resume.** (a) Gapless: ExoPlayer does gapless FLAC natively; verify on a real gapless album and fix only if there is a gap. (b) Phone call / other app: audio focus is already requested (`setAudioAttributes(..., true)`); check that music pauses for a call and resumes after, and that unplugging headphones pauses (`setHandleAudioBecomingNoisy(true)` is set). (c) Bluetooth / headset buttons: play/pause/next/prev from a car or earbuds, and title + artist on the car display (comes from `MediaMetadata`). (d) Resume last song: save queue ids + index + position (SharedPreferences) on pause / track change, restore on start in prepared-but-paused state. Shares code with T8 queue persistence: do them together if T8 is not done yet.

**T25 Small polish.** (a) Album detail with several discs: "Disc 1 / Disc 2" headers (data has `disc`). (b) Various Artists: if `ALBUMARTIST` is "Various Artists" or `COMPILATION=1`, group under "Various Artists" and keep each song's own artist visible (read `COMPILATION` in `readFlac`). (c) Search: "Recent searches" list (last 8, tap to reuse, "Clear"), stored in `localStorage`.

**T26 Accessibility.** `aria-label` on every icon-only button (back, play, next, shuffle, repeat, more, tabs), `role="button"` + keyboard focus on clickable rows, visible focus ring in red, touch targets at least 44 px, announce Now Playing changes (`aria-live="polite"` on the title), respect system font size (use `rem` for text, test at 130%), keep the existing Increase Contrast and Reduce Motion switches. Test with TalkBack.

**T27 Equalizer.** **The AI must ask the user first** (one question): "Do you want (A) the Android system equalizer opened from our Settings (simple, works with other effects), or (B) our own in-app glass equalizer (10 bands, presets, more work)?" Mention that any EQ stops bit-perfect output. Do not start before the answer.

### 10b. For the user: how to upload v14 to GitHub
1. Unzip `liquid-flac-v14.zip` and upload EVERYTHING to the repo, keeping folders. (OBSOLETE: the zip contains no key any more; see signing/README.md).
2. After the green run, download the APK. **Uninstall the old app once** (it was signed with a random key), then install the new one. From now on updates install over the app.
3. If anything fails: Settings > Copy log, paste it into the chat. For a red build, paste the last 40 lines of the Actions log instead.

---

### v27 session notes (T8-rest: smart shuffle + queue restored after restart), moved here from HANDOFF.md in v28
User asked: read this file, finish ONE ticket, give the zip back (another AI does the next ticket). **Done: T8-rest** (smart shuffle + queue restored after restart). Nothing else was touched except the small things listed here.
**What changed (all of T8-rest):**
1. **Smart shuffle, done in JS** (`src/shuffle.js`, was a draft in `docs/archive/wip-restructure/`). ExoPlayer's own shuffle is NEVER switched on any more. Shuffle ON = reorder only the songs AFTER the current one (spreads artists/albums), the old order is kept in `state.orig` for undo; OFF = `restoreOrder`. The current song never restarts. Up Next sheet is now always correct while shuffling. Shuffle All = `Native.playShuffled(list)` (shuffle on + random start). `Native.play(queue, index, keep)`: with shuffle on it plays the chosen song first and shuffles the rest; `keep=true` (used by tapping a song in Up Next) plays the queue exactly as given.
2. **Queue restored after restart** (`src/session.js`, new). Saves `{ids,index,pos,shuffle,repeat,orig}` to the JSON store name `session` (debounced 600 ms on queue/track/state/repeat changes, position about every 5 s, flush when the app is hidden). `restoreSession()` runs ONCE after the first library load (`loadLib` in main.js; browser: at start). Nothing is saved before it has run. Restore = paused, no audio. Deleted songs are skipped (a missing song before the current one shifts the index; if the current song is gone: next surviving song at 0:00). If the Android service outlived the app (music kept playing after swiping away), the service's queue/position/playing/repeat are adopted instead. If the service never answers (8 s) or rejects, the UI still shows the session and the first Play/Resume loads it.
3. **`src/native.js` rewritten (one queue logic, mock + Android share it).** Same exports plus `store` (generic JSON files: `store.get(name)` / `store.set(name, data)`; Android = `filesDir/<name>.json`, browser = localStorage `lf.<name>`; use it for ALL new persistent data). New `Native.restore(snap)`, `Native.playShuffled(list)`, event `onQueue` (queue changed). `state` gained `orig`. Initial queue is empty (was the demo list). Browser mock timer now stops when paused.
4. **Java** (`LiquidNative.java`): new `replaceTail({items})` (remove everything after the current item, add the new ones), `restore({items,index,pos,force})` (see above; also forces ExoPlayer shuffle off; resolves only after the player is connected), `readJson({name})->{data}`, `writeJson({name,data})` (temp file + rename; name `[a-z0-9_-]{1,40}`). Old `setShuffle` kept (locked name) but JS no longer calls it. `playlists.json` / `canvas.json` and their methods are unchanged.
5. **main.js** (small): `shuffleall` -> `Native.playShuffled`; `q-play` -> `Native.play(st.queue, i, true)`; open Up Next sheet refreshes on `onQueue`; `restoreSession()` call after the first library load.
6. **Tests (new, `tests/`)**: `npm test` = 40 Node tests (no install needed, Node 20.6+): shuffle spread/undo, `native.js` against a fake ExoPlayer in `tests/fake-plugin.js` (invariant: JS queue == player playlist, incl. a 400-step random fuzz), restore (missing songs, index shift, service alive, service silent/rejecting), session save/restore/corrupt file. `python3 tests/smoke.py` = Chromium run of the real UI with the browser mock (needs Playwright; AI sandbox only, the user never runs it). Mutation-checked: 4 deliberate bugs (queue/player out of step after `clearQueue`, wrong shuffle tail, lost `orig` on `addNext`, wrong index after restore) each make tests fail.
**Verified:** `node --check`; 40/40 Node tests; Chromium smoke test (Shuffle button, Up Next order, shuffle off, tap in Up Next, reload restores paused, play resumes, clear saved); `javac` on all Java: no syntax errors and no duplicate methods (only "cannot find symbol" for Android classes, expected without the SDK); the new Java methods type-check against hand-made stubs of the Capacitor/Media3 APIs.
**NOT verified:** real Java compile (no Android SDK/Maven here; the stubs follow the API from memory), `vite build` (npm registry blocked here), GitHub run, ANY phone behaviour. Treat the Java as unchecked until the Actions run is green.

### v28 session notes (T17 export / import playlists), moved here from HANDOFF.md in v29
User asked: read this file, finish ONE ticket, give the zip back (another AI does the next ticket). No red build / bug report was pasted, so nothing was fixed first. **Done: T17** (export / import playlists). Nothing else was touched (T8-rest from v27 is unchanged; its notes moved to docs/archive/HISTORY_v25.md).
**What changed (all of T17):**
1. **`src/plexport.js` (new, pure, no DOM/Native)**: `buildExport` (RAW strings, per song `{id,path,title,artist,album}`; a song no longer in the library is just `{id}`), `exportText`, `parseImport` (validates; also accepts the old `playlists.json` shape with `ids`; rejects junk / files from a newer version), `makeIndex`/`matchSong` (path first, then title+artist+album, then id; case/accent/spacing-insensitive; two library copies with the same tags are used one after the other), `freeName` (name clash -> ` (2)`, ` (3)`, case-insensitive), `planImport` (-> `{lists, matched, total}`), `summary`. Import only ADDS: existing playlists are never changed. Unmatched songs are dropped (not kept as dead ids).
2. **File format v1** (`{app:'liquid-flac', kind:'playlists', version:1, exported, playlists:[{name, songs:[...]}]}`, file name `liquid-flac-playlists.json`). Do not rename fields; if the format must change, bump `version` and keep reading v1.
3. **`src/native.js`**: new `Native.exportPlaylists({text,name})` and `Native.importPlaylists() -> {text}`; both reject `'cancelled'` when the dialog is closed. Browser mock = file download / `<input type=file>`.
4. **`src/main.js`** (small): Settings has a new **Playlists** card (Export playlists / Import playlists, `data-act="plexport"` / `"plimport"`); `exportPl()` / `importPl()` sit right after `loadPlaylists`. Import needs a scanned library (else toast "Choose your music folder first"). Result toast: "Imported N playlists: X of Y songs matched". Playlists with 0 matches are still added (empty).
5. **Java** (`LiquidNative.java`, block `T17`, before `T10: Canvas`): `exportPlaylists({text,name})` = `ACTION_CREATE_DOCUMENT` (json) then writes UTF-8 to the chosen file (`openOutputStream(uri,"wt")`); `importPlaylists()` = `ACTION_OPEN_DOCUMENT` (`*/*`, no MIME filter on purpose) then returns `{text}` (max 5 MB). Callbacks `exportResult` / `importResult` use `@ActivityCallback` like `pickResult`. Safety copy: `savePlaylists` first copies the last good `playlists.json` to `playlists.bak`; `getPlaylists` reads `playlists.bak` ONLY if `playlists.json` exists but is unreadable. (filesDir dies with an uninstall, so `.bak` is not a replacement for the export.)
6. **Tests**: `tests/plexport.test.mjs` = 13 new Node tests (53 total in `npm test`): export unescaping, parse/reject, path/tag/id matching, duplicates, name clashes, two round trips (re-picked folder = new ids/uris; renamed files), 5000-song speed. Mutation-checked: 6 deliberate bugs (no lowercase, name clash not looping, export not unescaped, ignoring used copies, tags before path, unmatched kept) each fail a test. `tests/smoke.py` got step 8 (Settings > Export downloads a file, Import adds the playlists back with ` (2)` names, saved). **New `tests/java-probe.py`**: type-checks the T17 + playlist Java methods against hand-made API stubs (there is no `javac` binary here, but `java --module jdk.compiler/com.sun.tools.javac.Main` works). Reuse it for other Java changes (add stubs + change the two region markers).
**Verified:** `node --check`; 53/53 Node tests; Chromium smoke test (all steps incl. export/import, no console errors); screenshot `docs/screenshots/t17_settings_playlists.png`; Java probe OK (and it fails on a deliberate typo).
**NOT verified:** real Java compile (no Android SDK; stubs are from memory), `vite build` (npm registry blocked here), GitHub run, ANY phone behaviour (the Android file dialogs have never run). Treat the new Java as unchecked until the Actions run is green.

### v29 session notes (T18 scan progress + auto-check, T19 favorites), moved here from HANDOFF.md in v30
User asked: do 2 tickets, give the zip, update this file, say which tickets and how many are left, and move the "needs GitHub / phone QA" ticket (T4c step 1) to the END of the list. No red build / bug report was pasted, so nothing was fixed first. **Done: T18 (scan progress + auto-check) and T19 (favorites).** T8-rest (v27) and T17 (v28) are unchanged and still wait for the phone test.

### T18 - scan progress + automatic check
1. **`LiquidNative.java`, block `T18` (right before `T6: playlists`)**: `scan()` now returns at once and runs `runScan` on a thread `lf-scan` (low priority, so music is not disturbed). A second `scan()` while one runs is rejected with message `busy`. Event **`onScanProgress {done,total}`**: first `done=0` (total known after the walk), then every 25 files, last one at `done=total`. Result of `scan()`: `{tracks, added (read from disk), reused, newSongs (never seen before), removed (in old cache, gone now), touched (kept songs whose .lrc or cover changed)}`. A broken single file is skipped as before; the cache file is written once at the end.
2. **`src/autocheck.js` (new, pure)**: `shouldCheck({enabled,hasFolder,busy,now,last})` (max once per 10 min `MIN_GAP_MS`), `progressText(done,total)` -> "Scanning 120 / 4,310", `changeText({added,removed})` -> "3 new songs added, 2 songs removed" or `''` (= stay silent).
3. **`src/native.js`**: forwards `onScanProgress` as a JS event (`on('onScanProgress', ...)`); doc comment on `Native.scan`.
4. **`src/main.js`** (section `T18` just above `loadLib`): `runScan(quiet)` (one scan at a time, sets `lastCheck`), `loadLib` uses it, shows the progress toast (toast now takes a duration: `toast(msg, ms=1800)`), `autoCheck()` runs 3 s after start (end of `loadLib`) and on Capacitor `App` `appStateChange` (isActive), keeps scroll position when it swaps the library in, toasts only when something changed. Settings > **Library** card: switch "Check for new music automatically" (`set.autoCheck`, default On, saved in `lf.settings`). Picking a new folder while a scan runs is refused with a toast (otherwise the old folder would be written back into the cache).
5. Because `setLibrary()` resets `playlists`, `autoCheck` and `loadLib` call `loadPlaylists()` right after it (keep that pair together).

### T19 - favorites
1. **`src/favorites.js` (new, pure)**: `cleanFavs`, `isFav`, `toggleFav` (adds on TOP = newest first), `favTracks(favs, tracks)` (ids no longer in the library are skipped but kept in the file, so a re-picked folder brings them back).
2. **Storage**: `store` name `favorites` = JSON array of track ids (Android `filesDir/favorites.json`, browser `localStorage lf.favorites`). Loaded by `loadFavs()` (start of `loadLib`; browser: bottom of main.js). NOTE: ids are `'t'+hash(uri)` and change if the music folder is re-picked, same limitation as playlists; there is no export for favorites yet (idea: add them to the T17 export file as a `favorites` list of `{id,path,title,artist,album}` and bump `version` to 2, keep reading v1).
3. **UI (`main.js`, section `T19`)**: heart button on Now Playing (red filled = favorite, grey outline = not; `data-act="fav"`), track menu first item "Add to Favorites / Remove from Favorites" (`tm-fav`), Library > **Favorites** row (second row) -> screen `sub.favorites` with Play / Shuffle (`listOf('fav')`). Toggle shows a toast and refreshes Now Playing and an open Favorites screen. New icons `I.heart`, `I.heartFill`; css `.gbtn.fav`.

### Verified (v29)
`node --check`; **63/63** Node tests (`npm test`; +10 new: `tests/autocheck.test.mjs`, `tests/favorites.test.mjs`; 3 deliberate bugs each fail a test); Chromium smoke test (`python3 tests/smoke.py`, now steps 9 = favorites and 10 = auto-check switch; no console errors; screenshots `docs/screenshots/t19_*.png`, `t18_settings_library.png`); Java: `python3 tests/java-probe-scan.py` (NEW, type-checks the T18 block against stubs; fails on a deliberate typo) and the old `tests/java-probe.py` both OK.
**NOT verified:** real Java compile (no Android SDK), `vite build` (npm registry blocked here), the GitHub run, ANY phone behaviour. Biggest unknowns in the new Java: resolving a `PluginCall` and calling `notifyListeners` from the `lf-scan` thread (normal in Capacitor, but never run here) and `android.os.Process.setThreadPriority`. The progress toast and `autoCheck` cannot run in the browser mock (no folder): only the pure helpers and the Settings switch are tested.


## v30 session notes (moved here from HANDOFF.md in v31)
(v30: T10 leftovers + T20 Recently / Most Played)
User asked: "12 tickets left? work on two more". No red build / bug report was pasted, so nothing was fixed first. **Done: T10 leftovers and T20 (Recently / Most Played).** Skipped on purpose: **T12** (big, mostly look-and-feel: lens refraction, long-list windowing, A-B loop, drag handles; needs a phone to judge, best done as its own session) and **T13** (must ask the user first). T4c step 1 stays LAST.

### T10 leftovers (both fixed)
1. **Delete the copied Canvas file** (`LiquidNative.java`, right before `T11: Song Info`): `saveCanvas` writes the map, THEN `pruneCanvasFiles(map)` deletes every plain file in `filesDir/canvas/` that no map entry points to any more (so replacing or removing a Canvas frees the space). Pure rule `static unusedCanvasFiles(keptPaths, presentNames)` (match by file NAME). A missing map never deletes anything. Run for real by **`tests/java-probe-canvas.py`** (9 cases, plain JDK) + compile check of the rest against stubs.
2. **Video restarted on every re-render**: `renderNP` (main.js) now keeps the running `.cvmedia` element: it grabs it before `np.innerHTML` is rebuilt and, if the new markup has the same tag + `src`, puts the OLD node back (`fresh.replaceWith(liveMedia)`); `syncCanvas()` then resumes it if playing. Detaching a `<video>` pauses it but keeps `currentTime`, so it continues where it was. Tested in the smoke test (step 12: same DOM node after play/pause) with a data-URL GIF; a real MP4 on a phone is NOT tested.

### T20 - Recently Played / Most Played
1. **`src/stats.js` (new, pure)**: `cleanStats`, `bump`, `recentList` / `topList` (top 100; library songs only), `threshold(dur)` = min(30 s, half the song), **`makeCounter()`** = `track(id)` on song change + `tick(pos, dur)` on every progress event; counts REAL listening (steps > 5 s or backwards are seeks and ignored), exactly once per play; repeat-one wrap-around starts a new play.
2. **Storage**: `store` name `stats` = `{ trackId: { plays, last } }` (`last` = ms time of the counted play). Written ONCE per counted play (not per tick). `loadStats()` next to `loadFavs()`.
3. **UI (`main.js`, section `T20`)**: Library rows **Recently Played** and **Most Played** (icons `I.recent`, `I.top`) -> screens `sub.recentPlayed` / `sub.topPlayed` with Play / Shuffle (`listOf('recent')` / `listOf('top')`); Most Played rows show "N plays" instead of the duration (`songRow(..., { note })`). Settings > Library > **Clear play history** (confirm sheet, `statsAction`).
4. Like favorites and playlists, ids change if the music folder is re-picked (history of old ids stays in the file but is hidden).

### Verified (v30)
`node --check`; **76/76** Node tests (+13 `tests/stats.test.mjs`; 3 mutants each fail a test); Chromium smoke test OK (new step 11 uses a FAKE CLOCK via `page.clock`, so 30 s of listening takes no real time: 12 s = no play, skipping = no play, 30 s = exactly 1 play, no double count, both lists, "1 play", Clear; step 12 = Canvas node kept; the T10 mutant fails it); Java probes `java-probe.py`, `java-probe-scan.py`, `java-probe-canvas.py` all OK. **NOT verified:** real Java compile, `vite build`, GitHub run, any phone behaviour. Open phone question for T20: progress events must keep reaching JS while the screen is off (the queue autoplay already depends on that); if plays are not counted with the screen off, move the counting into Java (`onMediaItemTransition` + position) and keep `stats.js` rules.

## v31 notes (moved from HANDOFF in v32)
Session v31 - what happened
User: "complete the next tickets ... just do two tickets". No red build / bug report was pasted, so nothing was fixed first. **Done: T21 (ReplayGain) and T22 (sleep timer).** Skipped on purpose: T12 (big, look-and-feel, needs a phone), T13 (ask the user first), T23 (JS only, the best next pick). T4c step 1 stays LAST. (The v30 notes moved to the end of docs/archive/HISTORY_v25.md.)

### T21 - ReplayGain (setting Off / Track / Album, default Off)
1. **Tags**: `readFlac` reads `REPLAYGAIN_TRACK_GAIN / ALBUM_GAIN / TRACK_PEAK / ALBUM_PEAK` ("-6.54 dB", "+3.2dB", comma decimals all parse) into the song as `rg: { t, a, tp, ap }` (only numbers that parse; no gain tag = no `rg`). **Cache renamed `library-v4.json`** (the old v3 file is deleted in `loadCache()`; the first launch after the update rescans by itself).
2. **Rules, pure** (`native-android/ReplayGain.java`, no Android imports): volume = `min(1, 10^(gain/20))`, lowered further to `1/peak` if `peak * volume > 1`; **only turns DOWN, never boosts**; Track mode with no track tag falls back to the album tag (and the other way round); no tags / Off / unknown song = 1.0. Static registry `id -> gains` filled by `LiquidNative.rememberGain()` from every item JS sends (`itemFrom` and the loop in `play`); static on purpose so it survives the plugin being re-created while the service plays.
3. **Applying**: `PlaybackService` (not the MediaController) calls `player.setVolume(base * fade)` in `onMediaItemTransition` and when the mode changes (`PlaybackService.refreshVolume()`, called by the plugin method `setReplayGain({mode})`). Works with the screen off. **Only `PlaybackService.applyVolume()` may set the volume** (it combines ReplayGain and the sleep fade).
4. **JS**: `src/replaygain.js` (pure: `cleanRg`, `nextRg`, `RG_LABEL`, `cleanRgTags`). `data.js` keeps `t.rg`; `native.js` `item()` sends `rg`; `Native.setReplayGain(mode)`; Settings > Playback > **ReplayGain** row cycles Off > Track > Album (`data-act="rgmode"`, saved in `set.replayGain`); its text warns that it is no longer bit-perfect. `main.js` sends the saved mode to Java at every app start.

### T22 - sleep timer
1. **Lives in `PlaybackService.java`** (service-side main-thread `Handler`, deadline = `SystemClock.elapsedRealtime()`, tick 250 ms): minutes mode (15 / 30 / 45 / 60) or **End of this song**. The last 10 s fade the volume to 0 (`SleepTimer.fade`, pure) x the ReplayGain volume; then `pause()` and the volume is restored. End of song uses `ExoPlayer.setPauseAtEndOfMediaItems(true)` and fires on `onPlayWhenReadyChanged(.., END_OF_MEDIA_ITEM)` (it also fades the last 10 s of that song; the player is then already on the NEXT song, paused). If the queue ends first the timer is cleared too. A new timer replaces the old one. The timer keeps counting while paused. If Android destroys the service the timer is gone.
2. **Plugin methods** (`LiquidNative.java`, section T22): `setSleepTimer({minutes}|{endOfSong:true})` (rejects "Nothing is playing" / "bad minutes"), `cancelSleepTimer`, `getSleepTimer` -> `{active,endOfSong,endsInMs,fired}`; event **`onSleepTimer`** with the same fields (the service talks to the plugin through the static `PlaybackService.sleepListener`, set by `hookSleep()` inside every sleep method).
3. **JS**: `src/sleep.js` (pure: `SLEEP_MINUTES`, `cleanMinutes`, `fmtLeft`, `pillText`, `setText`). `native.js`: state `sl = {active, endOfSong, endsAt}` (`Native.sleepState()`), `setSleepTimer / cancelSleepTimer / getSleepTimer`, event `onSleepTimer` (+ `fired`). **Browser mock** = a 1 s interval that pauses playback (so tests and the smoke test run it). UI (`main.js`, section `T22`): moon button on Now Playing (4th button, red while a timer runs), sheet with the 4 durations + End of this song + Turn off timer, and a glass pill under the quality badge with the countdown (text updated every second without a re-render). Fired = toast "Sleep timer: music stopped". At app start `Native.getSleepTimer()` re-reads a timer that kept running.

### Verified (v31)
`node --check`; **93/93** Node tests (+17: `replaygain`, `sleep`, `loudness-native` (fake plugin), `sleep-mock` (fake clock)); Chromium smoke test OK (new step 13, fake clock: setting cycles + persists, sheet, pill counts down, cancel, fire pauses, end of song; run twice); NEW **`python3 tests/java-probe-gain.py`**: RUNS `ReplayGain.java` + `SleepTimer.java` for real (32 cases) and type-checks `PlaybackService.java` + the new `LiquidNative` pieces against hand-made stubs. Mutants: removing the peak limiter fails the probe, a fade that never reaches 0 fails it, a mock timer that does not pause fails Node. (Removing only the `min(1, ..)` boost cap fails nothing: the final clamp makes it an equivalent mutant.) Older probes (`java-probe.py`, `-scan`, `-canvas`) unchanged. Screenshots: `docs/screenshots/t21_replaygain_setting.png`, `t22_sleep_pill.png`, `t22_sleep_sheet.png`.
**NOT verified:** real Java compile. The Media3 stubs are from memory, so if CI is red look first at `setPauseAtEndOfMediaItems`, `Player.PLAY_WHEN_READY_CHANGE_REASON_END_OF_MEDIA_ITEM`, the `Player.Listener` method signatures and `MediaSessionService extends Context` in `PlaybackService.java`. Also not verified: `vite build`, the GitHub run, any phone behaviour (does the volume really change per song? does the timer fire with the screen off?).

## v32 notes (moved here from HANDOFF in v33)
### Session v32 - what happened
User: "Do two tickets, minimal tokens, update the md, give me the zip." No red build / bug report was pasted. **Done: T23 (sort + A-Z) and T25 (polish).** T24 was NOT coded: its code is already in place (audio focus + `setHandleAudioBecomingNoisy` + MediaSession buttons/metadata + resume-last-song), what is left is only a phone check (list below). T12 / T13 / T27 untouched. (v31 notes are at the end of docs/archive/HISTORY_v25.md.)

### T23 - sorting + A-Z index
1. **`src/sortlist.js`** (pure, tested): `SORT_OPTS` (songs: Title, Artist, Year, Date Added, Duration; albums: Title, Artist, Year, Date Added; artists: Name, Date Added), `cleanSort / cleanSortSet`, `sortTracks / sortAlbums / sortArtists` (new arrays; `Intl.Collator` base sensitivity + numeric; leading "The " ignored for artists; strings are unescaped first because the library holds HTML-escaped text), `letterOf` (A-Z, accents folded, `#` for the rest), `groupLetters`, `pickLetter`, `RAIL`. Year / Added / Duration are newest / longest first.
2. **`main.js`** section `T23`: chip `Sort: X` under the big title of Albums (tab + Library > Albums), Library > Songs, Library > Artists (`data-act="sortmenu"` opens a sheet, `sortset` saves). Choice is remembered per list in `set.sort` (localStorage `lf.settings`). Title / Artist / Name modes group into `<section class="lsec" data-letter>` with a sticky red letter; other modes are one plain list. **`listOf('songs')` = the sorted Songs list** (so tapping a row plays in the shown order; key `'all'` is still the title-sorted library used by search).
3. **A-Z rail**: `#azrail` is added to `#app` by `mountRail()` (called at the end of `renderMain` / `renderSub`) only when the visible screen has 2+ letter sections. Touch / drag on it jumps via `pickLetter` (nearest present letter). Not shown for Year / Added / Duration.

### T25 - polish
1. **Disc headers**: `albumRows()` puts "Disc N" headers in the album detail when the album has more than one disc.
2. **Various Artists**: Java `isComp(tag)` (COMPILATION = 1 / true / yes). With no ALBUMARTIST tag a compilation now gets album artist "Various Artists" (in `readFlac` AND in `albumKey` for covers); every song still shows its own artist in the row. An ALBUMARTIST of "Various Artists" already worked. **Cache renamed `library-v5.json`** (v3 and v4 are deleted in `loadCache()`; the first launch after the update rescans by itself, like in v31).
3. **Recent searches**: `src/recent.js` (pure: `addRecent`, `cleanRecent`, last 8, newest first, case-insensitive dedupe, min 2 chars) in `set.recent`. Saved on Enter in the search box or when a result is tapped. Empty search shows "Recent Searches" (tap = reuse, Clear) above Browse Library.

### Verified (v32)
`node --check`; **100/100** Node tests (+7 in `tests/sortlist.test.mjs`, covers sortlist + recent); Chromium smoke test OK incl. new step 14 (sort button + letters + rail, Year sort hides them, Duration order, play follows shown order, choice survives reload, recent searches save / reuse / clear); all 4 Java probes OK (they do NOT cover the new `isComp` lines: plain `Map<String,String>` code, but never compiled).
**NOT verified:** real Java compile, `vite build`, the GitHub run, any phone behaviour (rail touch feel, sticky letter under the status bar, a real multi-disc / compilation album).

## v33 notes (branch A: T27 + A-B loop) and v32 branch B notes (T24 + T26), moved here from HANDOFF in v36
### Session v33 - T27 + A-B loop (branch A, merged in v36)
### T27 - equalizer (option A: system EQ, no in-app EQ)
1. `PlaybackService.java`: `announce(id)` broadcasts `ACTION_OPEN/CLOSE_AUDIO_EFFECT_CONTROL_SESSION` (package + music type) from `onCreate`, `Player.Listener.onAudioSessionIdChanged`, and `onDestroy`; `audioSession()` returns the id (0 = unknown).
2. `LiquidNative.java` `openEqualizer`: starts `ACTION_DISPLAY_AUDIO_EFFECT_CONTROL_PANEL` with the session; rejects "Play a song first" or "No system equalizer found on this phone" (ActivityNotFoundException; no manifest `<queries>` needed).
3. `native.js` `Native.openEqualizer()` (browser mock rejects "Only on the phone"). Settings > Playback row **Equalizer** (`data-act="eqopen"`, errors shown as a toast; text warns it is not bit-perfect).
Note: some phones (many Pixels) have NO system equalizer: then the toast shows. If so, the user can choose option B (own 10-band EQ = Media3 `Equalizer` / `DynamicsProcessing` + bands UI) later.

### A-B loop (T12 part 1)
`src/abloop.js` (pure, tested): `tapLoop` (tap 1 = A, tap 2 = B, must be >= 1 s after A, tap 3 = clear), `jumpTo` (progress event at/after B -> seek to A), `loopState`, `markPct`. `main.js` section "T12 part: A-B loop": button `A-B` in the Now Playing bottom row (`data-act="abloop"`, red when a loop exists, `A-` while only A is set), two white markers `#abA` / `#abB` on the scrubber, loop is reset when the song changes. Jump runs from `onProgress` (Java sends it every 250 ms: the loop can overshoot B by up to ~0.25 s).

### Verified (v33, before the merge)
`node --check`; **106/106** Node tests (+6 in `tests/abloop.test.mjs`); Chromium smoke OK incl. new step 15 (A-B taps, marker, jump back, clear, reset on next song); all 4 Java probes OK (`java-probe-gain.py` got stubs for Intent / AudioEffect / Activity and now also checks `openEqualizer` + the service `announce` code).
**NOT verified:** real Java compile, `vite build`, GitHub run, phone behaviour (below).



### Session v32 (branch B) - T24 + T26 done (merged in v36)
User: "do tickets 24 and 26", minimal tokens. No red build reported. **Done: T24 (code part) and T26.** Skipped: T12, T13, T23 (best next pick), T25, T27.
### T24 gapless / calls / BT
Audit of `PlaybackService.java`: gapless = ExoPlayer default (nothing to code); call / other app = `setAudioAttributes(.., true)` (focus handled by ExoPlayer, pauses and resumes); unplug = `setHandleAudioBecomingNoisy(true)`; headset / car buttons = MediaSession (Media3 default); resume-last-song was done in T8. **Only change:** media items now also carry `albumArtist` + `trackNumber` (`LiquidNative.itemFrom` and the loop in `play`; JS `item()` in native.js sends `albumArtist`, `no`) so car / Bluetooth displays show them. The `artist` field is still "Artist, Album" (notification line, unchanged on purpose).
### T26 accessibility
`src/a11y.js` (pure `labelFor`, `rowLabel`, `LABELS` + DOM pass `applyA11y`). `main.js` (end of file, block T26) runs it after every render through a MutationObserver: aria-label from `data-act` on icon-only buttons (play/pause, repeat state, favorite state are dynamic), `role=switch` + `aria-checked` on settings toggles, `aria-pressed` on shuffle/repeat, `aria-current` on the playing row, `aria-hidden` on svg icons, `role=slider` on the scrubber, `tabindex=0` on the mini player. Hidden `#live` region (`aria-live=polite`) announces "Now playing: title, artist". CSS (end of app.css): red `:focus-visible` ring, 44 px targets (mini buttons, small buttons, tabs, seg, toggle hit area). **New icon-only button = add its `data-act` to `LABELS`** (smoke step fails otherwise). Text size: Android WebView follows the system font size by itself; fonts are still `px` (not converted to `rem`, see risks). Increase Contrast / Reduce Motion unchanged.
### Verified (v32)
`npm test` 96/96 (+3 `a11y.test.mjs`); all 4 Java probes OK; Chromium smoke OK incl. new T26 step (no unnamed icon-only button on Now Playing, live region exists). **NOT verified:** real Java compile (`setAlbumArtist`, `setTrackNumber(Integer)` are the new Media3 calls: if CI is red look there first), TalkBack on a phone, calls / Bluetooth / car behaviour, gapless on a real album.
### Phone test list v32
**T24:** 1. Play a gapless album (live / classical): no gap between songs. 2. Phone call: music pauses, resumes after. 3. Unplug headphones: pauses. 4. Bluetooth / car: play, pause, next, prev work; display shows title, artist, album. **T26:** 1. Turn on TalkBack: every button is spoken with a name (Play/Pause, Next song, Shuffle on/off...). 2. Settings switches say "switch, on/off". 3. Song change is announced. 4. System font size 130%: nothing is cut off badly (report what is).
### T26 small risks (not fixed)
Text is `px`, not `rem` (WebView scales it with the system size; layout at 130% untested). The a11y pass re-labels the whole `#app` on every DOM change (cheap, but a long list re-renders it all). Song rows have no TalkBack custom actions (the three-dots button is its own stop). Scrubber has role slider but no keyboard / TalkBack adjust action yet.


