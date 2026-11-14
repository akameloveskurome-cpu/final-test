# Liquid FLAC Player: multi-AI handoff

A personal, local-only, FLAC-only music player for Android. Apple Music layout and red accent, with YOUR liquid-glass look from `liquid_all.py`. It is built on GitHub Actions, so no Android Studio is needed.

## Order of work

**See `PHASE_PLAN.md` for the full phase-by-phase plan (which AI, in which chat, in what order).** Short version:

1. **Planning AI 1** writes the UI/UX spec.
2. **Planning AI 2** writes the architecture and the GitHub build plan.
3. **Planning AI 3** writes the data model and the Song Info spec.
4. Paste all three outputs into a single `PLAN.md`.
5. **Build AI A to D** each get: the shared context, `PLAN.md`, the reference files, and their own prompt.

Every AI gets the **Shared context** block below, the files in `liquid_ref/`, and your Apple Music screenshots (the 6 images).

---

## Where the glass design lives (so nobody has to search)

`liquid_all.py` is 42k lines. Nearly all of it is Termux code and base64 blobs, and none of that matters here. The glass design is in these places only. Embedded blocks start with `#|`, which has to be stripped. I already extracted the useful parts for you, so give the AIs these files and tell them **not to open liquid_all.py** unless a detail is missing.

| File | What it is | Source in liquid_all.py |
|---|---|---|
| `liquid_glass.css` | THE glass: `:root` tokens (`--sheen`, `--spec`, `--spring`, `--accent:#FA243C`), `.glass`, `.card`, `.chip`, `.f` field tiles, `.seg` bar, `.lens` bubble, `.rimr` rim | lines 5375-5453 (`_LG_CSS`) |
| `liquid_glass_lens.js` | Chrome-only SVG displacement refraction (bends light at the bubble's edge, with a red/green/blue colour fringe) | lines 5455-5505 (`_LG_JS`) |
| `liquid_glass_glidebar.js` | The gliding bubble bar: drag, spring physics, jelly squash, hot/on states, scroll-spy | lines 5506-5686 (`_LG_SPY_JS`, includes `glide()`) |
| `liquid_glass_overrides.css` | Later refinements (`lg` to `lg4`): the final transparent look, lens rim, search pill, panel sheen | lines 8257-8344 (inside `PAGE`) |

Everything else in the file is not needed:
- Lines 1-4860: the Termux server.
- Lines 2782-2860 (`GLASS_JS`, "Picture/Black" toggle): skip.
- Lines 9213 onward: 6 more copies of the same kit, plus xterm blobs.

**The design language in one paragraph (for AIs that can't read the CSS):**
Pure AMOLED black background. Surfaces are NOT frosted: `backdrop-filter: blur(0px) saturate(1.3)`, a very faint diagonal white sheen (`--sheen`), and a bright specular rim made of 2 to 3 inset shadows (`--spec`: a 1px hairline, a bright top-left edge and a softer bottom-right edge). A soft drop shadow gives depth. Radii are large (26px for cards, 30px for headers, pill for buttons and chips). The bottom bar is a floating pill with a **gliding lens bubble** that has no fill. It refracts what is behind it, has a conic-gradient rim, and moves with spring physics and jelly squash while dragging. Text is white on black. Animation uses `--spring: cubic-bezier(.3,1.45,.5,1)`. **Only change:** the accent becomes Apple Music red `#FA243C` (already in your file as `--accent`) for active tab, play buttons, icons and highlights.

**Your lyrics-file logic (reuse it, don't reinvent):** `liquid_all.py` lines 7842 to 7880 (`lrc_for` finds the same-name .lrc, `TS_RE` timestamps, `ENH_RE` word-level stamps, `META_RE` tags like ar/ti/al/offset, `analyze_lrc` encoding + synced + word-level detection) and line 8083 (`lrc_hints`, fuzzy match with cutoff 0.55).

**Your colour palette:** already in `liquid_glass.css` `:root` (green `#30d158`, orange `#ff9f0a`, yellow `#ffd60a`, blue `#0a84ff`, magenta `#bf5af2`, pink `#ff6fb5`, accent `#FA243C`). Those are the "vibrant" colours.

**The info categories in your FLAC report (the "extra details" source):** `liquid_all.py` lines 7769 to 8085, mainly `FIELDS` and `inspect_file()`.
- **Tags:** Title, Album, Artist, Album-Artist, Composer, Lyricist, Genre, Year, Label, Comment, Track number, Disc number.
- **Lyrics:** Embedded lyrics (synced or plain, char count), LRC file (name, size, encoding, synced, word-level, line count, first and last timestamp).
- **Audio:** Bit depth, Sample rate, Channels, Length, Bitrate, File size, Block size (min to max), MD5 (first 12 chars), Hi-res badge (bits >= 24 or rate > 48 kHz).
- **Cover:** image count, resolution, format, type, bit depth, size.
- **Path:** file path and folder.
- **Health:** missing or invalid tags, unreadable file.

---

## SHARED CONTEXT (paste at the top of every AI prompt)

```
PROJECT: "Liquid FLAC Player", a personal Android music player. Local library only
(no streaming, no accounts, no store release). Built entirely through GitHub Actions
(no Android Studio on my side). I download the APK from the Actions run.

HARD RULES
- FLAC only (16-bit, 24-bit and higher, any sample rate). No MP3/AAC/etc. support.
- Layout and UX follow Apple Music EXACTLY (see the attached screenshots): large titles, Library list
  (Playlists, Artists, Albums, Songs), Recently Added grid, mini player above the tab bar,
  full-screen Now Playing, 3-dot menu, Settings page (Theme, Motion, Lyrics, Increase Contrast, Diagnostics, About).
- LOCKED TAB BAR (4 tabs, floating pill like Apple Music): Home | Albums | Library | Search.
  No Radio, no New. Do not add tabs.
- LIQUID GLASS USAGE MAP ("not too much", like Apple: glass only on floating or interactive layers):
  YES, use my glass here:
    1. The tab bar: the gliding lens bubble that slides between tabs with spring + jelly (the hero effect).
    2. The mini player pill above the tab bar.
    3. Now Playing: the transport button cluster (jelly on press) and the scrubber thumb as a small lens.
    4. Bottom sheets (Song Info, Set Loop Media, 3-dot menu) and the search pill.
    5. Small round header buttons (back, 3-dot) and the quality badge chip ("FLAC 24-bit / 96 kHz").
    6. The Basic | Extra details switch in Song Info: a mini gliding bubble, same as the tab bar.
    7. Extra-details tiles (the .f tile style).
  NO, keep these flat black with no glass: list rows, album grid items and covers, lyrics page, settings rows,
  body text, anything that scrolls under other things.
- Motion: spring easing (--spring), jelly squash on press for glass elements only, and a Reduce Motion setting that
  turns the jelly/glide animation into plain fades.
- NOTIFICATION + DYNAMIC ISLAND / NOTCH (REQUIRED, one of the main features):
  While a song plays (and while paused) the app shows a media notification, and every phone UI that mirrors it
  (lock screen, status-bar chip, Samsung Now Bar, Xiaomi / Oppo / Vivo island-style pills, Pixel media controls)
  must show complete, correct song info:
    1. ALBUM COVER: embedded FLAC cover, else folder.jpg / cover.png, else a red-glass placeholder.
       Used as the notification large icon AND the MediaSession artwork, scaled to <= 512x512 and cached.
    2. SONG NAME as the title: the biggest, boldest line.
    3. Second line: "Artist, Album" (artist name, comma, album name).
    4. Buttons: Previous, Play/Pause, Next. Seek position comes from the MediaSession. Tapping opens Now Playing.
  Layout I want on an island-style pill: cover on one side, big bold song title next to it, "Artist, Album" under it.
  How: Media3 MediaSessionService + MediaSession with FULL MediaMetadata on every track change (title, artist,
  albumTitle, albumArtist, artwork, duration), foreground service type mediaPlayback, a custom notification provider
  that sets the second line to "Artist, Album", and the POST_NOTIFICATIONS permission asked on first launch.
  HONEST LIMIT: the phone maker draws the island/notch UI itself. The app can only supply standard MediaStyle
  notification data + perfect MediaSession metadata + artwork. Do exactly that, add a "Notification test" button in
  Settings > Diagnostics, and write per-brand notes (Samsung, Xiaomi/HyperOS, Oppo/OnePlus, Vivo, Pixel) in the plan.
  Check the CURRENT Android and Media3 docs; do not guess APIs.
- LYRICS (REQUIRED): my songs come with synced lyrics files. The app must READ and DISPLAY them.
  Sources, in order: 1) sidecar .lrc next to the FLAC with the same name (case-insensitive, NFC-normalised, like my
  script's lrc_for), 2) a fuzzy-matched .lrc in the same folder (cutoff 0.55, like my lrc_hints),
  3) embedded tags SYNCEDLYRICS / LYRICS / UNSYNCEDLYRICS.
  Parse: [mm:ss.xx] stamps (several per line allowed), the [offset:] tag, metadata tags [ar] [ti] [al] [by] [re] [ve]
  [length] [au], enhanced word-level <mm:ss.xx>, encodings UTF-8 / UTF-8 BOM / UTF-16 / GBK / Latin-1 (as my script detects).
  Display like Apple Music: full-screen lyrics view opened from Now Playing; current line big, bright and centred, other
  lines dim; auto-scroll; word-by-word highlight when the file is word-level; tap a line to seek; plain (unsynced)
  lyrics as scrollable text; a "No lyrics" state; a Lyrics size setting; search can find lyrics text.
- PLAYLISTS (REQUIRED): create, rename, delete; add / remove / reorder songs; add a song or album from the 3-dot menu
  ("Add to Playlist" sheet); play and shuffle a playlist; Library has a Playlists row; a playlist's cover is a 2x2 mosaic of
  its first 4 album covers (vibrant gradient when empty). Stored in the local database and kept across rescans
  (match by path, fall back to tags).
- LOOP + SMART QUEUE (REQUIRED):
  LOOP MEDIA (already above): per-song GIF / MP4 / image that loops behind Now Playing. Not the same as the next item.
  REPEAT / LOOP PLAYBACK: the Apple-style repeat button on Now Playing cycles Off -> Repeat All -> Repeat One, shows its
  state clearly, and is remembered after restart. Optional extra: A-B loop (tap A and B on the scrubber, loop that part).
  QUEUE ("Up Next", opened from Now Playing like Apple Music): Now Playing + Up Next list; "Play Next" and "Add to Queue"
  in the 3-dot menu of songs, albums and playlists; drag to reorder, swipe to remove, Clear, Save queue as playlist;
  the queue and its position survive closing the app; the queue also drives the notification and lock-screen Next/Previous.
  SMART QUEUE: (1) Smart shuffle: no same artist or album back-to-back when avoidable. (2) Autoplay fill: when the queue is
  about to run out (toggle in the queue view and in Settings), the app adds similar songs from MY LOCAL library,
  ranked by same artist, same album artist, same genre, nearby year, same hi-res tier, skipping recently played; they sit
  under an "Autoplaying" divider and can be removed. No internet, no accounts.
- Visual style is NOT Apple's liquid glass. It is MY liquid glass, defined in the attached files
  liquid_glass.css, liquid_glass_lens.js, liquid_glass_glidebar.js, liquid_glass_overrides.css.
  Reuse those tokens and effects as-is. Do NOT open or search liquid_all.py.
- COLOR SYSTEM: RED is the main colour: Apple Music red #FA243C on pure black (active tab, play/pause, progress,
  selection, icons). Bright vibrant colours (the palette tokens already in liquid_glass.css: green, orange, yellow,
  cyan/blue, magenta, pink) are allowed in SMALL secondary spots only: quality badges, Extra-details group headers,
  warning chips, genre chips, playlist cover gradients, a soft cover-colour glow on Now Playing. Rule of thumb: red is at
  least ~70% of all coloured pixels.
  APPEARANCE OPTION (required): Settings > Appearance > Color style = "Vibrant" (default) or "Black & Red".
  "Black & Red" = pure black + black liquid glass (clear glass, white rim light) + red #FA243C as the ONLY colour.
  Every vibrant token remaps to white/grey or red, and the cover-colour glow is off. Implement it with CSS variables:
  every coloured element uses a token (never a hard-coded hex), and html[data-style="blackred"] overrides the tokens.
  Saved setting, applies instantly, no restart.
- Features: browse by Artist / Album / Song / Genre / Folder; search; play/pause/seek/next/prev/shuffle/repeat;
  background playback with lock-screen controls AND the media notification / island info above; synced lyrics (see LYRICS block); playlists (see PLAYLISTS block); repeat/loop modes and a smart queue (see QUEUE block); per-song CUSTOM LOOP MEDIA
  (a GIF, MP4 or image I attach to a song; it loops silently in the Now Playing background; this is separate
  from album cover); Song Info with a basic view and an "Extra details" view (see data spec).
- Budget-friendly: keep every response SHORT. Output files/diffs only, no long explanations.
  Reuse existing code. Do not rewrite files that already work. Ask at most 1 question.
```

---

## PLANNING AI 1: UI/UX spec

```
[paste SHARED CONTEXT, attach screenshots + the 4 glass files]

You are a mobile UI designer. Produce UI_SPEC.md (max ~600 lines) describing every screen so a developer can build
it without seeing the screenshots again.

1. Study my screenshots (Apple Music Android app: Home, Library, Search, Settings, tab bar; plus the iOS Library
   screen) and describe the exact layout: spacing, large titles, row anatomy, red icon style, Recently Added
   2-column grid, mini player, tab bar.
2. Map my glass system onto each component: which surface uses .glass/.card/.f, which uses the gliding lens bar,
   what the mini player looks like as glass, how the lens bubble behaves on the LOCKED 4-tab bar
   (Home, Albums, Library, Search; choose the icons, and say whether Search stays inside the pill or is a separate
   round glass button like newer Apple Music; follow my screenshots). Follow the LIQUID GLASS USAGE MAP exactly.
3. Screens to specify (ASCII wireframe + component list + states + animations):
   Home (recently added, albums), Library root, Artists, Artist detail, Albums grid, Album detail, Songs list,
   Genres, Folders, Search (with filters: artist/album/song/lyrics text), Now Playing (big art, scrubber, quality badge
   "FLAC 24-bit / 96 kHz", queue, lyrics view, loop-media background layer), Mini player, Song Info sheet
   (Basic + "Extra details" toggle), Set Loop Media sheet, Playlists list, Playlist detail, Add to Playlist sheet,
   Create/Rename playlist sheet, Lyrics view (synced, word-level, plain, empty), Settings (incl. Appearance > Color style),
   Queue / Up Next view (with Autoplaying divider, drag handles, Clear, Save as playlist), repeat + shuffle button
   states (Off / All / One), Play Next / Add to Queue menu items, Empty/Scanning states.
3b. Notification mirror: design Now Playing and the mini player so they match the notification (cover, big bold song
   title, "Artist, Album" line). Design the red-glass placeholder cover, the first-launch notification-permission
   sheet, and the Settings > Diagnostics > Notification test screen.
3c. Colour system: make a table giving EVERY component its colour in BOTH modes (Vibrant and Black & Red). Red stays
   dominant (>= ~70%); vibrant colours only in small spots. Show how Now Playing, Song Info, Library and Lyrics look
   in each mode. Define the colour tokens (from liquid_glass.css) and the remap for html[data-style="blackred"].
4. Define tokens: colors, type scale, radii, spacing, motion (reuse --spring), and an "Increase Contrast" variant
   plus a "Reduce Motion" variant.
5. Flag anything in my glass CSS that is expensive on phones (heavy backdrop-filter, SVG displacement) and give a
   fallback plan.
Output only the file.
```

## PLANNING AI 2: Architecture and GitHub build plan

```
[paste SHARED CONTEXT, attach the 4 glass files]

You are a senior Android + web engineer. Produce ARCH.md (max ~400 lines). Constraints: no Android Studio, cheap AI
builders, one person maintaining it.

RECOMMENDED STACK (challenge it only if you have a concrete reason):
- Capacitor (Android) hosting a Vite + vanilla TypeScript (or Preact) web UI, so my glass CSS/JS is reused unchanged.
- ONE small custom Capacitor plugin in Kotlin, "LiquidNative", because a WebView alone cannot do these:
  1) Media3/ExoPlayer playback service with MediaSession + notification + lock-screen controls + audio focus,
     background playback, gapless, 24-bit FLAC (request float/high-res PCM output where the device allows).
  2) Folder access via Storage Access Framework (user picks the music folder once; persist URI permission),
     recursive scan returning file URIs and mtime.
  3) Tag reading: either in Kotlin (jaudiotagger-android or Media3 metadata) or in JS (music-metadata);
     pick one and justify. Needs: all Vorbis comments, STREAMINFO (bits, rate, channels, samples, MD5, block sizes),
     PICTURE blocks, plus sidecar .lrc lookup.
- Storage: SQLite (via @capacitor-community/sqlite) or IndexedDB for the library index + per-song loop-media mapping.
- Build: GitHub Actions workflow builds a DEBUG APK (debug-signed, installable without a keystore) and uploads it
  as an artifact. Cache Gradle + npm. Provide the full .github/workflows/android.yml.

DELIVER:
1. Repo tree with every file path.
2. Data flow: scan -> index -> UI -> play -> Now Playing -> Song Info.
3. The plugin API (method names, params, return JSON, events like onTrackChanged/onProgress/onState).
4. Hi-res audio honesty section: what Android actually outputs (resampling, 24-bit to float), when bit-perfect is
   possible (USB DAC / Android 14+), and what the app should display so I am not misled.
5. Permission list (READ_MEDIA_AUDIO, foreground service media playback, notifications) and Android version targets.
6. Step-by-step "first build" instructions for a non-developer using only the GitHub website + phone.
7. Risk list: top 5 things likely to break in a WebView (backdrop-filter, SVG filter as backdrop, autoplay, big lists)
   with mitigations.
8. NOTIFICATION + ISLAND section (this is a main feature, be precise): MediaSessionService setup, the custom
   notification provider (title = song, second line = "Artist, Album", large icon = cover), the MediaMetadata fields
   set on every track change, artwork pipeline (extract embedded cover -> decode -> scale <= 512 px -> cache ->
   bitmap/artworkData for the session), update timing (track change, play/pause, seek), POST_NOTIFICATIONS flow on
   Android 13+, foreground-service type, channel setup, and a Notification test method. Then a per-brand table
   (Samsung Now Bar, Xiaomi HyperOS island, Oppo/OnePlus Fluid Cloud, Vivo, Pixel): what each reads, what is not
   controllable by the app. Verify against current docs and say what you could not verify.
   Ask me for my phone model + Android version once (one question) before finalising this section.
9. LYRICS + PLAYLISTS + APPEARANCE: where the LRC parser lives (Kotlin or TypeScript; justify), how synced lyrics are
   timed against the player position (event rate, drift handling), how lyrics text is searched, how playlists are stored
   and exposed (API methods + events), and how Color style is implemented (CSS variables, data-style attribute,
   persistence, native side such as the notification placeholder cover).
10. QUEUE + REPEAT: whether the queue lives in the native Media3 playlist (recommended) with the web UI mirroring it, the
   API (playNext, addToQueue, moveItem, removeItem, clearQueue, getQueue, setRepeat, setShuffle, setAutoplay) and events
   (onQueueChanged, onRepeatChanged), queue persistence across app/service restarts, and where the smart-fill logic runs
   (Kotlin or TypeScript; justify) so it still works with the screen off.
Output only the file.
```

## PLANNING AI 3: Data model and Song Info spec

```
[paste SHARED CONTEXT, attach liquid_ref files. You MAY open liquid_all.py lines 7769-8085 only]

You are a data/metadata engineer. Produce DATA_SPEC.md (max ~400 lines):

1. SQLite schema: tracks, albums, artists, genres, folders, lyrics_cache, loop_media (track_id or album_id ->
   uri, type gif|mp4|image, fit, start/end, mute flag), playlists, play_history. Include indexes for fast search.
2. The metadata extraction contract. Per file we need every field below. Define JSON shape + fallbacks:
   TAGS: title, album, artist, albumartist, composer, lyricist, genre, date/year (validate 1900+), label/organization/
         publisher, comment, tracknumber, discnumber (+ totals)
   AUDIO: bits_per_sample, sample_rate, channels, total_samples, duration, bitrate (computed from size/duration when
          missing), file_size, min/max blocksize, md5 (first 12 hex), hires flag = bits>=24 or rate>48000
   LYRICS: embedded (plain|synced + char count), sidecar .lrc (name, size, encoding, synced, enhanced/word-level,
           line count, first/last timestamp)
   COVER: count, best front-cover resolution, format, type, depth, byte size; folder.jpg/cover.png fallback
   PATH: relative path, folder
   HEALTH: missing tags list, invalid year, unreadable file, low-res cover (<3000 px area in my script)
3. SONG INFO SHEET CONTENT:
   - BASIC (Apple Music style): artwork, title, artist, album, genre, year, track/disc, duration, quality badge,
     "Lossless / Hi-Res Lossless" line, plays, added date.
   - EXTRA DETAILS (toggle button): grouped cards matching my FLAC report: Tags, Credits, Lyrics, Audio, Cover, File, Health.
     For each group list the rows in display order, with formatting rules (e.g. "96 kHz", "24-bit", "1,411 kbps",
     "Stereo", "2:57", "MD5 a1b2c3d4e5f6"), what to show for missing values (muted "Missing" chip), and
     which rows get a warning color.
4. Search spec: which fields are searchable, ranking, diacritic/case folding (NFC + casefold like my script).
5. Incremental rescan rules (mtime+size), deleted files, duplicate albums, multi-artist splitting, "Various Artists".
6. Custom loop media rules: formats (GIF, MP4/H.264, WebP, PNG/JPG), where files are copied (app-private folder vs
   referenced URI), max sizes, what happens when a track has no media (fall back to album loop, then to cover art blur).
7. NOTIFICATION DATA: exactly which fields feed the notification and MediaSession (title, artist, albumTitle,
   albumArtist, artwork, duration, track number), how the second line "Artist, Album" is built (use album artist
   when artist is empty, handle multiple artists, handle missing album), cover selection order (front cover > largest
   embedded > folder.jpg/cover.png > placeholder), thumbnail size/format/cache location, and cache invalidation.
8. LYRICS DATA: the parse contract, e.g. {source, encoding, synced, enhanced, offset_ms, meta{ar,ti,al,...},
   lines[{t_ms, text, words[{t_ms, text}]}]}; source priority + fuzzy-match rule; caching of parsed lyrics; a text index
   for lyrics search; error handling (bad encoding, no timestamps, huge files; my script reads at most 2 MB).
   Reference: liquid_all.py lines 7842-7880 and 8083.
9. PLAYLIST DATA: tables playlists(id, name, created, updated) and playlist_tracks(playlist_id, position, track_id,
   fallback_path); operations and ordering rules; duplicates allowed or not; what happens when a file is renamed or
   deleted; cover mosaic rule (first 4 distinct album covers).
10. QUEUE + SMART QUEUE DATA: tables queue_items(position, track_id, source: user|autoplay) and queue_state(current_index,
   position_ms, repeat_mode, shuffle, autoplay); play_history(track_id, played_at). The smart-fill scoring rule with weights
   (same artist, same album artist, same genre, year distance, hi-res tier), the "recently played" window, how many songs
   to add and when (e.g. when 2 songs remain), the smart-shuffle rule, and edge cases (tiny library, one-album library).
Output only the file.
```

---

## BUILD AI A: Scaffold + GitHub Actions

```
[SHARED CONTEXT + PLAN.md]

Create the complete repo skeleton so GitHub Actions produces an installable debug APK on every push, even before
features exist.
- Capacitor Android project (appId com.liquid.flacplayer, name "Liquid FLAC"), Vite web app that shows the black
  screen + red accent + the glass CSS from liquid_glass.css, and a bottom bar using liquid_glass_glidebar.js.
- Commit the android/ folder (do NOT rely on running "cap add android" on my phone).
- .github/workflows/android.yml: checkout -> setup-node 20 -> setup-java 17 -> npm ci -> npm run build ->
  npx cap sync android -> ./gradlew assembleDebug -> upload-artifact app-debug.apk.
- Colour tokens: all colours as CSS variables (from liquid_glass.css), plus html[data-style="blackred"] overrides and a
  working Settings > Appearance > Color style switch (Vibrant | Black & Red), saved on the device. Every later screen
  uses tokens only.
- A README with the 6 clicks I do on GitHub to get the APK.
Give me a file list with full contents. If the build can fail in a known way, state the fix in one line.
```

## BUILD AI B: Library scan + playback (native)

```
[SHARED CONTEXT + PLAN.md + ARCH.md + DATA_SPEC.md]

Implement the Kotlin "LiquidNative" Capacitor plugin and its TypeScript wrapper:
pickFolder(), scan(), readTags(uri), play(queue,index), pause(), seek(ms), next(), prev(), setRepeat(), setShuffle(),
events (state, position, track change). Media3 ExoPlayer in a foreground MediaSessionService with lock-screen controls.
Must play 16/24-bit FLAC; expose the real decoded format/output info in an event so the UI can show it.
Also implement the NOTIFICATION + ISLAND feature exactly as in the shared context and ARCH.md section 8: full
MediaMetadata on every track change, cover artwork (<= 512 px, cached), custom notification provider with the
second line "Artist, Album", Previous / Play-Pause / Next, POST_NOTIFICATIONS request, and a notificationTest() method.
Also: getLyrics(trackId) returning the parsed lyrics JSON from DATA_SPEC.md (sidecar .lrc, fuzzy match, embedded tags,
all encodings, word-level), and the playlist data layer (create / rename / delete / add / remove / reorder / list).
Also the queue API (playNext, addToQueue, moveItem, removeItem, clearQueue, getQueue, saveQueueAsPlaylist), repeat modes
Off / All / One, smart shuffle, Autoplay fill from the local library per DATA_SPEC.md, and queue persistence across restarts.
Write the index into SQLite per DATA_SPEC.md; incremental rescan by mtime+size.
Output changed files only. Keep the workflow green.
```

## BUILD AI C: UI screens

```
[SHARED CONTEXT + PLAN.md + UI_SPEC.md + glass files]

Build every screen in UI_SPEC.md on top of the existing scaffold and the plugin API: Home, Library, Artists, Albums,
Songs, Genres, Folders, Playlists (list, detail, Add to Playlist sheet, create / rename / delete, reorder), Search (also
finds lyrics text), Now Playing, Mini player, Settings with Appearance > Color style (Vibrant | Black & Red). Also the Queue / Up Next view (Autoplaying divider, drag to reorder, swipe to remove, Clear, Save as playlist, Autoplay toggle), the Off / All / One repeat button, the shuffle button, and Play Next / Add to Queue in every 3-dot menu.
Now Playing and the mini player mirror the notification (cover, big bold song title, "Artist, Album" line). Add the first-launch notification-permission sheet.
Rules: reuse tokens from liquid_glass.css; red accent #FA243C; virtualize long lists; honor Reduce Motion and Increase
Contrast settings; colours only through tokens; check every screen in BOTH colour styles; no new heavy dependencies.
Output changed files only.
```

## BUILD AI D: Song Info, loop media, lyrics, polish

```
[SHARED CONTEXT + PLAN.md + DATA_SPEC.md + UI_SPEC.md + glass files]

1. Song Info sheet: Basic view + "Extra details" toggle with the grouped cards (Tags, Credits, Lyrics, Audio, Cover,
   File, Health), glass tiles like the .f/.card styles, missing-value chips.
2. Set Loop Media: pick GIF/MP4/image via the system picker, copy into app storage, save mapping, render as a silent
   looping background layer on Now Playing (video muted+loop+playsinline; GIF/image with object-fit cover), with a
   dark scrim so text stays readable; fallback order track -> album -> blurred cover.
3. Lyrics view per the LYRICS block: full-screen, current line big and bright, others dim, auto-scroll in sync with the
   player position, word-by-word highlight for word-level files, tap a line to seek, plain-text fallback, "No lyrics" state,
   Lyrics size setting. Test with .lrc files in UTF-8, UTF-8 BOM and UTF-16.
3b. Optional: A-B loop on Now Playing (tap A, tap B on the scrubber, it loops between them, tap again to clear).
4. Settings: Theme, Motion, Lyrics size, Increase Contrast, Diagnostics (rescan, library stats, log export, Notification test button that calls notificationTest()).
Output changed files only.
```

---

## Tips to keep it cheap
- Start every build AI in a fresh chat with: shared context + PLAN.md + only the files that AI needs.
- Ask for diffs or changed files only.
- If a GitHub Actions build fails, paste only the last 40 lines of the log plus the failing file.
- Test the lens refraction on your phone early. If it looks wrong, switch to the CSS-only glass fallback (the glass looks the same, only the edge bending is lost).
