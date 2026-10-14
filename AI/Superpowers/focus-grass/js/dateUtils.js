const KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const pad = (n) => String(n).padStart(2, '0');

export function toKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function fromKey(key) {
  if (typeof key !== 'string' || !KEY_RE.test(key)) return null;
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return toKey(date) === key ? date : null;
}

export function isDateKey(key) {
  return fromKey(key) !== null;
}

export function addDays(date, n) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
}

export function buildHeatmapGrid(today, weeks = 53) {
  const todayKey = toKey(today);
  const lastSunday = addDays(today, -today.getDay());
  const first = addDays(lastSunday, -7 * (weeks - 1));
  const grid = [];
  for (let w = 0; w < weeks; w += 1) {
    const week = [];
    for (let d = 0; d < 7; d += 1) {
      const key = toKey(addDays(first, w * 7 + d));
      week.push({ key, isFuture: key > todayKey });
    }
    grid.push(week);
  }
  return grid;
}

export function canSelect(key, todayKey) {
  return isDateKey(key) && key <= todayKey;
}

export function followToday(selectedKey, prevTodayKey, newTodayKey) {
  return selectedKey === prevTodayKey ? newTodayKey : selectedKey;
}
