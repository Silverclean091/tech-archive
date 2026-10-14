export const MAX_TEXT_LENGTH = 200;

export function makeId() {
  return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
}

// 앞뒤 공백을 지우고 최대 길이로 자른다. 이모지 등 서로게이트 쌍이 반으로 잘리지 않도록
// UTF-16 단위가 아닌 문자(코드포인트) 단위로 센다.
export function clipText(text) {
  return Array.from(String(text ?? '').trim()).slice(0, MAX_TEXT_LENGTH).join('');
}

export function addTodo(days, key, text, id = makeId()) {
  const value = clipText(text);
  if (!value) return days;
  return { ...days, [key]: [...(days[key] ?? []), { id, text: value, done: false }] };
}

export function toggleTodo(days, key, id) {
  const list = days[key];
  if (!list) return days;
  return { ...days, [key]: list.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) };
}

export function editTodo(days, key, id, text) {
  const value = clipText(text);
  const list = days[key];
  if (!value || !list) return days;
  return { ...days, [key]: list.map((t) => (t.id === id ? { ...t, text: value } : t)) };
}

export function removeTodo(days, key, id) {
  const list = days[key];
  if (!list) return days;
  const next = list.filter((t) => t.id !== id);
  const { [key]: _removed, ...rest } = days;
  return next.length === 0 ? rest : { ...rest, [key]: next };
}

export function completionStats(list = []) {
  const total = list.length;
  const done = list.filter((t) => t.done).length;
  return { done, total, rate: total === 0 ? null : done / total };
}

export function completionRate(list) {
  return completionStats(list).rate;
}
