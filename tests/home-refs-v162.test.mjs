// v162: a settings export / import keeps the Home layout working on another phone (the ids of playlists and songs differ there).
import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanHome, withNames, findPlaylist, findAlbum, findItem, addPin, addCustom, addCustomItem } from '../src/homecfg.js';
import * as SIO from '../src/settingsio.js';

// the source phone
const src = {
  playlists: [{ id: 'pOLD1', name: 'Road trip' }],
  albums: [{ id: 'aOLD1', title: 'Touch', artist: 'Eurythmics' }],
  tracks: [{ id: 'tOLD1', title: 'Sweet Dreams', trackArtist: 'Eurythmics' }],
};
const look = (lib) => ({
  playlist: id => { const p = lib.playlists.find(x => x.id === id); return p ? { name: p.name } : null; },
  album: id => { const a = lib.albums.find(x => x.id === id); return a ? { name: a.title, by: a.artist } : null; },
  track: id => { const t = lib.tracks.find(x => x.id === id); return t ? { name: t.title, by: t.trackArtist } : null; },
});

test('the names are added to pins and custom songs, and an export carries them', () => {
  let h = cleanHome({});
  h = addPin(h, 'playlist', 'pOLD1');
  h = addPin(h, 'album', 'aOLD1');
  h = addCustom(h, 'Night', 'cust1');
  h = addCustomItem(h, 'cust1', 'song', 'tOLD1');
  const named = withNames(h, look(src));
  const pl = named.pins.find(p => p.type === 'playlist'), al = named.pins.find(p => p.type === 'album'), cu = named.pins.find(p => p.type === 'custom');
  assert.equal(pl.name, 'Road trip'); assert.equal(al.name, 'Touch'); assert.equal(al.by, 'Eurythmics');
  assert.equal(cu.items[0].label, 'Sweet Dreams'); assert.equal(cu.items[0].by, 'Eurythmics');
  assert.equal(withNames(named, look(src)), named, 'nothing missing: the same object comes back');   // cheap to call on every save
  const back = SIO.parseImport(SIO.exportText(SIO.buildExport({ home: named }, {}, '0.208.0')));
  assert.equal(back.settings.home.pins.find(p => p.type === 'playlist').name, 'Road trip');
});

test('imported on another phone with new ids: playlist, album and custom song still resolve by name', () => {
  let h = addPin(cleanHome({}), 'playlist', 'pOLD1');
  h = addPin(h, 'album', 'aOLD1');
  h = addCustom(h, 'Night', 'cust1'); h = addCustomItem(h, 'cust1', 'song', 'tOLD1');
  const file = SIO.parseImport(SIO.exportText(SIO.buildExport({ home: withNames(h, look(src)) }, {}, '0.208.0')));
  const imported = cleanHome(file.settings.home);                       // what the app does with the imported layout
  const dst = { playlists: [{ id: 'pNEW9', name: 'Road trip' }], albums: [{ id: 'aNEW9', title: 'Touch', artist: 'Eurythmics' }], tracks: [{ id: 'tNEW9', title: 'Sweet Dreams', trackArtist: 'Eurythmics' }] };
  const pin = imported.pins.find(p => p.type === 'playlist'), al = imported.pins.find(p => p.type === 'album'), cu = imported.pins.find(p => p.type === 'custom');
  assert.equal(findPlaylist(pin, dst.playlists).id, 'pNEW9');
  assert.equal(findAlbum(al, dst.albums).id, 'aNEW9');
  assert.equal(findItem(cu.items[0], dst.tracks).id, 'tNEW9');
  assert.equal(findPlaylist(pin, []), null, 'a playlist that is not there stays missing (no wrong match)');
});

test('the id still wins when it is right, and a name never matches a different artist', () => {
  const pin = { id: 'x1', type: 'album', ref: 'aA', name: 'Touch', by: 'Eurythmics' };
  assert.equal(findAlbum(pin, [{ id: 'aA', title: 'Other', artist: 'Someone' }]).id, 'aA');
  assert.equal(findAlbum(pin, [{ id: 'aB', title: 'Touch', artist: 'Someone else' }]), null);
  assert.equal(findItem({ t: 'song', v: 'zz', label: 'Sweet Dreams', by: 'Eurythmics' }, [{ id: 'q', title: 'Sweet Dreams', trackArtist: 'Eurythmics' }]).id, 'q');
});

test('names survive the cleaning of the Home layout (pins and custom items keep name / by / label)', () => {
  const h = cleanHome({ pins: [{ id: 'pin1', type: 'playlist', ref: 'pX', name: 'Mix' }, { id: 'cust1', type: 'custom', ref: 'Mine', items: [{ t: 'song', v: 'tX', label: 'Song', by: 'Band' }] }] });
  assert.equal(h.pins[0].name, 'Mix'); assert.equal(h.pins[1].items[0].label, 'Song'); assert.equal(h.pins[1].items[0].by, 'Band');
});
