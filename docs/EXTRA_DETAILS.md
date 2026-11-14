# READ THIS FIRST: CONFIRMED BY THE USER'S SCREENSHOTS
> **USER DECISION (overrides every colour remark in this file): NO per-label colours.** All Extra-details tiles look the same: **black liquid glass** (the app's glass kit: `--glass-fill` black, `--spec` rim light, `--sheen`) with a **red accent** (`--accent`, via the variable) for section headings and small highlights, like Apple Music. Label in `--text-2`, value in `--text` (white, bold). Same in Vibrant and Black & Red. Ignore the colour table and the "own colour" lines below. Everything else (tile order, sections, wording, values) still applies.
> **SUPERSEDED (docs/HANDOFF.md locked rules, removed in v52): every "Hi-res" tile, chip, filter, switch and count in this file is OBSOLETE. NEVER add a Hi-res tag / badge / info tile / filter anywhere.**

The user sent 4 phone screenshots of the real report with one song expanded. (The screenshot files were removed from the project in v148 to keep it small.) **When the user taps "Extra details" on a song in the app, it must show exactly this panel.** Where Part 1 below differs from this block, THIS BLOCK WINS.

## Exact layout, top to bottom (as on screen)
1. **Big cover** (the song's best cover, full width, rounded, shows the explicit "Parental Advisory" badge if the artwork has it). Tap = zoom.
2. **Section "TAGS"** (small spaced uppercase heading in the section colour). ONE grid of tiles, in this order:
   Title, Album, Artist, Album-Artist, Composer, Lyricist, Genre, Year, Label, Comment, Track number, Disc number, **LRC file**, **Cover art**, **Cover format**, **Cover size**
   (plus **Embedded lyrics** right before "LRC file" when the song has embedded lyrics). So the cover and LRC-file tiles live INSIDE the Tags section, not in their own section.
   Example values seen: Title `Alone Again`, Album `After Hours`, Artist `The Weeknd`, Album-Artist `The Weeknd`, Composer (long, wraps to 3 lines), Lyricist (wraps to 2 lines), Genre `Synth-Pop`, Year `2020`, Label `Republic`, Comment `Ai Hoshino , Hikaru Kamiki`, Track number `1/17` (shown raw, as stored), Disc number `1`, LRC file `Alone Again - The Weeknd - 24bit-44.1kHz.lrc` (wraps), Cover art `1 image(s)`, Cover format `JPEG · Cover (front) · 24-bit`, Cover size `14.0 MB`.
3. **Section "LYRICS FILE"**, tiles in this order: LRC sync (`Synced`), LRC lines (`27`), LRC encoding (`UTF-8`), LRC size (`1.1 KB`), LRC timestamps (`0:12 to 4:00`). (If the song has no .lrc: Expected LRC + Similar LRC instead.)
4. **Section "AUDIO"**, tiles in this order: Bit depth (`24-bit`), Sample rate (`44.1 kHz`), Channels (`Stereo`), Length (`4:10`), Bitrate (`1561 kbps`), File size (`60.6 MB`), Block size (`4608–4608`), MD5 (`4aa8ed25920c`, 12 chars), Hi-res (`Yes`) [SUPERSEDED: the Hi-res tile was removed in v52, do NOT add it; see docs/HANDOFF.md locked rules].
5. **Section "PATH"**: the relative file path in a pink/violet line, e.g. `Albums/After Hours/Alone Again - The Weeknd - 24bit-44.1kHz.flac`.
Collapsed row chips seen at the very bottom of screenshot 3: `2020` (blue) and `Hi-res 24/44.1 kHz` [SUPERSEDED: Hi-res chip removed, do NOT add].

## How a tile looks
Rounded outline box (glass rim, thin light border, black fill), full width, one tile per row on the phone. Small **label** on top in the tile's colour (lighter), the **value** under it, bigger and bold, in the same colour. Long values wrap to 2 or 3 lines. Missing/invalid values show the word "missing" in a red/orange tile. **Every label has its own colour** (see table). Section headings are small uppercase letter-spaced text in their own colour (TAGS yellow-green, LYRICS FILE magenta, AUDIO violet). Headings stick under the top bar while scrolling. An expanded song has a green left edge when it has no problems (red when it has problems).

## Other things visible in the screenshots (report UI, see Part 2)
- Floating bottom bar (glass pills): **All 449 · Fix 0 · Perfect 449 · No LRC 0 · Hi-res 449** [SUPERSEDED: the Hi-res filter was removed, do NOT add] (counts on a small badge) and a round **filters** button on the right. These are the status filters.
- Floating glass **search** pill above it: "Search title, artist, album...".
- A theme button at the top right labelled **"Black"** (report colour theme). The app already has Color style in Settings; do not copy this button.
- A round **back-to-top** arrow button at the bottom right.

## Exact colour of every label (from `COLOR_SEEDS` in `liquid_all.py`)
Use these for the tile label/value colours in Vibrant mode. In Black & Red mode use white with red accents (locked rule: no hard-coded hex outside `tokens.css`, so put these in `tokens.css` as variables such as `--lbl-title`).
| Label | Colour |
|---|---|
| Title | `#ffffff` |
| Album | `#5fffff` |
| Artist | `#ff87af` |
| Album-Artist | `#ff5fff` |
| Composer | `#ff8700` |
| Lyricist | `#ffff5f` |
| Genre | `#5fff5f` |
| Year | `#5f87ff` |
| Label | `#8a8a8a` |
| Unreadable file | `#ff5f5f` |

*(The script derives the rest of the labels, e.g. Cover resolution lime, Block size bright green, from `make_colors()`. If a label has no colour above, copy the look from the screenshots.)*

---
# PART 1 (original list from the code; the order of sections above overrides it)
# Extra details (Song Info > "Extra details"): exact list from `liquid_all.py`
Source: the embedded `liquid_flac_report` script (in `liquid_all.py`, block `#@@BEGIN liquid_flac_report`, functions `FIELDS`, `inspect_file`, `analyze_lrc`, `pic_details`, and the JS `details()` that draws the tiles).
**NOTE v51: the Library health screen (T13 / Part 2) was REMOVED by the user; ignore every Part 2 item that mentions it.**

**This is a spec for ticket T11 (feature IDs F2 to F8). T11 is DONE (Song Info > Extra details); Part 2 is only partly built as T13 Library health: what is still missing is listed in HANDOFF.md (L2, L3).** The Basic view (artwork, title, artist, album, genre, year, track/disc, duration) stays as is; "Extra details" shows ALL tiles below, grouped in 5 sections, each tile = small label + bold value. A tile whose value is missing/invalid is shown flagged (the report shows the word "missing").

## 1. Section "Tags" (16 tiles, FLAC Vorbis comments, key names are case-insensitive, first non-empty key wins)
| Tile | Tag keys read | Notes |
|---|---|---|
| Title | title | |
| Album | album | |
| Artist | artist | several values joined with ", " |
| Album-Artist | albumartist, album artist, album_artist | |
| Composer | composer | |
| Lyricist | lyricist | |
| Genre | genre | |
| Year | date, year | valid = YYYY, YYYY-MM, YYYY-MM-DD (optional time). Flag if not that format, year < 1900 or > next year, month not 1-12, or day invalid for that month. Shows the first valid key |
| Label | label, organization, publisher | |
| Comment | comment | the report flags it unless it equals a fixed expected text (user-specific check, make this optional) |
| Track number | tracknumber, track | flag if empty or 0 ("3/12" is fine) |
| Disc number | discnumber, disc, disk | flag if empty or 0 |
Clean every value first: strip zero-width chars, BOM, NBSP, NUL, and trim spaces.

## 2. Lyrics (Embedded lyrics and LRC file are shown in the TAGS grid, the LRC detail tiles in section LYRICS FILE)
| Tile | What it shows |
|---|---|
| Embedded lyrics | only if present. Tag `lyrics` / `unsyncedlyrics` / `unsynced_lyrics` = "Plain" or "Synced" (Synced if a `[mm:ss.xx]` stamp appears in the first 2000 chars) + "N chars"; tag `syncedlyrics` / `synced_lyrics` / `lyrics_synced` = "Synced" + chars |
| LRC file | file name of the `.lrc` with the same name as the FLAC (extension any case; match ignores case and accents). Flagged if none |
If an LRC exists (reads at most the first 2 MB):
| Tile | Value |
|---|---|
| LRC sync | Synced / Not synced (any line has a `[mm:ss.xx]` stamp) |
| LRC lines | count of non-empty lines, not counting the metadata tags `[ar: ti: al: by: offset: re: ve: length: au:]` |
| LRC encoding | UTF-8 BOM / UTF-16 / UTF-8 / GBK / Latin-1 (detected in that order) |
| LRC size | KB / MB |
| LRC timestamps | first stamp "to" last stamp, e.g. `0:12 to 3:41`, or "none" |
If NO LRC exists:
| Tile | Value |
|---|---|
| Expected LRC | the name it should have (song file name + `.lrc`) |
| Similar LRC | a loose `.lrc` in the same folder with a close name (fuzzy match, ratio >= 0.55) |
Folder level (library health, not per song): **Orphan LRC** = `.lrc` files whose song does not exist.

## 3. Cover (big artwork on top; the 3 Cover tiles (Cover art, Cover format, Cover size) are in the TAGS grid)
| Tile | Value |
|---|---|
| Cover art | "N image(s)" (flagged if 0) |
| Cover format | `JPEG / PNG / GIF / WEBP` + picture type + colour depth, e.g. `JPEG · Cover (front) · 24-bit` |
| Cover size | file size of that picture |
Picture types 0 to 20: Other, Icon, Other icon, Cover (front), Cover (back), Leaflet, Media, Lead artist, Artist, Conductor, Band, Composer, Lyricist, Recording location, During recording, During performance, Video capture, Fish, Illustration, Band logo, Publisher logo.
Fallback: if there is no embedded picture, use a folder image named cover / folder / front / album / albumart (.jpg .jpeg .png) and show type "Folder image: <name>".

## 4. Section "Audio" (9 tiles, from the FLAC STREAMINFO block)
| Tile | Value |
|---|---|
| Bit depth | `16-bit`, `24-bit` |
| Sample rate | `44.1 kHz`, `48 kHz`, `96 kHz`, `192 kHz` (whole numbers without decimals) |
| Channels | Mono / Stereo / `N ch` |
| Length | `m:ss` (total samples / sample rate) |
| Bitrate | `NNN kbps` (file size x 8 / length if not stored) |
| File size | B / KB / MB |
| Block size | `min–max` (e.g. `4096–4096`) |
| MD5 | first 12 hex chars of the STREAMINFO MD5 signature, or "n/a" |
| Hi-res (SUPERSEDED: removed in v52, do NOT add) | Yes if bit depth >= 24 OR sample rate > 48 kHz, else No |

## 5. Section "Path"
File path relative to the music folder (also shows the folder). Health: "Unreadable file" + the error text when the FLAC cannot be parsed. The report also lists everything flagged as a "missing" list per song (tiles above marked missing).

## Colours and look (from the report)
Every tile has its own accent colour per label (`COLOR_KEYS` / `COLOR_SEEDS` in the script), each section has a colour, the song has a big cover at the top, tiles flow in a grid, and the whole panel is the glass style. In this app keep colours from `tokens.css` variables only (Black & Red mode: white tiles, red accents).

## Where this plugs into the app (for the next AI)
- Native today: `LiquidNative.readFlac` already parses STREAMINFO (sample rate, bits, total samples) and keeps only a few Vorbis keys, and it SKIPS the PICTURE block (type 6). Extend it to also return: all keys above (composer, lyricist, label, comment, albumartist variants, lyrics keys), STREAMINFO min/max block size (bytes 0-3) and MD5 (bytes 18-33), file size, and for PICTURE blocks: type, mime, width, height, depth, data length (and save the best picture to `filesDir` for T-cover work).
- LRC: during the SAF walk, remember the `.lrc` files per folder and match by name. Parse in Java or JS (same rules as section 2).
- UI: a Song Info sheet from the 3-dot menu (T7) with Basic view + an "Extra details" toggle (T11).

---
# PART 2: everything else the report shows (found after the user said "it shows much more")
Status: **found in the code, NOT yet confirmed by the user which of these they want in the app.** A screenshot of the report may follow; if it is in the project (`docs/`), compare it with this list and add anything missing. Source: the JS/HTML at the bottom of the `liquid_flac_report` block in `liquid_all.py`.

## A. Song row (collapsed line in the list)
Cover thumbnail (tap = zoom lightbox), track label `disc-track` (e.g. `2-05`, `--` if none), title (file name if no title), second line `Artist · Album`, red "Could not read file: <error>" if unreadable. **Chips under it:** Year, `Hi-res 24/96 kHz` (SUPERSEDED: removed, do NOT add) (or `16-bit 44.1 kHz`), Length, `LRC` or `LRC (plain)`, Cover resolution, then up to 4 red problem chips + `+N more`. Tap the row = open the detail panel (Part 1). Row border is red when the song has problems, green when it is complete. If a cover is missing it says "no cover" or "no preview".

## B. Summary bar (top of the report)
Folder + scan date, then counts: **songs, albums, artists, hi-res (SUPERSEDED: removed, do NOT add), with LRC, need fixing.** Also a "Run stats" card (scan verdict and run numbers: speed/time, phone battery/temperature notes).

## C. Problem chips (tap = filter)
One chip per problem type with a count, e.g. `Year 12`, `Cover < 3000px 4`, `LRC file 30`, `Comment 8`, `Track number 2`, `Unreadable file 1`. Shows "Everything checks out. Nothing is missing." when clean. Problem types = the missing/invalid tile labels from Part 1.

## D. Sample-rate chips (tap = filter)
One chip per sample rate with a count (`44.1 kHz 120`, `96 kHz 40`, `192 kHz 6`, `(unknown)`).

## E. Search
Search box "Search title, artist, album..." also matches: file name, folder, LRC name (or expected LRC name), genre, year and the problem names.

## F. Status filter
All / Needs fixing / OK (complete) / No LRC / Hi-res (SUPERSEDED: Hi-res filter removed, do NOT add).

## G. Filter panel (6 controls + reset)
Problem type, Album, Artist, Year, Sample rate, "Hi-res only" switch (SUPERSEDED: removed, do NOT add), "Reset all".

## H. Sort songs by (11 options, each with an ascending/descending button and its own wording)
Track number (1 to 9 / 9 to 1), File name, Title, Artist, Album (A to Z / Z to A), Songs per album (fewest/most first), Year (oldest/newest first), Number of problems (fewest/most first), Length (shortest/longest), File size (smallest/largest), Sample rate (lowest/highest kHz first).
Track sort = disc, then track number, then path.

## I. Group by (8 options)
Album, Artist, Album artist, Folder, Genre, Year, Sample rate, No grouping. Groups with no value are named `(no album)`, `(no artist)`, `(no album artist)`, `(top folder)`, `(no genre)`, `(no year)`, `(invalid year)`, `(unknown)` and sorted last.
**Group header:** best cover of the group (largest), group name, `N songs · Artist(s)` (up to 2 names, album grouping), a chip `N to fix` (red) or `all good` (green), collapse arrow. Buttons: Collapse all / Expand all.

## J. Other
- Orphan LRC list: "LRC files with no matching song (N)", collapsible.
- Shows only the first 150 songs at a time (more on demand).
- Back-to-top button, cover zoom lightbox (also from the group header).
- Colour per label (every tile and chip has its own colour from `COLOR_KEYS` / `COLOR_SEEDS`).

## How this relates to the app tickets
Most of Part 2 is library browsing/health, not Song Info. Suggested mapping (the user decides): A = song rows (T5/T7), E-I = search/filter/sort/group (T5), B/C/D/J = a "Library health" screen (new ticket T13). Do not build anything from Part 2 until the user confirms.
