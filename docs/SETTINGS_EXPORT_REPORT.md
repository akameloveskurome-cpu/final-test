# Settings export / import: report (no version change, still 0.148.0)

## How many it saves
- **23 settings groups = 54 single values** (before this change) **+ 1 small extra** (Canvas on/off; the profile photo is NOT saved, see below). The Export toast and the Import sheet now show the real number of values, not the number of groups (before they said "23 settings").
- Anything you add later (renamed sections, pinned items, your own Home sections, your name) is inside those values and travels too.

## What IS saved (all of it, one file `liquid-dark-settings.json`)
| Area | Values |
|---|---|
| Display toggles | Motion, Album details, Smart artist grouping, Bigger covers, Lens refraction, Cover shortcuts, Increase Contrast, Red hover |
| Sizes | Lyrics size (px), Now Playing cover size, Glass bar size (%), old Small/Medium/Large names |
| Lyrics | Background style (classic / cover colour), Lyrics animation (7 sliders) |
| Liquid glass & wobble | all 10 sliders: pill wobble up/down, left/right, stretch, pill size, magnification, bounciness, spring speed, button squash, toggle knob, glass edge fringe |
| Background look | Darken %, Fill / Fit |
| Home screen (15) | order, hidden sections, pinned sections, your own sections and their items, renamed sections, renamed quick buttons, quick button order / hidden, time-of-day Home and its hidden lists, cards per row, card size, greeting, library counts, quick buttons row |
| Sorting | Songs, Albums, Artists sort order |
| Playback / library | Autoplay, Check for new music automatically |
| Profile | Your name |
| Extras | Canvas on/off |

## What was NOT saved before, and what I changed
1. **Profile photo**: NOT saved in the settings file (v163: the owner adds it again after a reinstall). It is listed in NOT_INCLUDED. (BUG-425: this line used to say it was saved.)
2. **Wrong number shown**: the count was top-level groups (23), now real values (54+).
3. **No list of what is left out**: the Import sheet now says it, and the Export row text says it.
4. **Extras were not checked on import**: the Canvas switch must be 0 or 1. Anything else is ignored. (The profile photo is not exported, so it is not imported.)

## Still NOT in the file (on purpose: big device files or not settings)
- Background picture / GIF (device file, any size).
- Profile GIF / video.
- Playlist, album, artist and genre pictures / GIFs, Canvas videos.
- Music folder choice (Android permission, it asks again after a reinstall).
- Search history (history, not a setting; kept as it is on import).
- Favorites, playlists, play history (their own Export / Import rows).
- Temporary things: sleep timer, A-B loop, queue position, "seen" flags of popups.

## Known limit
Home pins and your own Home sections point to albums / playlists / songs by id. If the music folder is picked again and Android gives different ids, a pin can show as "Missing album / playlist". The settings themselves still load.

## Files changed
`src/settingsio.js` (extras, checks, `countValues`, `NOT_INCLUDED`), `src/main.js` (export toast, import sheet), `tests/settingsio.test.mjs` (+2). `npm test` 370 / 370. NOT checked on a phone.
