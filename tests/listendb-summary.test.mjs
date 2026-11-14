// BUG-226: the summary tables + triggers of ListenDb (version 2) run for real in SQLite and are compared with the OLD DISTINCT queries after random inserts, updates, imports and deletes.
import test from 'node:test'; import assert from 'node:assert/strict'; import { readFileSync } from 'node:fs';
let DatabaseSync = null; try { ({ DatabaseSync } = await import('node:sqlite')); } catch { /* old Node */ }
const java = readFileSync(new URL('../native-android/ListenDb.java', import.meta.url), 'utf8');
// the Java constants are plain string concatenation: evaluate them as JavaScript
const consts = [...java.matchAll(/static final String (\w+) = ([\s\S]*?);\n/g)].filter(m => /^(SEEN_|DAYS_|DAY_)/.test(m[1]) || m[1] === 'SEEN_ADD');
const arr = /static final String\[\] V2_SQL = \{([\s\S]*?)\n  \};/.exec(java)[1];
const code = consts.map(m => `const ${m[1]} = ${m[2]};`).join('\n') + `\nreturn { V2_SQL: [${arr}], SEEN_SQL, DAYS_SQL };`;
const { V2_SQL, SEEN_SQL, DAYS_SQL } = new Function(code)();
const V1 = `CREATE TABLE listen_sessions(id TEXT PRIMARY KEY, start_ms INTEGER NOT NULL, end_ms INTEGER NOT NULL);
CREATE TABLE listen_segments(id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL, play_id TEXT NOT NULL, seq INTEGER NOT NULL, song_id TEXT NOT NULL, title TEXT, artist TEXT, album TEXT, album_artist TEXT, start_ms INTEGER NOT NULL, end_ms INTEGER NOT NULL, dur_ms INTEGER NOT NULL, fg INTEGER NOT NULL DEFAULT 0, qualified INTEGER NOT NULL DEFAULT 0, start_pos_ms INTEGER, end_pos_ms INTEGER, track_dur_ms INTEGER, tz_off_min INTEGER NOT NULL DEFAULT 0, open INTEGER NOT NULL DEFAULT 0, UNIQUE(play_id, seq));
CREATE INDEX idx_seg_start ON listen_segments(start_ms); CREATE INDEX idx_seg_song ON listen_segments(song_id, start_ms);`;
const OLD_SEEN = 'SELECT DISTINCT song_id, artist, album, album_artist, title FROM listen_segments WHERE start_ms<? AND dur_ms>0';
const OLD_DAYS = 'SELECT DISTINCT ((start_ms/60000 + tz_off_min)/1440) AS dn FROM listen_segments WHERE dur_ms>=1000 ORDER BY dn DESC';
let seed = 7; const rnd = n => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * n); };
const norm = rows => rows.map(r => Object.values(r).map(v => (v === null || v === '' ? '' : v)).join('\u0001')).sort();
const TZ = [-480, -300, 0, 60, 330, 540, 840, -720];
function mk(migrateFirst) {
  const d = new DatabaseSync(':memory:'); d.exec(V1); if (migrateFirst) for (const q of V2_SQL) d.exec(q);
  return d;
}
function load(d, n, nextId = { v: 0 }) {   // like the tracker: insert with dur 0, later raise dur; like an import: insert with dur at once
  const ins = d.prepare('INSERT INTO listen_segments(session_id,play_id,seq,song_id,title,artist,album,album_artist,start_ms,end_ms,dur_ms,tz_off_min) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)');
  const ids = [];
  for (let i = 0; i < n; i++) {
    const song = 's' + rnd(25), nul = rnd(6) === 0, t0 = 1.6e12 + rnd(400) * 86400000 + rnd(86400) * 1000, imp = rnd(3) === 0, dur = rnd(4) === 0 ? rnd(900) : 1000 + rnd(200000);
    const r = ins.run('se' + rnd(50), 'p' + (nextId.v++), 0, song, nul ? null : 'T' + song, nul ? null : 'A' + rnd(8), rnd(5) === 0 ? '' : 'AL' + rnd(6), rnd(2) ? 'AA' + rnd(4) : null, t0, t0 + dur, imp ? dur : 0, TZ[rnd(TZ.length)]);
    ids.push([Number(r.lastInsertRowid), dur, imp]);
  }
  const upd = d.prepare('UPDATE listen_segments SET dur_ms=? WHERE id=?');
  for (const [id, dur, imp] of ids) if (!imp) { if (rnd(2)) upd.run(Math.min(dur, 400), id); upd.run(dur, id); }   // heartbeats raise the duration in steps
}
const same = (d, before) => { assert.deepEqual(norm(d.prepare(SEEN_SQL).all(before)), norm(d.prepare(OLD_SEEN).all(before)), 'seen ' + before); assert.deepEqual(d.prepare(DAYS_SQL).all().map(r => r.dn), d.prepare(OLD_DAYS).all().map(r => r.dn), 'days'); };
const SK = !DatabaseSync && 'node:sqlite not available in this Node (needs Node 22.13+)';
test('summary tables kept by triggers equal the old DISTINCT queries after inserts, imports and heartbeat updates', { skip: SK }, () => {
  const d = mk(true); load(d, 400);
  for (const b of [0, 1.6e12, 1.62e12, 1.64e12, 2e12]) same(d, b);
  assert.ok(d.prepare('SELECT COUNT(*) c FROM listen_days').get().c > 50);
});
test('the one-time backfill of an existing history gives the same answers as the old queries (upgrade from version 1)', { skip: SK }, () => {
  const d = mk(false); load(d, 400); for (const q of V2_SQL) d.exec(q);
  for (const b of [0, 1.62e12, 2e12]) same(d, b);
  load(d, 100, { v: 100000 }); same(d, 2e12);   // and it keeps following afterwards
});
test('deleting segments (a dropped tiny segment, a deleted period, a deleted history) removes songs and days that are really gone, keeps the rest', { skip: SK }, () => {
  const d = mk(true); load(d, 500);
  d.exec('DELETE FROM listen_segments WHERE dur_ms<500'); same(d, 2e12);
  d.exec('DELETE FROM listen_segments WHERE start_ms<1.62e12'); same(d, 2e12); same(d, 1.63e12);
  d.exec('DELETE FROM listen_segments WHERE id%3=0'); same(d, 2e12);
  d.exec('DELETE FROM listen_segments'); same(d, 2e12);
  assert.equal(d.prepare('SELECT COUNT(*) c FROM songs_seen').get().c, 0); assert.equal(d.prepare('SELECT COUNT(*) c FROM listen_days').get().c, 0);
});
test('seen() and days() read the summary tables, not the segments (static check)', () => {
  assert.match(java, /rawQuery\(SEEN_SQL,/); assert.match(java, /rawQuery\(DAYS_SQL, null\)/); assert.match(java, /static final int VERSION = 2;/); assert.match(java, /if \(from < 2\)/);
  assert.ok(!/rawQuery\("SELECT DISTINCT/.test(java), 'no DISTINCT scan of listen_segments is left in a read path');
});
