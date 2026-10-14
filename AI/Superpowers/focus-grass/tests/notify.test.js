import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { showNotification } from '../js/notify.js';

const saved = { window: globalThis.window, Notification: globalThis.Notification };

afterEach(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete globalThis[key];
    else globalThis[key] = value;
  }
});

function stubNotification(Impl) {
  globalThis.Notification = Impl;
  globalThis.window = { Notification: Impl };
}

test('showNotification shows the notification when permission is granted', () => {
  const shown = [];
  class Ok {
    static permission = 'granted';
    constructor(title, options) { shown.push([title, options.body]); }
  }
  stubNotification(Ok);
  assert.equal(showNotification('집중 끝!', '5분 휴식하세요'), true);
  assert.deepEqual(shown, [['집중 끝!', '5분 휴식하세요']]);
});

test('showNotification returns false instead of throwing when the constructor throws (Android Chrome)', () => {
  class Illegal {
    static permission = 'granted';
    constructor() { throw new TypeError('Illegal constructor'); }
  }
  stubNotification(Illegal);
  assert.equal(showNotification('t', 'b'), false);
});

test('showNotification does nothing without permission or without Notification support', () => {
  class Denied {
    static permission = 'denied';
    constructor() { throw new Error('must not be called'); }
  }
  stubNotification(Denied);
  assert.equal(showNotification('t', 'b'), false);
  globalThis.window = {};
  assert.equal(showNotification('t', 'b'), false);
});
