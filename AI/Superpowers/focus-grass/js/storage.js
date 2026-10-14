import { isDateKey } from './dateUtils.js';
import { clipText } from './todos.js';
import { defaultSettings, LIMITS, isValidMinutes } from './settings.js';

export const TODOS_KEY = 'ffg:todos';
export const SETTINGS_KEY = 'ffg:settings';

// 접근과 읽기만 확인한다. 쓰기 점검(setItem)을 하면 저장소가 가득 찬 경우에 읽기까지 포기하게 된다.
export function pickBackend(getStorage = () => window.localStorage) {
  try {
    const backend = getStorage();
    if (!backend) return null;
    backend.getItem('__ffg_probe__');
    return backend;
  } catch {
    return null;
  }
}

export function createStorage(backend) {
  const memory = new Map();
  const unsaved = new Set(); // 저장소에 쓰지 못하고 메모리에만 있는 키
  return {
    // 다른 탭이 저장소를 바꿨을 때, 이 탭의 메모리 사본을 버리고 다음 read 가 저장소를 다시 읽게 한다.
    invalidate(key) {
      if (!backend) return;
      memory.delete(key);
      unsaved.delete(key);
    },
    read(key) {
      if (memory.has(key)) return memory.get(key);
      try {
        const raw = backend?.getItem(key);
        return raw == null ? null : JSON.parse(raw);
      } catch {
        return null;
      }
    },
    write(key, value) {
      memory.set(key, value);
      try {
        if (!backend) throw new Error('no backend');
        backend.setItem(key, JSON.stringify(value));
        unsaved.delete(key);
        return true;
      } catch {
        unsaved.add(key);
        return false;
      }
    },
    // 저장소가 있고, 메모리에만 남은 데이터가 없을 때만 true (한 번 실패해도 이후 저장이 성공하면 회복)
    isPersistent: () => Boolean(backend) && unsaved.size === 0,
  };
}

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// 같은 날짜 안에서 id 가 겹치면 뒤쪽 항목에 새 id 를 준다 (토글·삭제가 둘을 함께 건드리지 않게)
function uniqueId(id, used) {
  let candidate = id;
  let n = 1;
  while (used.has(candidate)) {
    candidate = `${id}~${n}`;
    n += 1;
  }
  used.add(candidate);
  return candidate;
}

export function normalizeTodos(raw) {
  const days = {};
  if (isPlainObject(raw) && isPlainObject(raw.days)) {
    for (const [key, list] of Object.entries(raw.days)) {
      if (!isDateKey(key) || !Array.isArray(list)) continue;
      const usedIds = new Set();
      const items = [];
      for (const t of list) {
        if (!isPlainObject(t) || typeof t.id !== 'string' || typeof t.text !== 'string') continue;
        const text = clipText(t.text);
        if (!text) continue; // 앱에서는 추가할 수 없는 빈 항목
        items.push({ id: uniqueId(t.id, usedIds), text, done: t.done === true });
      }
      if (items.length > 0) days[key] = items;
    }
  }
  return { version: 1, days };
}

export function normalizeSettings(raw) {
  const out = defaultSettings();
  if (!isPlainObject(raw)) return out;
  if (isValidMinutes(raw.focusMin, LIMITS.focusMin)) out.focusMin = raw.focusMin;
  if (isValidMinutes(raw.breakMin, LIMITS.breakMin)) out.breakMin = raw.breakMin;
  for (const flag of ['autoSwitch', 'soundOn', 'notifyOn']) {
    if (typeof raw[flag] === 'boolean') out[flag] = raw[flag];
  }
  if (isPlainObject(raw.pomodoroCount)) {
    for (const [key, n] of Object.entries(raw.pomodoroCount)) {
      if (isDateKey(key) && Number.isInteger(n) && n >= 0) out.pomodoroCount[key] = n;
    }
  }
  return out;
}

export const loadTodos = (storage) => normalizeTodos(storage.read(TODOS_KEY));
export const saveTodos = (storage, doc) => storage.write(TODOS_KEY, doc);
export const loadSettings = (storage) => normalizeSettings(storage.read(SETTINGS_KEY));
export const saveSettings = (storage, settings) => storage.write(SETTINGS_KEY, settings);
