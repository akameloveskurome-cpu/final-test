import test from 'node:test';
import assert from 'node:assert/strict';
import { SLEEP_MINUTES, SLEEP_MAX, cleanMinutes, parseSleepInput, fmtMinutes, fmtLeft, fmtLeftMs, pillText, setText } from '../src/sleep.js';

test('quick choices are 15 / 30 / 45 / 60; v148: cleanMinutes accepts any whole number of minutes from 1 to 24 hours (custom timing)', () => {
  assert.deepEqual(SLEEP_MINUTES, [5, 10, 15, 30, 45, 60]); assert.equal(SLEEP_MAX, 1440);
  for (const m of [...SLEEP_MINUTES, 1, 14, 61, 90, 1440]) assert.equal(cleanMinutes(m), m);
  for (const bad of [0, -15, 1441, 1.5, '30', null, undefined, NaN]) assert.equal(cleanMinutes(bad), 0);
});
test('parseSleepInput: minutes, h:mm, 1h30, 2h, 1.5h; junk and out-of-range = 0', () => {
  for (const [x, m] of [['90', 90], [' 45 min ', 45], ['1:30', 90], ['0:45', 45], ['1h30', 90], ['1h 30m', 90], ['2h', 120], ['1.5h', 90], ['1,5 h', 90], ['24:00', 1440], ['1', 1]]) assert.equal(parseSleepInput(x), m, x);
  for (const bad of ['', '  ', 'abc', '0', '-5', '25:00', '1441', '1:99x', '12.5', null, undefined]) assert.equal(parseSleepInput(bad), 0, String(bad));
});
test('fmtMinutes + setText for long custom times', () => {
  assert.equal(fmtMinutes(90), '1 h 30 min'); assert.equal(fmtMinutes(120), '2 h'); assert.equal(fmtMinutes(45), '45 min');
  assert.equal(setText(90, false), 'Sleep timer: 1 h 30 min'); assert.equal(setText(60, false), 'Sleep timer: 60 minutes');
});
test('fmtLeft: m:ss, h:mm:ss, rounds UP, never negative or NaN', () => {
  assert.equal(fmtLeft(247000), '4:07');
  assert.equal(fmtLeft(3729000), '1:02:09');
  assert.equal(fmtLeft(60000), '1:00');
  assert.equal(fmtLeft(1), '0:01');            // 1 ms left must not show 0:00
  assert.equal(fmtLeft(0), '0:00');
  assert.equal(fmtLeft(-5000), '0:00');
  assert.equal(fmtLeft(undefined), '0:00');
  assert.equal(fmtLeft('abc'), '0:00');
});
test('pillText: empty when off, countdown in minutes mode, fixed text for end of song', () => {
  assert.equal(pillText(null, 0), ''); assert.equal(pillText({ active: false }, 0), '');
  assert.equal(pillText({ active: true, endOfSong: false, endsAt: 100000 }, 40000), '1:00');
  assert.equal(pillText({ active: true, endOfSong: false, endsAt: 100000 }, 200000), '0:00');
  assert.equal(pillText({ active: true, endOfSong: true, endsAt: 0 }, 5), 'Stops after this song');
});
test('setText', () => { assert.equal(setText(30, false), 'Sleep timer: 30 minutes'); assert.equal(setText(0, true), 'Music will stop after this song'); });
test('fmtLeftMs: millisecond precision, rounds up, never negative', () => {
  assert.equal(fmtLeftMs(247350), '4:07.350'); assert.equal(fmtLeftMs(3729005), '1:02:09.005');
  assert.equal(fmtLeftMs(60000), '1:00.000'); assert.equal(fmtLeftMs(1), '0:00.001'); assert.equal(fmtLeftMs(0), '0:00.000');
  assert.equal(fmtLeftMs(-5), '0:00.000'); assert.equal(fmtLeftMs('abc'), '0:00.000');
  assert.equal(pillText({ active: true, endOfSong: false, endsAt: 100000 }, 39750, true), '1:00.250');
});
