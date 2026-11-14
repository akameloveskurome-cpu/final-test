// v208: .zip files in zip64 format (very big archives) are read too; they used to be refused with "unzip it first".
import test from 'node:test';
import assert from 'node:assert/strict';
import { unzipText } from '../src/zipread.js';

const enc = new TextEncoder();
/** Builds a zip64 archive by hand: stored files, every size / offset marked 0xFFFFFFFF in the central directory and given in the zip64 extra field, zip64 end record + locator, 0xFFFF in the normal end record. */
function zip64(files, { bigOffsets = 0 } = {}) {
  const parts = [], cds = []; let pos = 0;
  const push = u => { parts.push(u); pos += u.length; };
  for (const [name, text] of files) {
    const nb = enc.encode(name), data = enc.encode(text), off = pos;
    const lh = new DataView(new ArrayBuffer(30)); lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 45, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, nb.length, true);
    push(new Uint8Array(lh.buffer)); push(nb); push(data);
    const ex = new DataView(new ArrayBuffer(28)); ex.setUint16(0, 1, true); ex.setUint16(2, 24, true); ex.setBigUint64(4, BigInt(data.length), true); ex.setBigUint64(12, BigInt(data.length), true); ex.setBigUint64(20, BigInt(off), true);
    const cd = new DataView(new ArrayBuffer(46)); cd.setUint32(0, 0x02014b50, true); cd.setUint16(4, 45, true); cd.setUint16(6, 45, true); cd.setUint32(20, 0xFFFFFFFF, true); cd.setUint32(24, 0xFFFFFFFF, true); cd.setUint16(28, nb.length, true); cd.setUint16(30, 28, true); cd.setUint32(42, 0xFFFFFFFF, true);
    cds.push(new Uint8Array(cd.buffer), nb, new Uint8Array(ex.buffer));
  }
  const cdStart = pos; for (const c of cds) push(c); const cdLen = pos - cdStart, z = pos;
  const e64 = new DataView(new ArrayBuffer(56)); e64.setUint32(0, 0x06064b50, true); e64.setBigUint64(4, 44n, true); e64.setUint16(12, 45, true); e64.setUint16(14, 45, true); e64.setBigUint64(24, BigInt(files.length), true); e64.setBigUint64(32, BigInt(files.length), true); e64.setBigUint64(40, BigInt(cdLen), true); e64.setBigUint64(48, BigInt(cdStart), true);
  push(new Uint8Array(e64.buffer));
  const loc = new DataView(new ArrayBuffer(20)); loc.setUint32(0, 0x07064b50, true); loc.setBigUint64(8, BigInt(z), true); loc.setUint32(16, 1, true); push(new Uint8Array(loc.buffer));
  const end = new DataView(new ArrayBuffer(22)); end.setUint32(0, 0x06054b50, true); end.setUint16(8, 0xFFFF, true); end.setUint16(10, 0xFFFF, true); end.setUint32(12, 0xFFFFFFFF, true); end.setUint32(16, 0xFFFFFFFF, true); push(new Uint8Array(end.buffer));
  const out = new Uint8Array(pos); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out;
}

test('zip64 archive: every file is found and read (sizes and offsets come from the zip64 extra field)', async () => {
  const r = await unzipText(zip64([['a.json', '{"x":1}'], ['notes/b.csv', 'artist,track\nA,B\n'], ['pic.png', 'skip me']]));
  assert.deepEqual(r.map(x => x.name), ['a.json', 'notes/b.csv']);
  assert.equal(r[0].text, '{"x":1}'); assert.equal(r[1].text, 'artist,track\nA,B\n');
});

test('zip64: a damaged end record is a controlled "Damaged" error, not a crash', async () => {
  const b = zip64([['a.json', '{}']]); const v = new DataView(b.buffer); v.setBigUint64(b.length - 22 - 12, 999999n, true);   // locator points outside the file
  await assert.rejects(() => unzipText(b), /Damaged \.zip/);
});

test('zip64: the old "unzip it first" refusal is gone', async () => {
  const src = (await import('node:fs')).readFileSync(new URL('../src/zipread.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /unzip it first/);
});
