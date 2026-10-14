import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  toKey, fromKey, isDateKey, addDays, buildHeatmapGrid, canSelect, followToday,
} from '../js/dateUtils.js';

test('toKey uses the local calendar date, zero-padded', () => {
  assert.equal(toKey(new Date(2026, 0, 1, 0, 0, 0)), '2026-01-01');
  assert.equal(toKey(new Date(2026, 11, 31, 23, 59, 59)), '2026-12-31');
  assert.equal(toKey(new Date(2026, 8, 5, 12)), '2026-09-05');
});

test('fromKey round-trips valid keys and rejects invalid ones', () => {
  const d = fromKey('2026-10-13');
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 9);
  assert.equal(d.getDate(), 13);
  assert.equal(fromKey('2026-02-30'), null);
  assert.equal(fromKey('2026-13-01'), null);
  assert.equal(fromKey('abc'), null);
  assert.equal(fromKey(undefined), null);
  assert.equal(isDateKey('2026-10-13'), true);
  assert.equal(isDateKey('2026-1-3'), false);
});

test('addDays moves by calendar days across month and year ends', () => {
  assert.equal(toKey(addDays(new Date(2026, 0, 31), 1)), '2026-02-01');
  assert.equal(toKey(addDays(new Date(2026, 0, 1), -1)), '2025-12-31');
});

test('buildHeatmapGrid: 53 weeks x 7 days ending in the week of today', () => {
  const today = new Date(2026, 9, 13); // Tuesday
  const grid = buildHeatmapGrid(today);
  assert.equal(grid.length, 53);
  assert.ok(grid.every((week) => week.length === 7));
  assert.equal(grid[0][0].key, '2025-10-12'); // a Sunday, 52 weeks before 2026-10-11
  assert.equal(grid[52][0].key, '2026-10-11');
  assert.deepEqual(grid[52][2], { key: '2026-10-13', isFuture: false });
  assert.equal(grid[52][3].isFuture, true);
  assert.equal(grid.flat().filter((c) => c.isFuture).length, 4);
});

test('buildHeatmapGrid: when today is Sunday the rest of the week is future', () => {
  const grid = buildHeatmapGrid(new Date(2026, 9, 11));
  assert.equal(grid[52][0].isFuture, false);
  assert.equal(grid.flat().filter((c) => c.isFuture).length, 6);
});

test('buildHeatmapGrid: every cell is a distinct day (no DST duplicates)', () => {
  const keys = buildHeatmapGrid(new Date(2026, 2, 30)).flat().map((c) => c.key);
  assert.equal(new Set(keys).size, 53 * 7);
});

test('canSelect allows today and the past, rejects future and garbage', () => {
  assert.equal(canSelect('2026-10-13', '2026-10-13'), true);
  assert.equal(canSelect('2026-10-12', '2026-10-13'), true);
  assert.equal(canSelect('2026-10-14', '2026-10-13'), false);
  assert.equal(canSelect('garbage', '2026-10-13'), false);
  assert.equal(canSelect(undefined, '2026-10-13'), false);
});

test('followToday moves a user who was on today, leaves a past view alone', () => {
  assert.equal(followToday('2026-10-13', '2026-10-13', '2026-10-14'), '2026-10-14');
  assert.equal(followToday('2026-10-01', '2026-10-13', '2026-10-14'), '2026-10-01');
});
