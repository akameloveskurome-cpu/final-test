// BUG #76 (owner request): pictures must not stay blank when the phone's file list is slow.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extract } from './extract.mjs';

test('earlyPics loads only pictures that are not on screen yet, straight from the database (no file listing)', () => {
  const calls = [];
  const restorePics = (keys, db, apply, tries, prefix, mark, shown) => calls.push({ keys, db, apply, prefix, shown });
  const alpUrls = new Map([['a1', 'file:a1']]), spUrls = new Map(), agUrls = { art1: 'x' }, gpUrls = {};
  const deps = {
    restorePics, alpUrls, spUrls, agUrls, gpUrls, alDb: 'AL', spDb: 'SP', agDb: 'AG', gDb: 'G', alpSet: 'alpSet', spSet: 'spSet', agSet: 'agSet', gpSet: 'gpSet',
    alpMap: () => ({ a1: 1, a2: 1 }), spMap: () => ({ s1: 1 }), apicMap: () => ({ art1: 'gif:1', art2: 'gif:1', art3: 'data:image/png' }), gpMap: () => ({ g1: 1 }),
    bgQuick: false, bgUrl: '', bgSaved: () => true, restoreBg: () => calls.push('bg'), pfQuick: true, pfMedia: null, pfSaved: () => true, restorePf: () => calls.push('pf'),
  };
  extract('src/main.js', 'earlyPics', deps, '} catch {} };')();
  const by = db => calls.find(c => c.db === db);
  assert.deepEqual(by('AL').keys, ['a2']); assert.deepEqual(by('SP').keys, ['s1']); assert.deepEqual(by('AG').keys, ['art2']); assert.deepEqual(by('G').keys, ['g1']);
  assert.ok(calls.every(c => c === 'bg' || c === 'pf' || c.prefix === ''), 'empty prefix = no file listing');
  assert.equal(by('AL').shown('a1'), true); assert.equal(by('AL').shown('a2'), false, 'shown() tells restorePics what is already on screen');
  assert.ok(calls.includes('bg')); assert.ok(!calls.includes('pf'), 'profile already shown from its file');
});

test('start-up runs earlyPics right away (no 1.2 s wait, no wait for the file list)', () => {
  const s = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8').split('\n');
  assert.ok(s.includes('earlyPics();'));
  assert.ok(!s.some(l => l.includes('setTimeout(() => { if (!picsSyncDone) earlyPics()')));
  assert.ok(s.some(l => l.startsWith('picsSynced.then(async () => { if (!bgQuick && !bgUrl) restoreBg(); if (!pfQuick && !pfMedia) await restorePf();')), 'file-list pass does not load bg / profile twice');
});

test('restorePics skips pictures that shown() says are already on screen', async () => {
  const quickKeys = new Set(['lf-albumpics:q']), loaded = [], picBusy = new Set();
  const db = { get: k => { loaded.push(k); return Promise.resolve(null); } };
  const f = extract('src/main.js', 'restorePics', { quickKeys, picBusy, bkey: (d, k) => k, mirrorKeys: async () => ['lf-albumpics:p', 'lf-albumpics:z'], repaintPics: () => {}, setTimeout: () => 0, Math }, '}');
  await f(['a', 'b', 'q'], db, () => {}, 1, 'lf-albumpics', null, k => k === 'a' || k === 'z');
  assert.deepEqual(loaded.sort(), ['b', 'p'], 'a (shown), q (quick) and z (shown) are not loaded again');
});

test('quickPics does not swap a picture that is already on screen to its file copy', () => {
  const urls = { alp: new Map([['a1', 'blob:old']]), sp: new Map() }, quickKeys = new Set(), set = [];
  const deps = {
    quickKeys, mirrorSyncKeys: p => p === 'lf-albumpics:' ? ['lf-albumpics:a1', 'lf-albumpics:a2'] : [], mirrorUrlSync: k => 'file://' + k, warmUrl: () => {}, probeUrl: () => new Promise(() => {}), mirrorForget: () => {},
    alpUrls: urls.alp, spUrls: urls.sp, agUrls: {}, gpUrls: {}, ppUrl: new Map(), npSoon: () => {}, restorePics: () => {}, alDb: 0, spDb: 0, agDb: 0, gDb: 0, alpSet: 0, spSet: 0, agSet: 0, gpSet: 0,
    alpMap: () => ({}), alpSave: () => {}, spMap: () => ({}), spSave: () => {}, apicMap: () => ({}), apicSave: () => {}, gpMap: () => ({}), gpSave: () => {},
    bgQuick: true, bgUrl: 'x', pfQuick: true, pfMedia: {}, bgSetUrl: () => {}, pfSetUrl: () => {}, restoreBg: () => {}, restorePf: () => {},
  };
  extract('src/main.js', 'quickPics', deps, '}')();
  assert.equal(urls.alp.get('a1'), 'blob:old', 'a1 untouched'); assert.equal(urls.alp.get('a2'), 'file://lf-albumpics:a2', 'a2 shown from its file');
});
