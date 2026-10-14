import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SETTINGS, defaultSettings, LIMITS, isValidMinutes, validateDurations,
} from '../js/settings.js';

test('defaults are 25/5 with auto-switch off and sound/notify on', () => {
  assert.equal(DEFAULT_SETTINGS.focusMin, 25);
  assert.equal(DEFAULT_SETTINGS.breakMin, 5);
  assert.equal(DEFAULT_SETTINGS.autoSwitch, false);
  assert.equal(DEFAULT_SETTINGS.soundOn, true);
  assert.equal(DEFAULT_SETTINGS.notifyOn, true);
  assert.equal(DEFAULT_SETTINGS.version, 1);
});

test('defaultSettings returns an independent copy', () => {
  const a = defaultSettings();
  a.pomodoroCount['2026-10-13'] = 3;
  assert.deepEqual(defaultSettings().pomodoroCount, {});
});

test('isValidMinutes accepts only integers inside the inclusive range', () => {
  assert.equal(isValidMinutes(1, LIMITS.focusMin), true);
  assert.equal(isValidMinutes(120, LIMITS.focusMin), true);
  assert.equal(isValidMinutes(0, LIMITS.focusMin), false);
  assert.equal(isValidMinutes(121, LIMITS.focusMin), false);
  assert.equal(isValidMinutes(60, LIMITS.breakMin), true);
  assert.equal(isValidMinutes(61, LIMITS.breakMin), false);
  assert.equal(isValidMinutes(25.5, LIMITS.focusMin), false);
  assert.equal(isValidMinutes(NaN, LIMITS.focusMin), false);
  assert.equal(isValidMinutes('25', LIMITS.focusMin), false);
});

test('validateDurations accepts form strings and returns numbers', () => {
  const r = validateDurations({ focusMin: '50', breakMin: ' 10 ' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.values, { focusMin: 50, breakMin: 10 });
  assert.deepEqual(r.errors, {});
});

test('validateDurations rejects empty, text, zero, decimal and too-large input per field', () => {
  for (const bad of ['', '   ', 'abc', '0', '25.5', '121', '-5']) {
    const r = validateDurations({ focusMin: bad, breakMin: '5' });
    assert.equal(r.ok, false, `focusMin=${JSON.stringify(bad)}`);
    assert.ok(r.errors.focusMin, `focusMin error for ${JSON.stringify(bad)}`);
    assert.equal(r.errors.breakMin, undefined);
    assert.equal(r.values.breakMin, 5);
  }
  const r = validateDurations({ focusMin: '25', breakMin: '61' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.breakMin);
  assert.equal(r.errors.focusMin, undefined);
});

test('validateDurations only accepts plain digits (no exponent, hex, sign or decimal forms)', () => {
  for (const bad of ['1e1', '0x10', '0b11', '+5', '10.0', '25.', '٣', '５']) {
    const r = validateDurations({ focusMin: bad, breakMin: '5' });
    assert.equal(r.ok, false, `focusMin=${JSON.stringify(bad)}`);
    assert.ok(r.errors.focusMin);
  }
  assert.equal(validateDurations({ focusMin: '007', breakMin: ' 5 ' }).ok, true);
});

test('validateDurations reports both fields when both are bad', () => {
  const r = validateDurations({ focusMin: 'x', breakMin: '' });
  assert.deepEqual(Object.keys(r.errors).sort(), ['breakMin', 'focusMin']);
  assert.deepEqual(r.values, {});
});
