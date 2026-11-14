# Liquid Dark: feature checklist (single source of truth)

> Note (BUG-262): rows that say "phone test pending" were never confirmed on a real phone by the owner. They are left as they are on purpose; only the owner can confirm them.


"Source" tells you where each item came from:
- **You** = you asked for it directly.
- **Screenshot** = visible in your Apple Music screenshots.
- **Py file** = from your `liquid_all.py` FLAC report.
- **Suggested** = my addition. Delete it if you don't want it.

Every AI must treat the **You** items as locked. Anything marked Suggested can be cut.

## A. Product rules
| ID | Requirement | Source |
|---|---|---|
| A1 | Personal, local-library app only. No streaming, no accounts, no store release | You |
| A2 | **FLAC first**: 16-bit, 24-bit and higher, any sample rate. MP3 and AAC / M4A also play (added later). No other formats | You |
| A3 | Built with GitHub Actions. No Android Studio. Download the APK from GitHub | You |
| A4 | Prompts written so cheap or free AI accounts can do each step. Several AIs, several chats | You |

## B. Look and feel
**LATEST USER DECISION (overrides B6, B10, B11 where they conflict): the whole app is black liquid glass, clear and transparent, with red as the only accent, like Apple Music. See `HANDOFF.md` section 5 and ticket T4b.**

| ID | Requirement | Source |
|---|---|---|
| B1 | Layout and UX follow Apple Music as exactly as possible | You |
| B2 | Red is the main colour (Apple Music red, `#FA243C`) on pure black | You |
| B3 | Visual glass is YOUR liquid glass from `liquid_all.py` (clear glass, rim light, gliding lens bubble), not Apple's | You |
| B4 | Bottom bar = floating pill with 4 tabs: **Home, Albums, Library, Search** | You |
| B4b | **Lyrics colour**: built-in colour wheel (drag the circle), brightness slider, live preview and a Hex code box (3 or 6 digits, with or without #). No preset colours, no system colour dialog. A picked colour is used exactly. "Back to Auto" = the cover's own average colour of its main colour area, no boost | You |
| B5 | Sliding liquid bubble on the tab bar, with the flowing / moving glass feel. Its size is the **Glass bar size** slider (Display options and the Animation screen, one setting) | You |
| B6 | Liquid glass used in a few places only, not everywhere (see usage map in `docs/HANDOFF.md`) | You |
| B7 | Large titles, round header buttons (back, 3-dot), Recently Added 2-column grid, mini player above the tab bar | Screenshot |
| B8 | Settings page: Theme (Dark), Motion, Lyrics, Increase Contrast | Screenshot |
| B9 | Reduce Motion option (turns glide/jelly into plain fades) | Suggested |
| B10 | Bright vibrant colours in small secondary spots (quality badges, group headers, chips, playlist gradients, optional cover-colour glow). Red stays dominant | You |
| B11 | Appearance option: **Color style = Black & Red (default) or Vibrant** | You |
| B12 | Black & Red = pure black + black liquid glass + red as the only colour | You |

## C. Library and browsing
| ID | Requirement | Source |
|---|---|---|
| C1 | Browse by Artist, Album, Song | You |
| C2 | Search across artists, albums, songs and lyrics (the Apple Music search bar says "Artists, Songs, Lyrics and more") | You / Screenshot |
| C3 | Library list: Playlists, Artists, Albums, Songs (Genres and Folders as extra rows) | Screenshot / Suggested |
| C4 | Folder-based local scan, remembers your music folder, rescans only what changed | Suggested |

## D. Playback
| ID | Requirement | Source |
|---|---|---|
| D1 | Play, pause, seek, next, previous, shuffle, repeat | Suggested (standard) |
| D2 | Keeps playing in the background and with the screen off | Suggested (standard) |
| D3 | Shows the real format while playing, e.g. "FLAC 24-bit / 96 kHz" | You (implied by hi-res request) |

## E. Notification and dynamic island / notch
| ID | Requirement | Source |
|---|---|---|
| E1 | Media notification shows the **album cover**, **song name** and **album name** | You |
| E2 | Song name is the biggest, boldest line | You |
| E3 | Second line is **"Artist, Album"** (artist name, comma, album name) | You |
| E4 | Cover sits on one side, song title big and bold beside it (island-style pill) **(DROPPED v40: the user's notch app draws it from the normal notification)** | You |
| E5 | On a phone with a dynamic island / notch pill, the same info appears there **(drawn by the user's notch app from the normal notification)** | You |
| E6 | Previous, Play/Pause, Next buttons, and tapping opens Now Playing | Suggested (standard) |
| E7 | First-launch notification permission prompt (Android 13+) | Suggested (needed) |
| E8 | Notification test button in Settings > Diagnostics | Suggested |

## F. Song info
**Exact tile list for F2 to F7: see `docs/EXTRA_DETAILS.md` (taken from the `liquid_flac_report` code inside `liquid_all.py`).**

| ID | Requirement | Source |
|---|---|---|
| F1 | **Basic** info like Apple Music: artwork, title, artist, album, genre, year, track/disc, duration | You |
| F2 | **Extra details** toggle with ALL the categories from your FLAC report | You |
| F3 | Extra: Tags (Title, Album, Artist, Album-Artist, Composer, Lyricist, Genre, Year, Label, Comment, Track, Disc) | Py file |
| F4 | Extra: Lyrics (embedded synced/plain, .lrc file name/size/encoding/synced/word-level/lines/first+last timestamp) | Py file |
| F5 | Extra: Audio (bit depth, sample rate, channels, length, bitrate, file size, block size, MD5) | Py file |
| F6 | Extra: Cover (count, resolution, format, type, depth, size) | Py file |
| F7 | Extra: Path (file path, folder) and unreadable-file info (the separate Library health screen was removed in v51) | Py file |
| F8 | Beautiful glass UI for it, in the same style as your report tiles | You |

## G. Custom loop media
| ID | Requirement | Source |
|---|---|---|
| G1 | Attach a custom **GIF, MP4 or image** to a song | You |
| G2 | It loops (replays) as a clip on Now Playing | You |
| G3 | Separate from album cover | You |
| G4 | Fallback order: song loop, then album loop, then blurred cover | Suggested |

## H. Lyrics
| ID | Requirement | Source |
|---|---|---|
| H1 | **Read synced lyrics files** (.lrc next to the FLAC, same name) | You |
| H2 | **Display them synced** like Apple Music: current line highlighted, auto-scroll | You |
| H3 | Tap a lyric line to jump to that point | Suggested |
| H4 | Word-by-word highlight for word-level (enhanced) .lrc files | Py file |
| H5 | Fuzzy-match a .lrc whose name is slightly different | Py file |
| H6 | Use embedded lyrics tags when there is no .lrc; plain lyrics as scrollable text | Py file |
| H7 | Handle encodings (UTF-8, UTF-8 BOM, UTF-16, GBK, Latin-1), the offset tag, several timestamps per line | Py file / Suggested |
| H8 | Lyrics size setting; lyrics text is searchable | Screenshot |

## I. Playlists
| ID | Requirement | Source |
|---|---|---|
| I1 | **Playlists**: create, rename, delete | You |
| I2 | Add, remove and reorder songs | Suggested (standard) |
| I3 | "Add to Playlist" sheet from the 3-dot menu | Suggested (standard) |
| I4 | Play and shuffle a playlist | Suggested (standard) |
| I5 | Playlists row in Library and a playlist detail screen | Screenshot |
| I6 | Cover = 2x2 mosaic of the first four album covers | Suggested |
| I7 | Playlists survive rescans | Suggested |
| I8 | **Pictures and GIFs of any size in a playlist**: add many at once, view full screen, remove, first one = playlist cover (v132) | You |
| I9 | Pictures are stored untouched on the phone (IndexedDB, plus a plain file copy in filesDir/lfpics since v150), only a small description is in the playlist file; export / import does not include them | Suggested |
| I10 | **Update popup picture / GIF**: whatever is in the GitHub folder `update-popup-gif-pic/` shows on the update popups (live, no rebuild, checked every second; no picture = plain popup) (v132, every second in v133) | You |
| I11a | **A custom picture or GIF REPLACES the original** (albums, songs, artists, genres, playlists): the original cover is not drawn under it. Each menu's "Back to ..." button restores the original. The background picture's Darken slider now starts at 0% | You |
| I11 | **Your own background picture or GIF of any size** behind every screen (Home, tabs, album / artist / playlist pages, Settings, Now Playing, lyrics): Settings > Home > Background picture or GIF, Fill / Fit, Darken slider, Remove; stored untouched on the phone (IndexedDB, plus a plain file copy in filesDir/lfpics since v150) | You |

## J. Queue and loop
| ID | Requirement | Source |
|---|---|---|
| J1 | **Loop / repeat playback**: Off, Repeat All, Repeat One (I read "loop feature" this way; the custom GIF/MP4 loop is G1-G4, tell me if you meant something else) | You |
| J2 | Optional A-B loop on a song (DONE v36, phone test pending) | Suggested |
| J3 | Up Next queue view opened from Now Playing | You (Smart queue) |
| J4 | Play Next and Add to Queue from the 3-dot menu of songs | Suggested (standard) |
| J5 | Drag to reorder, Clear, Save queue as playlist | Suggested (standard) |
| J6 | **Smart queue**: Autoplay adds similar songs from the local library when the queue runs low (same artist or same genre; skips songs already in the queue) | You |
| J7 | Smart shuffle: avoids same artist or album back-to-back | Suggested |
| J8 | Queue and position survive closing the app | Suggested |
| J9 | Queue drives the notification and lock-screen Next / Previous | Suggested (standard) |

## K. Missing essentials (added after v13; tickets in `HANDOFF.md` section 10)
| ID | Requirement | Ticket | Source |
|---|---|---|---|
| K1 | **Stable signing key**: every build is signed with one saved key so a new APK installs over the old one (no uninstall, no lost playlists) | T14 (done v14) | You |
| K2 | **Own app icon and splash** (an uploaded launcher logo is fitted whole into the visible part of the icon so nothing is cut (v208+, replaces BUG-162's full-size fill)): red liquid glass note on a black liquid glass tile (glass shine, rim light), black splash screen | T15 (done v14, glass look v51 round 6) | You |
| K3 | **"Copy log" button** in Settings that copies errors to paste to an AI (no Android Studio needed) | T16 (done v14) | You |
| K4 | **Export / import playlists** (survive an uninstall) | T17 | You (DONE v28, phone test pending) |
| K5 | **Scan progress** shown as "n / total" | T18 | You (DONE v29, phone test pending) |
| K6 | **Automatic check** for new or removed files | T18 | You (DONE v29, phone test pending) |
| K7 | **Favorites** | T19 | You (DONE v29, phone test pending) |
| K8 | **Recently Played and Most Played** | T20 | You (DONE v30, phone test pending) |
| K9 | **ReplayGain** volume levelling | T21 | You (NOT in the current code: no ReplayGain source or setting in v90) |
| K10 | **Sleep timer** | T22 | You (DONE v31, phone test pending) |
| K11 | **Sorting** of songs, albums, artists | T23 (DONE v36 merge, phone test pending) | You |
| K12 | **A-Z side index** | T23 (DONE v36 merge, phone test pending) | You |
| K13 | **Gapless playback** check | T24 (code in place; DONE v36, phone test pending) | You |
| K14 | **Phone call** behaviour (pause and resume) | T24 (code in place; DONE v36, phone test pending) | You |
| K15 | **Bluetooth** behaviour (buttons, car display) | T24 (code in place; DONE v36, phone test pending) | You |
| K16 | **Resume the last song** after closing the app | T24 (code in place; DONE v36, phone test pending) | You |
| K17 | **Disc headers** for multi-disc albums | T25 (DONE v36 merge, phone test pending) | You |
| K18 | **Various Artists** handling | T25 (DONE v36 merge, phone test pending) | You |
| K19 | **Recent searches** | T25 (DONE v36 merge, phone test pending) | You |
| K20 | **Accessibility** (TalkBack labels, touch size, font size) | T26 (DONE v36 merge, phone test pending; text still px) | You |
| K21 | **Equalizer** (the AI must ask the user which kind first) | T27 (DONE v36: option A system EQ, phone test pending) | You |
| K25 | **Background style**: black with red lyrics (default) or the album cover's colour on Now Playing and the lyrics page | v95 | You |
| K22 | **Cover images from the folder**: `cover.jpg`, `folder.jpg` (also front / albumart / album) count as album art when a FLAC has no picture inside | T4c step 3 (done v14) | You |
| K23 | **Cover viewer**: tap the Now Playing / album cover = black screen with only the cover | v90 | You |
| K25 | **Tap cover shows original**: Now Playing tap = original cover (default, switch on) or your own picture / GIF (switch off); album page tap always = your own picture / GIF (Settings > Tap cover shows original) | v209 | You |
| K24 | **Cover shortcut**: press and hold the Now Playing cover = open lyrics (Settings > Cover shortcuts) | v90 | You |
| K26 | **Popup that fits any picture**: the author's message and "Update available" share one look (black background, picture, text, liquid glass buttons); any shape or size is scaled to fit | v104 | You |
| K27 | **In-app updates**: "Update available" when a newer build is published; the update is mandatory since v138 (no Later, the screen cannot be closed); picture or docs changes never trigger it; an update whose signature the phone cannot read is no longer blocked as a "different key" (Android's installer still refuses a truly different key) | v95 to v104 | You |
| K28 | **Home greeting** per hour of the day (210 messages for each hour) with your name, set in Settings > Profile | v119 | You |
| K29 | **Home screen settings**: show, hide and reorder sections, cards per row, card size, pinned playlists / artists / albums, a different Home per part of the day, your own names, quick buttons | v119 | You |
| K30 | **Home rows**: See All on every row, calm default layout, Playlists row, Heavy Rotation, Favorites Mix, New Music Mix; Home updates itself | v119 | You |
| K30b | **No big "Home" title on the Home screen**: the greeting is the first line under the top bar (other screens keep their titles); `tests/home-no-title.test.mjs` | 0.208.0 | You |
| K31 | **Now Playing cover size** (40 to 100%, live preview, Reset = automatic) | v119 | You |
| K32 | **Lyrics animation** settings (glide and fade speed, line sizes, brightness, blur, playing line) | v119 | You |
| K33 | **Artist photo from Home**: press and hold an artist card to pick your photo or an album cover | v119 | You |
| K34 | **Earphone and headset buttons** (wired: 1 / 2 / 3 presses; Bluetooth media keys); a play button starts the saved queue after the app was closed. Not yet tested on a phone | v119 | You |
| K35 | **Background-allow popup picture** (`background-allow-gif-pic/`): live picture / GIF on the Allow background activity popup, shown once per upload | v146 | You |
| K36 | **Home picture box above Listening Stats** (`stats-banner-gif-pic/`): liquid-glass box, empty without a picture, sized to the picture | v146 | You |

## Not in scope
OGG and other formats beyond FLAC, MP3 and AAC / M4A. Streaming, accounts, cloud sync, Apple Music subscription features, "Automatically Send" diagnostics.
