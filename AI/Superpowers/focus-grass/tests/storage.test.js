import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TODOS_KEY, SETTINGS_KEY, createStorage, normalizeTodos, normalizeSettings,
  loadTodos, saveTodos, loadSettings, saveSettings, pickBackend,
} from '../js/storage.js';

function fakeBackend(initial = {}) {
  const store = { ...initial };
  return {
    store,
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = v; },
  };
}

function brokenBackend() {
  return {
    getItem() { throw new Error('denied'); },
    setItem() { throw new Error('quota'); },
  };
}

test('todos round-trip through the backend as JSON', () => {
  const backend = fakeBackend();
  const doc = { version: 1, days: { '2026-10-13': [{ id: 'a', text: 'x', done: true }] } };
  assert.equal(saveTodos(createStorage(backend), doc), true);
  assert.deepEqual(JSON.parse(backend.store[TODOS_KEY]), doc);
  assert.deepEqual(loadTodos(createStorage(backend)), doc);
});

test('missing data yields empty todos and default settings', () => {
  const s = createStorage(fakeBackend());
  assert.deepEqual(loadTodos(s), { version: 1, days: {} });
  assert.equal(loadSettings(s).focusMin, 25);
});

test('corrupted JSON falls back to empty values instead of throwing', () => {
  const backend = fakeBackend({ [TODOS_KEY]: '{not json', [SETTINGS_KEY]: '][' });
  const s = createStorage(backend);
  assert.deepEqual(loadTodos(s), { version: 1, days: {} });
  assert.equal(loadSettings(s).breakMin, 5);
});

test('valid JSON of the wrong type is treated as empty', () => {
  for (const raw of ['null', '[]', '42', '"x"', 'true']) {
    const s = createStorage(fakeBackend({ [TODOS_KEY]: raw, [SETTINGS_KEY]: raw }));
    assert.deepEqual(loadTodos(s), { version: 1, days: {} }, raw);
    assert.equal(loadSettings(s).focusMin, 25, raw);
  }
});

test('normalizeTodos drops malformed days and items but keeps the good ones', () => {
  const doc = normalizeTodos({
    version: 1,
    days: {
      '2026-10-13': [
        { id: 'a', text: 'ok', done: true },
        { id: 5, text: 'bad id' },
        null,
        { id: 'b', text: 'no done flag' },
        'string',
      ],
      'not-a-date': [{ id: 'z', text: 'x', done: false }],
      '2026-10-14': 'oops',
      '2026-10-15': [],
    },
  });
  assert.deepEqual(doc, {
    version: 1,
    days: {
      '2026-10-13': [
        { id: 'a', text: 'ok', done: true },
        { id: 'b', text: 'no done flag', done: false },
      ],
    },
  });
});

test('normalizeTodos drops blank items that could never have been added', () => {
  const doc = normalizeTodos({
    days: {
      '2026-10-13': [
        { id: 'a', text: '   ', done: false },
        { id: 'b', text: '', done: true },
        { id: 'c', text: 'real', done: false },
      ],
      '2026-10-14': [{ id: 'd', text: '\n\t', done: false }],
    },
  });
  assert.deepEqual(doc, { version: 1, days: { '2026-10-13': [{ id: 'c', text: 'real', done: false }] } });
});

test('normalizeTodos gives duplicate ids within a day unique ids and keeps every item', () => {
  const doc = normalizeTodos({
    days: {
      '2026-10-13': [
        { id: 'x', text: 'first', done: false },
        { id: 'x', text: 'second', done: true },
        { id: 'x', text: 'third', done: false },
      ],
    },
  });
  const items = doc.days['2026-10-13'];
  assert.deepEqual(items.map((t) => t.text), ['first', 'second', 'third']);
  assert.equal(new Set(items.map((t) => t.id)).size, 3);
  assert.equal(items[0].id, 'x');
});

test('normalizeTodos rejects a days value that is not a plain object', () => {
  assert.deepEqual(normalizeTodos({ version: 1, days: [] }), { version: 1, days: {} });
  assert.deepEqual(normalizeTodos({ version: 1, days: 'x' }), { version: 1, days: {} });
});

test('normalizeSettings replaces out-of-range or mistyped fields with defaults', () => {
  const s = normalizeSettings({
    focusMin: 0,
    breakMin: 'x',
    autoSwitch: 'yes',
    soundOn: false,
    pomodoroCount: { '2026-10-13': -1, '2026-10-14': 2.5, '2026-10-15': 3, bad: 1 },
  });
  assert.equal(s.focusMin, 25);
  assert.equal(s.breakMin, 5);
  assert.equal(s.autoSwitch, false);
  assert.equal(s.soundOn, false);
  assert.equal(s.notifyOn, true);
  assert.deepEqual(s.pomodoroCount, { '2026-10-15': 3 });
});

test('normalizeSettings keeps valid saved values', () => {
  const s = normalizeSettings({ focusMin: 50, breakMin: 10, autoSwitch: true, notifyOn: false });
  assert.equal(s.focusMin, 50);
  assert.equal(s.breakMin, 10);
  assert.equal(s.autoSwitch, true);
  assert.equal(s.notifyOn, false);
});

test('with no backend, data lives in memory and storage reports not persistent', () => {
  const s = createStorage(null);
  assert.equal(s.isPersistent(), false);
  s.write('k', { a: 1 });
  assert.deepEqual(s.read('k'), { a: 1 });
});

test('when the backend rejects writes, write returns false but the value is kept in memory', () => {
  const s = createStorage(brokenBackend());
  assert.equal(s.write('k', { a: 1 }), false);
  assert.equal(s.isPersistent(), false);
  assert.deepEqual(s.read('k'), { a: 1 });
});

test('isPersistent recovers once a failed key is saved successfully again', () => {
  let failing = true;
  const backend = {
    store: {},
    getItem(k) { return k in this.store ? this.store[k] : null; },
    setItem(k, v) { if (failing) throw new Error('quota'); this.store[k] = v; },
  };
  const s = createStorage(backend);
  assert.equal(s.write('a', 1), false);
  assert.equal(s.isPersistent(), false);
  failing = false;
  assert.equal(s.write('b', 2), true);
  assert.equal(s.isPersistent(), false, 'key "a" is still unsaved');
  assert.equal(s.write('a', 3), true);
  assert.equal(s.isPersistent(), true);
});

test('isPersistent never reports true without a backend, and invalidate clears an unsaved key', () => {
  const none = createStorage(null);
  none.write('k', 1);
  assert.equal(none.isPersistent(), false);

  const backend = {
    store: {},
    getItem(k) { return k in this.store ? this.store[k] : null; },
    setItem() { throw new Error('quota'); },
  };
  const s = createStorage(backend);
  s.write('k', 1);
  assert.equal(s.isPersistent(), false);
  s.invalidate('k'); // another tab's value replaces the unsaved local one
  assert.equal(s.isPersistent(), true);
});

test('a backend whose reads throw reads as empty', () => {
  const s = createStorage(brokenBackend());
  assert.equal(s.read('anything'), null);
  assert.equal(loadSettings(s).focusMin, 25);
});

test('pickBackend returns a readable backend even when writes would fail (quota full)', () => {
  const backend = { getItem: () => null, setItem() { throw new Error('quota'); } };
  assert.equal(pickBackend(() => backend), backend);
});

test('pickBackend returns null when storage cannot be accessed or read', () => {
  assert.equal(pickBackend(() => { throw new Error('blocked'); }), null);
  assert.equal(pickBackend(() => ({ getItem() { throw new Error('denied'); } })), null);
  assert.equal(pickBackend(() => undefined), null);
});

test('existing data stays readable when the backend is full, and the app falls back to memory', () => {
  const stored = { version: 1, days: { '2026-10-01': [{ id: 'a', text: 'old', done: true }] } };
  const backend = {
    store: { [TODOS_KEY]: JSON.stringify(stored) },
    getItem(k) { return k in this.store ? this.store[k] : null; },
    setItem() { throw new Error('quota'); },
  };
  const s = createStorage(pickBackend(() => backend));
  assert.equal(loadTodos(s).days['2026-10-01'][0].text, 'old');
  assert.equal(saveTodos(s, { version: 1, days: {} }), false);
  assert.equal(s.isPersistent(), false);
});

test('invalidate drops the cached value so another tab\'s write becomes visible', () => {
  const backend = fakeBackend();
  const s = createStorage(backend);
  s.write('k', { v: 1 });
  backend.store.k = JSON.stringify({ v: 2 }); // written by another tab
  assert.deepEqual(s.read('k'), { v: 1 }); // still the cached copy
  s.invalidate('k');
  assert.deepEqual(s.read('k'), { v: 2 });
});

test('invalidate never discards data when there is no backend to re-read from', () => {
  const s = createStorage(null);
  s.write('k', { a: 1 });
  s.invalidate('k');
  assert.deepEqual(s.read('k'), { a: 1 });
});

test('settings round-trip', () => {
  const backend = fakeBackend();
  const s = createStorage(backend);
  const settings = { ...loadSettings(s), focusMin: 30, pomodoroCount: { '2026-10-13': 2 } };
  assert.equal(saveSettings(s, settings), true);
  assert.deepEqual(loadSettings(createStorage(backend)), settings);
});
