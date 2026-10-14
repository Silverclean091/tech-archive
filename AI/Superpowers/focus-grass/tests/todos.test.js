import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addTodo, toggleTodo, editTodo, removeTodo,
  completionStats, completionRate, MAX_TEXT_LENGTH,
} from '../js/todos.js';

const K = '2026-10-13';

test('addTodo adds a trimmed, not-done item and does not mutate the input', () => {
  const days = {};
  const next = addTodo(days, K, '  보고서 쓰기  ', 'a1');
  assert.deepEqual(next, { [K]: [{ id: 'a1', text: '보고서 쓰기', done: false }] });
  assert.deepEqual(days, {});
});

test('addTodo appends to an existing day', () => {
  const days = { [K]: [{ id: 'a1', text: 'one', done: false }] };
  const next = addTodo(days, K, 'two', 'a2');
  assert.deepEqual(next[K].map((t) => t.id), ['a1', 'a2']);
  assert.equal(days[K].length, 1);
});

test('addTodo ignores empty and whitespace-only text', () => {
  const days = {};
  assert.equal(addTodo(days, K, ''), days);
  assert.equal(addTodo(days, K, '   \n\t '), days);
  assert.equal(addTodo(days, K, undefined), days);
});

test('addTodo caps very long text', () => {
  const next = addTodo({}, K, '가'.repeat(10_000), 'a1');
  assert.equal(next[K][0].text.length, MAX_TEXT_LENGTH);
});

test('addTodo never cuts an emoji in half when capping the length', () => {
  const text = addTodo({}, K, '😀'.repeat(300), 'a1')[K][0].text;
  assert.equal(Array.from(text).length, MAX_TEXT_LENGTH);
  assert.equal(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(text), false);
});

test('addTodo keeps markup as plain text (rendering must use textContent)', () => {
  const text = '<img src=x onerror=alert(1)>';
  assert.equal(addTodo({}, K, text, 'a1')[K][0].text, text);
});

test('toggleTodo flips done only for the matching id', () => {
  const days = { [K]: [{ id: 'a1', text: 'x', done: false }, { id: 'a2', text: 'y', done: false }] };
  const next = toggleTodo(days, K, 'a2');
  assert.deepEqual(next[K].map((t) => t.done), [false, true]);
  assert.equal(days[K][1].done, false);
  assert.equal(toggleTodo(next, K, 'a2')[K][1].done, false);
});

test('toggleTodo on an unknown date or id changes nothing', () => {
  const days = { [K]: [{ id: 'a1', text: 'x', done: false }] };
  assert.equal(toggleTodo(days, '2026-01-01', 'a1'), days);
  assert.deepEqual(toggleTodo(days, K, 'nope'), days);
});

test('editTodo changes text, trims it, ignores empty text', () => {
  const days = { [K]: [{ id: 'a1', text: 'old', done: true }] };
  assert.deepEqual(editTodo(days, K, 'a1', '  new ')[K][0], { id: 'a1', text: 'new', done: true });
  assert.equal(editTodo(days, K, 'a1', '   '), days);
});

test('removeTodo removes the item and drops the date key when it was the last', () => {
  const days = { [K]: [{ id: 'a1', text: 'x', done: false }, { id: 'a2', text: 'y', done: false }] };
  const one = removeTodo(days, K, 'a1');
  assert.deepEqual(one[K].map((t) => t.id), ['a2']);
  const none = removeTodo(one, K, 'a2');
  assert.equal(K in none, false);
  assert.equal(days[K].length, 2);
});

test('completionStats handles empty, partial and full lists', () => {
  assert.deepEqual(completionStats([]), { done: 0, total: 0, rate: null });
  assert.deepEqual(completionStats(undefined), { done: 0, total: 0, rate: null });
  const list = [{ done: true }, { done: false }, { done: true }, { done: true }];
  assert.deepEqual(completionStats(list), { done: 3, total: 4, rate: 0.75 });
  assert.equal(completionRate([{ done: true }]), 1);
  assert.equal(completionRate([]), null);
});
