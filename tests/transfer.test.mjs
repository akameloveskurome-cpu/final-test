import test from 'node:test';
import assert from 'node:assert/strict';
import { csvParse, csvText, headerMap, crc32, zipFiles, toBase64, safeName, uniqueNames, xmlEsc, xmlUnesc } from '../src/transfer.js';

test('csvParse: quotes, commas, newlines in fields, CRLF, BOM, delimiter detection', () => {
  const r = csvParse('\uFEFFa,b,c\r\n"x, y","he said ""hi""","line1\nline2"\r\n1,2,3');
  assert.deepEqual(r, [['a', 'b', 'c'], ['x, y', 'he said "hi"', 'line1\nline2'], ['1', '2', '3']]);
  assert.deepEqual(csvParse('a;b\n1;2'), [['a', 'b'], ['1', '2']]);
  assert.deepEqual(csvParse('Name\tArtist\nSong\tMe'), [['Name', 'Artist'], ['Song', 'Me']]);
  assert.deepEqual(csvParse(''), []);
});
test('csvText round-trips awkward values', () => {
  const rows = [['Playlist', 'Track'], ['Tom & "Jerry"', 'a,b'], ['x', 'multi\nline'], [' pad ', '']];
  assert.deepEqual(csvParse(csvText(rows)), rows);
});
test('headerMap finds columns by alias, ignoring case and punctuation', () => {
  const h = headerMap(['Track Name', 'Artist Name(s)', 'ALBUM', 'x'], { title: ['title', 'track name'], artist: ['artist name s', 'artist'], album: ['album name', 'album'], none: ['zzz'] });
  assert.deepEqual(h, { title: 0, artist: 1, album: 2, none: -1 });
});
test('zipFiles makes a readable zip (checked with the real unzip tool where available)', async () => {
  const bytes = zipFiles([{ name: 'a.m3u8', text: '#EXTM3U\nhello é\n' }, { name: 'b/ü.txt', text: 'x' }], new Date(2026, 10, 7, 12, 0, 0));
  assert.equal(bytes[0], 0x50); assert.equal(bytes[1], 0x4b);
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xCBF43926);   // the standard CRC-32 check value
  assert.equal(toBase64(Uint8Array.from([104, 105])), 'aGk=');
  const { execFileSync } = await import('node:child_process'); const fs = await import('node:fs'); const os = await import('node:os'); const path = await import('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zt-')), z = path.join(dir, 't.zip'); fs.writeFileSync(z, bytes);
  let out = null; try { out = execFileSync('python3', ['-c', 'import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; print("|".join(n+":"+z.read(n).decode() for n in z.namelist()))', z]).toString().trim(); } catch (e) { if (e.code === 'ENOENT') return; throw e; }
  assert.equal(out, 'a.m3u8:#EXTM3U\nhello é\n|b/ü.txt:x');
});
test('file names and xml helpers', () => {
  assert.equal(safeName('AC/DC: Best*Of?'), 'AC DC Best Of'); assert.equal(safeName('   '), 'file');
  assert.deepEqual(uniqueNames(['a.m3u8', 'A.m3u8', 'b.m3u8']), ['a.m3u8', 'A (2).m3u8', 'b.m3u8']);
  assert.equal(xmlUnesc(xmlEsc('Tom & <Jerry> "x" \'y\'')), 'Tom & <Jerry> "x" \'y\'');
  assert.equal(xmlUnesc('<![CDATA[a & b]]>'), 'a & b');
});
