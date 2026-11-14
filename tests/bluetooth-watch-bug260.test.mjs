// BUG-260: the Bluetooth watcher must look at EVERY device of a callback batch and key devices by Android device id (not by name).
// GUARD test (source text): AudioDeviceCallback needs a phone / the GitHub build; the behaviour itself is checked on a device.
import test from 'node:test'; import assert from 'node:assert/strict'; import { readFileSync } from 'node:fs';
const j = readFileSync(new URL('../native-android/LiquidNative.java', import.meta.url), 'utf8');
const watch = /private void btWatch\(\) \{([\s\S]*?)\n  \}\n/.exec(j)[1];
test('GUARD BUG-260: added / removed callbacks loop over every device and use the device id key', () => {
  assert.match(watch, /for \(AudioDeviceInfo \w+ : added\)/); assert.match(watch, /for \(AudioDeviceInfo \w+ : gone\)/);
  assert.match(watch, /btKnown\.add\(btKey\(/); assert.match(watch, /btKnown\.remove\(btKey\(/);
  assert.doesNotMatch(watch, /optJSONObject\(0\)/);
});
test('GUARD BUG-260: the key is the device id and getBluetooth seeds btKnown with ids, not names', () => {
  assert.match(j, /static String btKey\(AudioDeviceInfo d\) \{ return String\.valueOf\(d\.getId\(\)\); \}/);
  assert.doesNotMatch(j, /btKnown\.add\(l\.optJSONObject/);
});
