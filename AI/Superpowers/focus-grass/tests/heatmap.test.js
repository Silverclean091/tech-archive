import { test } from 'node:test';
import assert from 'node:assert/strict';
import { levelFor, cellInfo, tooltipText } from '../js/heatmap.js';

test('levelFor maps rate boundaries to 5 levels plus "no record"', () => {
  assert.equal(levelFor(null), -1);
  assert.equal(levelFor(undefined), -1);
  assert.equal(levelFor(0), 0);
  assert.equal(levelFor(0.01), 1);
  assert.equal(levelFor(0.25), 1);
  assert.equal(levelFor(0.26), 2);
  assert.equal(levelFor(0.5), 2);
  assert.equal(levelFor(0.51), 3);
  assert.equal(levelFor(0.99), 3);
  assert.equal(levelFor(1), 4);
});

test('cellInfo distinguishes a day with no record from a day with 0% done', () => {
  const days = {
    '2026-10-12': [{ id: 'a', text: 'x', done: false }],
    '2026-10-13': [{ id: 'a', text: 'x', done: true }, { id: 'b', text: 'y', done: false }],
  };
  assert.deepEqual(cellInfo('2026-10-11', days), { level: -1, done: 0, total: 0, rate: null });
  assert.equal(cellInfo('2026-10-12', days).level, 0);
  assert.deepEqual(cellInfo('2026-10-13', days), { level: 2, done: 1, total: 2, rate: 0.5 });
});

test('tooltipText shows month/day, counts and rounded percent', () => {
  assert.equal(
    tooltipText('2026-10-12', { level: 3, done: 3, total: 4, rate: 0.75 }),
    '10/12 · 3/4 완료 (75%)',
  );
  assert.equal(
    tooltipText('2026-01-05', { level: 1, done: 1, total: 3, rate: 1 / 3 }),
    '01/05 · 1/3 완료 (33%)',
  );
  assert.equal(
    tooltipText('2026-10-11', { level: -1, done: 0, total: 0, rate: null }),
    '10/11 · 기록 없음',
  );
});
