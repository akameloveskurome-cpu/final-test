# Listening data import / export report (no version change, still 0.148.0)

## Your file
`tempo_backup_*.zip` = a **Tempo** (me.avinas.tempo 4.8.15, schema 58) backup: `data.json` (3.6 MB) + profile picture. It holds 4,144 listening events (2026-09-04 to 2026-11-08, from Musicolet, Spotify, BeatWave and others), 1,365 songs, 1,008 artists, 225 albums. Tempo's own XP / badges / app lists are not listening history and are ignored.
Import result: **4,144 plays read, 4,039 count (30 s rule)**, 105 short ones kept as skips.

## Import: Settings > Backup & transfer > Import listening data (pick the .zip itself)
Liquid backup, **Tempo backup**, ListenBrainz (JSON, JSON Lines, .zip), Last.fm (CSV from the data request, API JSON), Spotify (extended and old history, .zip), YouTube Music (Takeout), Apple Music CSV, Maloja, `.scrobbler.log`, Pano Scrobbler CSV, any CSV with artist / track / date columns. Several files at once. Nothing is counted twice.

## Export: Settings > Backup & transfer > Export listening data
Liquid backup (lossless), **Tempo backup (.zip)**, **Last.fm CSV**, **scrobbler log** (to scrobble to Last.fm / Libre.fm / ListenBrainz), ListenBrainz JSON, Spotify-style JSON, CSV.

## Known limits
- Tempo export is best effort: not tested inside Tempo.
- Tempo / Last.fm / YouTube files hold no real listening time for some rows: the song length (or 3 min) is used, as for other imports.
- `.zip` needs the phone's web view to support deflate streams (Chrome 103+); otherwise unzip and pick the .json.
- Java change (zip pick) not compiled here, not checked on a phone.

## Update: your Tempo file re-checked (4,144 events)
- 4 events were not songs (scan text / ad / "views") and are skipped; 2 were the same play seen by two apps and now count once: **4,140 plays, 4,036 count**.
- `sessionId` in Tempo is one per play, so sessions are still built by our 30 minute rule. Time zone (`tzOffsetMinutes`, 330) is kept per play.
- Smart artist grouping now also applies to plays of songs you do not have: "The Weeknd, Kendrick Lamar" counts for both artists, "Eurythmics, Annie Lennox, Dave Stewart" for three, "Tyler, The Creator" stays one. Nothing stored is changed, so grouping can be switched on / off at any time and exports stay exact.
- Tempo export now has the same layout as the real backup (see HANDOFF_STATUS). Still best effort, not tested in Tempo.
