// v208: once imported, playlists / settings / listening data live in the app's own storage; the import file is not needed again, and only the person deleting them removes them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extract } from './extract.mjs';
const M = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8'), J = readFileSync(new URL('../native-android/LiquidNative.java', import.meta.url), 'utf8');

function loadWorld({ file, mem, native = true }) {
  const state = { mem: mem.map(p => ({ ...p })), saved: 0 };
  const d = {
    Native: { isNative: native, getPlaylists: async () => ({ playlists: file }) },
    savablePlaylists: () => state.mem.map(p => ({ ...p })), setPlaylists: l => { state.mem = l.map(p => ({ ...p })); },
    savePl: () => { state.saved++; return Promise.resolve(true); }, picsOf: () => [], ppDrop() {}, ppEnsure: () => Promise.resolve(),
    get playlists() { return state.mem; },
  };
  return { state, run: extract('src/main.js', 'loadPlaylists', d) };
}

test('loading the saved file never throws away a playlist that is in memory but not in the file yet; it is saved again', async () => {
  const { state, run } = loadWorld({ file: [{ id: 'a', name: 'Old', ids: ['1'] }], mem: [{ id: 'pimp0', name: 'Just imported', ids: ['2'] }] });
  await run();
  assert.deepEqual(state.mem.map(p => p.id).sort(), ['a', 'pimp0']);
  assert.ok(state.saved >= 1);
});

test('loading the saved file with nothing unsaved in memory just shows the file, nothing is re-saved', async () => {
  const { state, run } = loadWorld({ file: [{ id: 'a', name: 'Old', ids: ['1'] }], mem: [] });
  await run();
  assert.deepEqual(state.mem.map(p => p.id), ['a']); assert.equal(state.saved, 0);
});

test('an EMPTY or older file cannot wipe imported playlists that are in memory', async () => {
  const { state, run } = loadWorld({ file: [], mem: [{ id: 'pimp0', name: 'Imported', ids: ['2'] }] });
  await run();
  assert.deepEqual(state.mem.map(p => p.id), ['pimp0']);
});

test('the only places that remove a playlist are the Delete Playlist button and nothing else (source guard)', () => {
  assert.equal((M.match(/playlists\.splice\(/g) || []).length, 1);   // case 'del-ok'
  assert.ok(M.includes("case 'del-ok': if (p) { ppDrop(p, picsOf(p).map(x => x.id)); playlists.splice(playlists.indexOf(p), 1); savePl();"));
  assert.ok(!/playlists\s*=\s*\[\]/.test(readFileSync(new URL('../src/data.js', import.meta.url), 'utf8').replace(/export let playlists = \[[\s\S]*?\];/, '').replace('if (!plLoaded) playlists = [];', '')));
});

test('playlist import is written to the app\'s own file BEFORE "Imported" is shown, and says so when it was not', () => {
  const f = M.slice(M.indexOf('async function plImportOk()'), M.indexOf('async function saveMissing'));
  assert.ok(f.indexOf('await savePl()') > 0 && f.indexOf('await savePl()') < f.indexOf("toast(saved ?"));
  assert.ok(f.includes('could not be saved yet'));
  assert.ok(M.includes("const savePl = () => Native.savePlaylists({ playlists: savablePlaylists() }).then(() => true"));
});

test('the import file is only READ: its text is copied into the app and the temporary copy is deleted (Java)', () => {
  const o = J.slice(J.indexOf('private void openFilesResult'), J.indexOf('private void releaseImports'));
  assert.ok(o.includes('f.delete();') && o.includes('o.put("text"') && o.includes('releaseImports()'));
  assert.doesNotMatch(M.slice(M.indexOf('async function importPl()'), M.indexOf('function plImportSheet')), /localStorage\.setItem\([^)]*(f\.name|f\.path|uri)/);   // no pointer to the file is kept
});

test('settings import: read back from the app\'s own storage before the reload; listening import waits for the play counts to be written', () => {
  const a = M.slice(M.indexOf('function applyImportedSettings()'), M.indexOf('function nameSheet'));
  assert.ok(a.includes("localStorage.getItem('lf.settings') === JSON.stringify(set)") && a.includes('Could not save the settings on this phone'));
  const l = M.slice(M.indexOf('async function lsImportOk()'), M.indexOf('/* ---------- settings: export / import'));
  assert.ok(l.includes('await saveUser(STATS_FILE, stats)') && l.includes('statsSaveFailed'));
  assert.ok(J.includes('importRows(rows)') && /d\.setTransactionSuccessful\(\);\s*\} finally \{ d\.endTransaction\(\); \}/.test(readFileSync(new URL('../native-android/ListenDb.java', import.meta.url), 'utf8')));   // history rows are committed into the app's own database
});
