import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = resolve(fileURLToPath(new URL('../scripts/apply-app-logo.py', import.meta.url)));
const hasPillow = spawnSync('python3', ['-c', 'import PIL'], { encoding: 'utf8' }).status === 0;
const MANIFEST = '<manifest xmlns:android="http://schemas.android.com/apk/res/android"><!-- <application android:icon="decoy"> -->'
  + '<application android:allowBackup="true" android:icon="@mipmap/old" android:roundIcon="@mipmap/oldr" android:label="x"><activity/></application></manifest>';

async function project(t, { latest, picture } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'liquid-logo-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const res = join(root, 'android/app/src/main/res');
  await mkdir(join(res, 'mipmap-hdpi'), { recursive: true });
  await writeFile(join(res, 'mipmap-hdpi/ic_launcher.webp'), 'template icon in another format');
  await writeFile(join(root, 'android/app/src/main/AndroidManifest.xml'), MANIFEST);
  await mkdir(join(root, 'app-logo-pic'), { recursive: true });
  if (picture) await picture(root);
  if (latest !== undefined) await writeFile(join(root, 'app-logo-pic/latest.json'), typeof latest === 'string' ? latest : JSON.stringify(latest));
  return root;
}
const run = root => spawnSync('python3', [script, '--repo', root, '--res', join(root, 'android/app/src/main/res'),
  '--manifest', join(root, 'android/app/src/main/AndroidManifest.xml')], { encoding: 'utf8' });
const py = (code, ...args) => {
  const r = spawnSync('python3', ['-c', code, ...args], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
};
const make = (root, name, code) => py(`from PIL import Image, ImageDraw\nimport sys\nroot, name = sys.argv[1:3]\n${code}`, root, name);
const pixel = (root, rel, x, y) => JSON.parse(py('import sys, json\nfrom PIL import Image\nim = Image.open(sys.argv[1]).convert("RGBA")\nprint(json.dumps([im.size, im.getpixel((int(sys.argv[2]), int(sys.argv[3])))]))',
  join(root, 'android/app/src/main/res', rel), String(x), String(y)));

const opts = { skip: hasPillow ? false : 'Pillow is not installed' };

test('the named picture becomes legacy, round and adaptive launcher icons and the manifest points at them', opts, async t => {
  const root = await project(t, { latest: { name: 'logo.png', commit: 'c1', stamp: 'lc1' },
    picture: r => make(r, 'logo.png', 'im = Image.new("RGB", (600, 600), (200, 30, 30))\nImageDraw.Draw(im).ellipse((100, 100, 500, 500), fill=(250, 250, 250))\nim.save(root + "/app-logo-pic/" + name)') });
  const r = run(root);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const res = join(root, 'android/app/src/main/res');
  const sizes = { mdpi: [48, 108], hdpi: [72, 162], xhdpi: [96, 216], xxhdpi: [144, 324], xxxhdpi: [192, 432] };
  for (const [d, [legacy, adaptive]] of Object.entries(sizes)) {
    assert.deepEqual(pixel(root, `mipmap-${d}/ic_launcher.png`, 0, 0)[0], [legacy, legacy]);
    assert.deepEqual(pixel(root, `mipmap-${d}/ic_launcher_round.png`, 0, 0)[0], [legacy, legacy]);
    assert.deepEqual(pixel(root, `mipmap-${d}/lf_logo_fg.png`, 0, 0)[0], [adaptive, adaptive]);
    assert.deepEqual(pixel(root, `mipmap-${d}/lf_logo_bg.png`, 0, 0)[0], [adaptive, adaptive]);
  }
  assert.deepEqual(pixel(root, 'mipmap-xxxhdpi/ic_launcher.png', 96, 96)[1], [250, 250, 250, 255], 'the picture itself is the square icon');
  assert.equal(pixel(root, 'mipmap-xxxhdpi/ic_launcher_round.png', 0, 0)[1][3], 0, 'the round icon is masked to a circle');
  assert.equal(pixel(root, 'mipmap-xxxhdpi/lf_logo_fg.png', 0, 0)[1][3], 0, 'v208+: the picture is fitted into the visible 72 of 108 dp, the outer third is empty (dark background shows)');
  assert.equal(pixel(root, 'mipmap-xxxhdpi/lf_logo_fg.png', 60, 60)[1][3], 0, 'just outside the fitted picture');
  assert.equal(pixel(root, 'mipmap-xxxhdpi/lf_logo_fg.png', 76, 76)[1][3], 255, 'the fitted picture starts at 1/6 of the icon (72 px of 432)');
  assert.equal(pixel(root, 'mipmap-xxxhdpi/lf_logo_bg.png', 0, 0)[1][3], 255, 'adaptive background is opaque');
  for (const name of ['ic_launcher.xml', 'ic_launcher_round.xml']) {
    const xml = await readFile(join(res, 'mipmap-anydpi-v26', name), 'utf8');
    assert.match(xml, /<adaptive-icon/);
    assert.match(xml, /@mipmap\/lf_logo_bg/);
    assert.match(xml, /@mipmap\/lf_logo_fg/);
  }
  assert.equal(existsSync(join(res, 'mipmap-hdpi/ic_launcher.webp')), false, 'a template icon in another format would be a duplicate resource');
  const manifest = await readFile(join(root, 'android/app/src/main/AndroidManifest.xml'), 'utf8');
  assert.match(manifest, /<application android:icon="@mipmap\/ic_launcher" android:roundIcon="@mipmap\/ic_launcher_round" android:allowBackup="true" android:label="x">/);
  assert.equal((manifest.match(/android:icon=/g) || []).length, 2, 'one real attribute plus the untouched XML comment');
  assert.match(manifest, /<!-- <application android:icon="decoy"> -->/);
});

test('every supported picture type works: jpeg (not square), transparent png, gif with a blank first frame, webp, bmp', opts, async t => {
  const cases = {
    'wide.jpg': 'Image.new("RGB", (800, 300), (10, 120, 220)).save(root + "/app-logo-pic/" + name, "JPEG")',
    'clear.png': 'im = Image.new("RGBA", (300, 300), (0, 0, 0, 0))\nImageDraw.Draw(im).rectangle((60, 60, 240, 240), fill=(0, 200, 0, 255))\nim.save(root + "/app-logo-pic/" + name)',
    'blank-first.gif': 'a = Image.new("RGB", (200, 200), (0, 0, 0))\nb = Image.new("RGB", (200, 200), (255, 0, 255))\nImageDraw.Draw(b).rectangle((0, 0, 9, 9), fill=(255, 255, 255))\na.save(root + "/app-logo-pic/" + name, save_all=True, append_images=[b], duration=100, loop=0)',
    'pic.webp': 'Image.new("RGB", (256, 256), (90, 40, 200)).save(root + "/app-logo-pic/" + name, "WEBP")',
    'pic.BMP': 'Image.new("RGB", (128, 128), (1, 2, 3)).save(root + "/app-logo-pic/" + name, "BMP")',
  };
  for (const [name, code] of Object.entries(cases)) {
    const root = await project(t, { latest: { name, stamp: 'l1' }, picture: r => make(r, name, code) });
    const r = run(root);
    assert.equal(r.status, 0, `${name}: ${r.stdout}${r.stderr}`);
    assert.deepEqual(pixel(root, 'mipmap-xxxhdpi/ic_launcher.png', 0, 0)[0], [192, 192], name);
    assert.deepEqual(pixel(root, 'mipmap-xxxhdpi/lf_logo_fg.png', 0, 0)[0], [432, 432], name);
  }
  const gif = await project(t, { latest: { name: 'blank-first.gif', stamp: 'l1' }, picture: r => make(r, 'blank-first.gif', cases['blank-first.gif']) });
  assert.equal(run(gif).status, 0);
  assert.deepEqual(pixel(gif, 'mipmap-xxxhdpi/ic_launcher.png', 96, 96)[1], [255, 0, 255, 255], 'the first non-blank GIF frame is used');
  const clear = await project(t, { latest: { name: 'clear.png', stamp: 'l1' }, picture: r => make(r, 'clear.png', cases['clear.png']) });
  assert.equal(run(clear).status, 0);
  assert.equal(pixel(clear, 'mipmap-xxxhdpi/ic_launcher.png', 0, 0)[1][3], 255, 'BUG-160: a transparent logo gets the same blurred backdrop in the legacy icon (no see-through square)');
  assert.deepEqual(pixel(clear, 'mipmap-xxxhdpi/lf_logo_bg.png', 0, 0)[1], [14, 14, 18, 255], 'and gets a dark adaptive background');
});

test('no logo, or an unusable one, changes nothing and exits 3 (the workflow then uses the generic icon)', opts, async t => {
  const bad = {
    'no latest.json': undefined,
    'manifest names a missing file': { name: 'gone.png', stamp: 'l1' },
    'path traversal': { name: '../logo.png', stamp: 'l1' },
    'hidden file': { name: '.logo.png', stamp: 'l1' },
    'unsupported type': { name: 'logo.svg', stamp: 'l1' },
    'broken json': '{not json',
    'corrupt picture': { name: 'corrupt.png', stamp: 'l1' },
  };
  for (const [label, latest] of Object.entries(bad)) {
    const root = await project(t, { latest, picture: async r => {
      await writeFile(join(r, 'app-logo-pic/corrupt.png'), 'this is not a png');
      await writeFile(join(r, 'logo.png'), 'outside the folder');
      await writeFile(join(r, 'app-logo-pic/logo.svg'), '<svg/>');
    } });
    const r = run(root);
    assert.equal(r.status, 3, `${label}: ${r.stdout}${r.stderr}`);
    assert.equal(await readFile(join(root, 'android/app/src/main/AndroidManifest.xml'), 'utf8'), MANIFEST, `${label}: manifest untouched`);
    assert.deepEqual(await readdir(join(root, 'android/app/src/main/res/mipmap-hdpi')), ['ic_launcher.webp'], `${label}: res untouched`);
    if (label !== 'no latest.json') assert.match(r.stdout, /::warning::/, `${label}: a bad logo is reported, never silent`);
  }
});

test('a broken Android project is a build error (exit 2), not a silent generic icon', opts, async t => {
  const root = await project(t, { latest: { name: 'a.png', stamp: 'l1' }, picture: r => make(r, 'a.png', 'Image.new("RGB", (64, 64), (1, 1, 1)).save(root + "/app-logo-pic/" + name)') });
  const r = spawnSync('python3', [script, '--repo', root, '--res', join(root, 'nope'), '--manifest', join(root, 'android/app/src/main/AndroidManifest.xml')], { encoding: 'utf8' });
  assert.equal(r.status, 2, r.stdout + r.stderr);
});

test('BUG #20: an animated logo still loads on Pillow without Image.Transpose (older than 9.1)', opts, async t => {
  const root = await project(t, {});
  const gif = join(root, 'anim.gif');
  py('import sys\nfrom PIL import Image\na = Image.new("RGB", (8, 8), (255, 0, 0)); b = Image.new("RGB", (8, 8), (0, 255, 0))\na.save(sys.argv[1], save_all=True, append_images=[b], duration=50, loop=0)', gif);
  // load the real script, remove Image.Transpose (as on Pillow < 9.1), then load the animated GIF
  const out = py('import sys, importlib.util\nfrom PIL import Image\nif hasattr(Image, "Transpose"): del Image.Transpose\nspec = importlib.util.spec_from_file_location("logo", sys.argv[1]); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)\nim = m.load_picture(__import__("pathlib").Path(sys.argv[2]))\nprint(im.size)', script, gif);
  assert.equal(out, '(8, 8)');
});
