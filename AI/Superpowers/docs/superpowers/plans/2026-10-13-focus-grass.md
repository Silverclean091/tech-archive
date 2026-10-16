# Focus & Grass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 할 일 체크리스트, 완료율 기반 GitHub 잔디형 히트맵, 포모도로 타이머를 한 페이지에 제공하는 개인용 웹앱을 만든다.

**Architecture:** 빌드 도구 없는 바닐라 ES 모듈 앱. 규칙을 가진 로직(`dateUtils`, `todos`, `settings`, `pomodoro`, 히트맵 레벨 계산, `storage` 정규화)은 DOM을 모르는 순수 모듈로 만들어 `node --test`로 테스트하고, `ui/`와 `main.js`는 렌더링과 이벤트 연결만 맡는다. 데이터는 `localStorage` 키 2개에 저장한다.

**Tech Stack:** HTML/CSS/JavaScript (ES modules), Node 18+ 내장 테스트 러너(`node --test`, 현재 환경은 v26), 로컬 정적 서버(`python3 -m http.server`).

**Spec:** `docs/superpowers/specs/2026-10-13-focus-grass-design.md`

**App root:** 스펙의 파일 구조(`index.html`, `css/`, `js/`, `tests/`)는 `AI/Superpowers/focus-grass/` 아래에 만든다. 이 문서의 모든 `focus-grass/...` 경로와 명령은 `AI/Superpowers/` 기준이다. 테스트는 항상 `AI/Superpowers/focus-grass`에서 `node --test`로 실행한다.

**스펙 대비 추가 파일 (스펙의 모듈 경계를 지키기 위한 것):** `js/settings.js`(기본값·입력 검증, 순수), `js/notify.js`(소리·알림, 브라우저 API 래퍼), `package.json`(ESM 선언과 테스트 스크립트), `README.md`, `tests/browser/*.html`(DOM 동작을 브라우저에서 확인하는 테스트 페이지), `serve.js`·`run.sh`·`run.bat`(Task 10: 의존성 없는 로컬 서버와 macOS/Windows 실행 스크립트).

**실행 방법 주의:** 브라우저는 `file://`로 연 페이지의 `<script type="module">`을 막는다(CORS). 따라서 앱은 더블클릭이 아니라 `focus-grass/`에서 `python3 -m http.server 8000`을 실행하고 `http://localhost:8000`으로 연다. 빌드 도구는 여전히 필요 없다. (Task 10에서 만드는 `run.sh`/`run.bat`으로 같은 일을 한 번에 할 수 있다. 이전 태스크의 확인 단계에서는 `python3 -m http.server`가 대신 쓰인 곳이 있으며, 어느 쪽이든 된다.)

## Global Constraints

- 저장소는 `localStorage` 키 2개: `"ffg:todos"`, `"ffg:settings"`. 모든 저장 객체에 `version` 필드(현재 `1`)를 둔다.
- 날짜 키는 UTC가 아닌 **로컬 날짜** `YYYY-MM-DD`. 비어 있는 날은 키를 만들지 않고, 마지막 항목을 삭제하면 키도 지운다.
- 히트맵은 최근 **53주 × 7요일**, 칸 하나가 하루. 색은 5단계(0% / ~25% / ~50% / ~75% / 100%)이고, 할 일이 없는 날은 "기록 없음" 색으로 따로 구분한다. 미래 날짜는 선택할 수 없다.
- 히트맵 색은 **완료율(완료 ÷ 전체)** 기준. 포모도로 횟수는 히트맵에 반영하지 않는다.
- 할 일 항목의 `id`는 날짜 내에서 고유. 지난 날짜도 수정 가능, 미래 날짜는 열 수 없다. 이월은 없다.
- 포모도로 기본값 집중 25분 / 휴식 5분. 설정 범위는 집중 정수 **1~120**분, 휴식 정수 **1~60**분. 범위를 벗어나면 저장하지 않고 입력 칸에 오류를 표시한다.
- 타이머는 `endAt = now + 남은시간` 방식이며 **250ms**마다 `endAt - now`로 화면을 갱신한다. `setInterval` 감소 방식은 쓰지 않는다. 상태 머신은 `now`를 인자로 받는 순수 함수다. 종료 시각에 맞춘 단발 `setTimeout`을 함께 걸어, 숨겨진 탭에서 주기 타이머가 늦어져도 알림이 늦지 않게 한다. 🍅는 세션이 끝났어야 하는 날(`endedAt`)에 센다.
- 타이머 화면은 값이 바뀐 곳만 DOM에 쓴다(대기·일시정지 중에는 쓰기 없음). 시작·일시정지·재개 버튼은 더블클릭의 두 번째 클릭(`detail > 1`)을 무시한다.
- 새로고침/탭 종료 시 진행 중인 타이머는 복원하지 않고 리셋한다. 집중 중 설정 변경은 다음 세션부터 적용한다.
- 알림은 소리(Web Audio API, 외부 파일 없음) + 브라우저 알림. 권한이 거부되면 소리와 탭 제목으로 대체한다. 소리는 "시작" 클릭 시점에 오디오 컨텍스트를 준비한다. 브라우저 알림 생성이 예외를 던져도 앱은 멈추지 않는다.
- 세션이 끝나면 탭 제목에 `✅ 집중 끝!` / `✅ 휴식 끝!`을 남기고, 다음 시작·리셋·탭 복귀 시 지운다.
- `localStorage`를 쓸 수 없거나 가득 차면 메모리에만 저장하고 "저장되지 않습니다" 배너를 표시한다. 저장소는 읽기만 확인해서 고르므로, 가득 차도 기존 기록은 읽힌다. 이후 저장이 성공하면 배너는 사라진다. 손상된 JSON은 빈 값으로 복구하고 앱은 계속 동작한다.
- 같은 앱을 여러 탭에서 열어도 서로의 저장을 덮어쓰지 않는다(`storage` 이벤트로 다시 불러온다).
- 날짜가 바뀌는 것은 1초 간격으로 확인한다. 오늘을 보던 화면은 새 오늘로 따라가고, 과거 날짜를 보던 화면은 그대로 둔다.
- 순수 모듈은 DOM과 `localStorage`를 모른다. `localStorage` 접근은 `storage.js`만 한다. `ui/`는 규칙을 갖지 않는다.
- 외부 의존성 없음(npm 패키지 설치 금지).

## Review Focus

스펙이 암시하지만 일반 테스트가 놓치기 쉬운 입력·실패 상황이다. 각 줄은 아래 표시된 태스크의 테스트로 고정한다.

1. **앱을 켜 둔 채 자정을 넘김** — "오늘"이 바뀌면 오늘을 보고 있던 사용자는 새 오늘로 따라가고, 과거 날짜를 보던 사용자는 그대로 남아야 한다. (Task 1 `followToday`, Task 9 `main.js`의 1초 폴링과 브라우저 테스트 R1)
2. **손상되었거나 모양이 틀린 저장 데이터** — `null`, `[]`, `42`, 깨진 JSON, 항목이 객체가 아닌 배열 등이 있어도 앱이 죽지 않고 해당 부분만 버려야 한다. (Task 4)
3. **잘못된 시간 입력** — 빈 칸, `abc`, `0`, `25.5`, `121`, `1e1`, `0x10`은 저장되지 않고 이전 값이 유지되며 칸별 오류가 나와야 한다. (Task 3, 브라우저 테스트 S1)
4. **공백뿐이거나 아주 긴 할 일, HTML이 섞인 할 일** — 공백뿐인 입력은 무시, 매우 긴 입력은 길이 제한, `<img onerror=...>` 같은 문자열은 마크업이 아닌 글자 그대로 보여야 한다. (Task 2 테스트 + Task 9 수동 확인)
5. **타이머 버튼 연타·상태에 맞지 않는 조작** — 실행 중 "시작" 재클릭이 타이머를 재시작하면 안 되고, 더블클릭의 두 번째 클릭이 같은 자리의 "일시정지"를 눌러서는 안 되며, idle에서 일시정지/재개, 일시정지 중 리셋, 탭 절전 후 늦게 온 틱은 🍅를 한 번만 올려야 한다. (Task 6, 브라우저 테스트 D1)

---

## 파일 구조

```
AI/Superpowers/focus-grass/
  package.json
  README.md
  index.html
  css/style.css
  serve.js           # 로컬 정적 서버 (macOS / Windows / Linux 공통)
  run.sh             # macOS / Linux / Git Bash 실행 래퍼
  run.bat            # Windows 실행 래퍼
  js/
    dateUtils.js     # 로컬 날짜 키, 53주 격자, 선택 가능 판별, 자정 이동     [순수]
    todos.js         # 추가/토글/수정/삭제, 완료 통계                        [순수]
    settings.js      # 기본값, 시간 입력 검증(숫자만)                         [순수]
    storage.js       # localStorage 선택·래퍼 + 데이터 정규화 + 메모리 폴백 + 다른 탭 변경 반영
    heatmap.js       # 완료율→레벨, 툴팁 문구[순수] + DOM 렌더링
    pomodoro.js      # 타이머 상태 머신, 시간 포맷, 탭 제목 문구               [순수]
    notify.js        # 소리, 브라우저 알림(예외 안전), 탭 제목 쓰기
    main.js          # 부팅, 상태 보관, 모듈 연결
    ui/
      todoList.js
      timerView.js
      settingsView.js
  tests/
    dateUtils.test.js
    todos.test.js
    settings.test.js
    storage.test.js
    heatmap.test.js
    pomodoro.test.js
    notify.test.js
    serve.test.js
    browser/
      ui-smoke.html      # 브라우저 DOM 테스트 (체크리스트·히트맵·다중 탭·더블클릭·설정·자정)
      timer-smoke.html   # 브라우저 타이머 테스트 (실제 시간 약 4분)
```

---

### Task 1: 프로젝트 골격과 `dateUtils`

**Files:**
- Create: `focus-grass/package.json`
- Create: `focus-grass/js/dateUtils.js`
- Test: `focus-grass/tests/dateUtils.test.js`

**Interfaces:**
- Consumes: 없음
- Produces (`js/dateUtils.js`):
  - `toKey(date: Date): string` — 로컬 날짜 `YYYY-MM-DD`
  - `fromKey(key: string): Date | null` — 로컬 자정의 Date, 형식·달력이 틀리면 `null`
  - `isDateKey(key: unknown): boolean`
  - `addDays(date: Date, n: number): Date` — 달력 기준 이동(DST 영향 없음)
  - `buildHeatmapGrid(today: Date, weeks = 53): Array<Array<{ key: string, isFuture: boolean }>>` — 바깥 배열이 주(열), 안쪽이 일~토
  - `canSelect(key: unknown, todayKey: string): boolean`
  - `followToday(selectedKey: string, prevTodayKey: string, newTodayKey: string): string`

- [ ] **Step 1: `package.json` 작성**

`focus-grass/package.json`:

```json
{
  "name": "focus-grass",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test"
  }
}
```

- [ ] **Step 2: 실패하는 테스트 작성**

`focus-grass/tests/dateUtils.test.js`:

```js
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
```

- [ ] **Step 3: 실패 확인**

Run (in `AI/Superpowers/focus-grass`): `node --test`
Expected: FAIL — `Cannot find module '../js/dateUtils.js'`

- [ ] **Step 4: 구현**

`focus-grass/js/dateUtils.js`:

```js
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
```

- [ ] **Step 5: 통과 확인**

Run: `node --test`
Expected: PASS (8 tests, 0 failures)

---

### Task 2: `todos` (순수 로직)

**Files:**
- Create: `focus-grass/js/todos.js`
- Test: `focus-grass/tests/todos.test.js`

**Interfaces:**
- Consumes: 없음
- Produces (`js/todos.js`), 모두 입력을 바꾸지 않고 새 객체를 반환한다. `days`는 `{ [dateKey]: Array<{ id: string, text: string, done: boolean }> }`.
  - `MAX_TEXT_LENGTH = 200` — 문자(코드포인트) 단위. 이모지가 반으로 잘리지 않는다.
  - `makeId(): string`
  - `clipText(text: unknown): string` — 앞뒤 공백을 지우고 최대 길이로 자른다
  - `addTodo(days, key, text, id = makeId())` — 공백뿐이면 `days` 그대로(같은 참조)
  - `toggleTodo(days, key, id)`
  - `editTodo(days, key, id, text)` — 공백뿐이면 `days` 그대로
  - `removeTodo(days, key, id)` — 마지막 항목이면 날짜 키도 제거
  - `completionStats(list = []): { done: number, total: number, rate: number | null }` — `total === 0`이면 `rate`는 `null`
  - `completionRate(list): number | null`

- [ ] **Step 1: 실패하는 테스트 작성**

`focus-grass/tests/todos.test.js`:

```js
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
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/todos.test.js`
Expected: FAIL — `Cannot find module '../js/todos.js'`

- [ ] **Step 3: 구현**

`focus-grass/js/todos.js`:

```js
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
```

- [ ] **Step 4: 통과 확인**

Run: `node --test`
Expected: PASS (dateUtils + todos 전부, 0 failures)

---

### Task 3: `settings` (기본값과 시간 입력 검증)

**Files:**
- Create: `focus-grass/js/settings.js`
- Test: `focus-grass/tests/settings.test.js`

**Interfaces:**
- Consumes: 없음
- Produces (`js/settings.js`):
  - `DEFAULT_SETTINGS = { version: 1, focusMin: 25, breakMin: 5, autoSwitch: false, soundOn: true, notifyOn: true, pomodoroCount: {} }`
  - `defaultSettings(): object` — `pomodoroCount`까지 새 객체로 복사한 기본값
  - `LIMITS = { focusMin: { min: 1, max: 120 }, breakMin: { min: 1, max: 60 } }`
  - `isValidMinutes(value: unknown, limit: { min: number, max: number }): boolean`
  - `validateDurations(input: { focusMin: string | number, breakMin: string | number }): { ok: boolean, values: { focusMin?: number, breakMin?: number }, errors: { focusMin?: string, breakMin?: string } }` — 문자열은 앞뒤 공백을 뺀 ASCII 숫자만 인정한다(`1e1`, `0x10`, `+5`, `10.0`은 거부)

- [ ] **Step 1: 실패하는 테스트 작성**

`focus-grass/tests/settings.test.js`:

```js
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
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/settings.test.js`
Expected: FAIL — `Cannot find module '../js/settings.js'`

- [ ] **Step 3: 구현**

`focus-grass/js/settings.js`:

```js
export const DEFAULT_SETTINGS = {
  version: 1,
  focusMin: 25,
  breakMin: 5,
  autoSwitch: false,
  soundOn: true,
  notifyOn: true,
  pomodoroCount: {},
};

export const LIMITS = {
  focusMin: { min: 1, max: 120 },
  breakMin: { min: 1, max: 60 },
};

export function defaultSettings() {
  return { ...DEFAULT_SETTINGS, pomodoroCount: {} };
}

export function isValidMinutes(value, { min, max }) {
  return Number.isInteger(value) && value >= min && value <= max;
}

// 폼 입력은 앞뒤 공백을 뺀 ASCII 숫자만 인정한다 (1e1, 0x10, +5, 10.0 같은 형식은 거부)
function toNumber(raw) {
  if (typeof raw === 'string') {
    const text = raw.trim();
    return /^\d+$/.test(text) ? Number(text) : NaN;
  }
  return raw;
}

export function validateDurations(input) {
  const values = {};
  const errors = {};
  for (const field of ['focusMin', 'breakMin']) {
    const n = toNumber(input[field]);
    const limit = LIMITS[field];
    if (isValidMinutes(n, limit)) values[field] = n;
    else errors[field] = `${limit.min}~${limit.max} 사이의 정수를 입력하세요`;
  }
  return { ok: Object.keys(errors).length === 0, values, errors };
}
```

- [ ] **Step 4: 통과 확인**

Run: `node --test`
Expected: PASS (0 failures)

---

### Task 4: `storage` (저장·복구·정규화)

**Files:**
- Create: `focus-grass/js/storage.js`
- Test: `focus-grass/tests/storage.test.js`

**Interfaces:**
- Consumes:
  - `isDateKey(key)` from `js/dateUtils.js`
  - `clipText(text)` from `js/todos.js`
  - `defaultSettings()`, `LIMITS`, `isValidMinutes()` from `js/settings.js`
- Produces (`js/storage.js`):
  - `TODOS_KEY = 'ffg:todos'`, `SETTINGS_KEY = 'ffg:settings'`
  - `pickBackend(getStorage = () => window.localStorage): backend | null` — 접근과 읽기만 확인한다(쓰기 점검을 하면 가득 찬 저장소의 기존 기록까지 못 읽는다)
  - `createStorage(backend: { getItem(k): string | null, setItem(k, v): void } | null): { read(key): unknown | null, write(key, value): boolean, invalidate(key): void, isPersistent(): boolean }`
    - `write`는 항상 메모리에 먼저 저장하고, 백엔드 저장에 실패하면 `false`를 반환한다. 그 키를 나중에 성공적으로 저장하면 다시 저장된 것으로 본다.
    - `isPersistent()`는 백엔드가 있고 메모리에만 남은 키가 없을 때만 `true`.
    - `read`는 메모리를 먼저 보고, 없으면 백엔드를 읽어 JSON 파싱한다(파싱·접근 실패 시 `null`).
    - `invalidate(key)`는 다른 탭이 저장소를 바꿨을 때 메모리 사본을 버린다(백엔드가 없으면 아무 일도 하지 않는다).
  - `normalizeTodos(raw: unknown): { version: 1, days: Days }` — 모양이 틀린 항목, 공백뿐인 항목은 버리고, 같은 날짜 안의 중복 id에는 새 id(`x~1`)를 준다
  - `normalizeSettings(raw: unknown): Settings`
  - `loadTodos(storage): { version: 1, days }`, `saveTodos(storage, doc): boolean`
  - `loadSettings(storage): Settings`, `saveSettings(storage, settings): boolean`

- [ ] **Step 1: 실패하는 테스트 작성**

`focus-grass/tests/storage.test.js`:

```js
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
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/storage.test.js`
Expected: FAIL — `Cannot find module '../js/storage.js'`

- [ ] **Step 3: 구현**

`focus-grass/js/storage.js`:

```js
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
```

- [ ] **Step 4: 통과 확인**

Run: `node --test`
Expected: PASS (0 failures)

---

### Task 5: `heatmap` (레벨 계산, 툴팁, 렌더링)

**Files:**
- Create: `focus-grass/js/heatmap.js`
- Test: `focus-grass/tests/heatmap.test.js`

**Interfaces:**
- Consumes: `completionStats(list)` from `js/todos.js`
- Produces (`js/heatmap.js`):
  - `levelFor(rate: number | null | undefined): -1 | 0 | 1 | 2 | 3 | 4` — `null`/`undefined`=-1(기록 없음), `0`=0, `(0, 0.25]`=1, `(0.25, 0.5]`=2, `(0.5, 1)`=3, `1`=4
  - `cellInfo(key: string, days: Days): { level: number, done: number, total: number, rate: number | null }`
  - `tooltipText(key: string, info): string` — 예: `10/12 · 3/4 완료 (75%)`, 기록이 없으면 `10/12 · 기록 없음`
  - `renderHeatmap(container: HTMLElement, opts: { grid, days, selectedKey: string, onSelect: (key: string) => void }): void` — DOM 필요(브라우저에서만 호출). 칸 버튼은 한 번만 만들고 이후에는 속성만 갱신하며, 클릭은 컨테이너에서 위임으로 받는다(다시 만들면 누르던 칸이 교체되어 클릭이 유실된다). 이 모듈은 import 시점에 DOM을 건드리지 않는다.

- [ ] **Step 1: 실패하는 테스트 작성**

`focus-grass/tests/heatmap.test.js`:

```js
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
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/heatmap.test.js`
Expected: FAIL — `Cannot find module '../js/heatmap.js'`

- [ ] **Step 3: 구현**

`focus-grass/js/heatmap.js`:

```js
import { completionStats } from './todos.js';

export function levelFor(rate) {
  if (rate === null || rate === undefined) return -1;
  if (rate <= 0) return 0;
  if (rate <= 0.25) return 1;
  if (rate <= 0.5) return 2;
  if (rate < 1) return 3;
  return 4;
}

export function cellInfo(key, days) {
  const { done, total, rate } = completionStats(days[key]);
  return { level: levelFor(rate), done, total, rate };
}

export function tooltipText(key, info) {
  const monthDay = key.slice(5).replace('-', '/');
  if (info.total === 0) return `${monthDay} · 기록 없음`;
  return `${monthDay} · ${info.done}/${info.total} 완료 (${Math.round(info.rate * 100)}%)`;
}

const stateByContainer = new WeakMap();

function buildGrid(container, grid) {
  const columns = grid.map((week) => {
    const column = document.createElement('div');
    column.className = 'week';
    for (let i = 0; i < week.length; i += 1) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'cell';
      column.append(button);
    }
    return column;
  });
  container.replaceChildren(...columns);
}

function updateCell(button, cell, info, selectedKey) {
  button.dataset.key = cell.key;
  button.classList.toggle('future', cell.isFuture);
  button.classList.toggle('selected', !cell.isFuture && cell.key === selectedKey);
  if (cell.isFuture) {
    button.disabled = true;
    button.tabIndex = -1;
    delete button.dataset.level;
    button.removeAttribute('title');
    button.removeAttribute('aria-label');
    button.removeAttribute('aria-pressed');
    return;
  }
  const label = tooltipText(cell.key, info);
  button.disabled = false;
  button.removeAttribute('tabindex');
  button.dataset.level = String(info.level);
  button.title = label;
  button.setAttribute('aria-label', label);
  button.setAttribute('aria-pressed', String(cell.key === selectedKey));
}

// 칸 버튼은 한 번만 만들고 이후에는 속성만 갱신한다. 다시 만들면 눌러 둔 칸이 교체되어
// 클릭이 유실되고 키보드 포커스가 사라진다. 클릭은 컨테이너에서 위임으로 받는다.
export function renderHeatmap(container, { grid, days, selectedKey, onSelect }) {
  let state = stateByContainer.get(container);
  if (!state) {
    state = { onSelect };
    stateByContainer.set(container, state);
    container.addEventListener('click', (event) => {
      const button = event.target.closest('button.cell');
      if (!button || button.disabled) return;
      stateByContainer.get(container).onSelect(button.dataset.key);
    });
  }
  state.onSelect = onSelect;

  const cells = grid.flat();
  let buttons = container.querySelectorAll('button.cell');
  if (buttons.length !== cells.length) {
    buildGrid(container, grid);
    buttons = container.querySelectorAll('button.cell');
  }
  cells.forEach((cell, i) => updateCell(buttons[i], cell, cellInfo(cell.key, days), selectedKey));
}
```

- [ ] **Step 4: 통과 확인**

Run: `node --test`
Expected: PASS (0 failures)

---

### Task 6: `pomodoro` (타이머 상태 머신)

**Files:**
- Create: `focus-grass/js/pomodoro.js`
- Test: `focus-grass/tests/pomodoro.test.js`

**Interfaces:**
- Consumes: 없음. `settings`는 `{ focusMin: number, breakMin: number, autoSwitch: boolean }` 모양이면 충분하다.
- Produces (`js/pomodoro.js`) — 모든 시간은 밀리초(`now`는 `Date.now()` 값), 상태는 불변으로 다룬다.
  - 상태: `{ phase: 'idle' | 'focus' | 'break' | 'paused', next: 'focus' | 'break', endAt: number | null, remainingMs: number | null, resumePhase: 'focus' | 'break' | null }`
  - `createState()`: `{ phase: 'idle', next: 'focus', endAt: null, remainingMs: null, resumePhase: null }`
  - `start(state, settings, now)` — `idle`일 때만 동작, 아니면 같은 상태를 그대로 반환
  - `pause(state, now)` — `focus`/`break`일 때만 동작
  - `resume(state, now)` — `paused`일 때만 동작
  - `reset()` — `createState()`
  - `remainingMs(state, settings, now): number`
  - `msUntilEnd(state, now): number | null` — 실행 중인 세션의 종료까지 남은 ms, 실행 중이 아니면 `null`
  - `tick(state, settings, now): { state, events: Array<'focusDone' | 'breakDone'>, endedAt: number | null }` — `endedAt`은 끝난 세션이 끝났어야 하는 시각(틱이 늦게 와도 "그날"을 알 수 있다)
  - `APP_TITLE = 'Focus & Grass'`
  - `finishNotice(event): string | null` — `'focusDone'`→`'✅ 집중 끝!'`, `'breakDone'`→`'✅ 휴식 끝!'`
  - `tabTitle(state, settings, now, notice = null): string` — 실행 중이면 `🍅`/`☕` + 남은 시간, 아니면 안내 문구(있을 때) 또는 앱 이름
  - `formatMs(ms: number): string` — 올림한 초를 `MM:SS`로

- [ ] **Step 1: 실패하는 테스트 작성**

`focus-grass/tests/pomodoro.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createState, start, pause, resume, reset, remainingMs, tick, formatMs, msUntilEnd,
  tabTitle, finishNotice, APP_TITLE,
} from '../js/pomodoro.js';

const MIN = 60_000;
const S = { focusMin: 25, breakMin: 5, autoSwitch: false };
const AUTO = { ...S, autoSwitch: true };

test('a fresh timer is idle and shows the configured focus time', () => {
  const st = createState();
  assert.equal(st.phase, 'idle');
  assert.equal(remainingMs(st, S, 0), 25 * MIN);
  assert.equal(remainingMs(st, { ...S, focusMin: 50 }, 0), 50 * MIN);
});

test('start enters focus with an exact end time', () => {
  const st = start(createState(), S, 1_000);
  assert.equal(st.phase, 'focus');
  assert.equal(st.endAt, 1_000 + 25 * MIN);
  assert.equal(remainingMs(st, S, 1_000 + 10 * MIN), 15 * MIN);
});

test('start while already running does not restart the timer', () => {
  const running = start(createState(), S, 0);
  assert.equal(start(running, S, 5 * MIN), running);
  const paused = pause(running, 5 * MIN);
  assert.equal(start(paused, S, 6 * MIN), paused);
});

test('pause then resume preserves the remaining time', () => {
  const running = start(createState(), S, 0);
  const paused = pause(running, 10 * MIN);
  assert.equal(paused.phase, 'paused');
  assert.equal(paused.resumePhase, 'focus');
  assert.equal(remainingMs(paused, S, 999 * MIN), 15 * MIN);
  const resumed = resume(paused, 100 * MIN);
  assert.equal(resumed.phase, 'focus');
  assert.equal(resumed.endAt, 115 * MIN);
});

test('repeated pause/resume cycles never lose or add time', () => {
  let st = start(createState(), S, 0);
  st = pause(st, 1 * MIN);
  st = resume(st, 50 * MIN);
  st = pause(st, 52 * MIN);
  st = resume(st, 70 * MIN);
  assert.equal(remainingMs(st, S, 70 * MIN), 22 * MIN);
});

test('pause on idle and resume when not paused are no-ops', () => {
  const idle = createState();
  assert.equal(pause(idle, 0), idle);
  assert.equal(resume(idle, 0), idle);
  const running = start(idle, S, 0);
  assert.equal(resume(running, 1), running);
});

test('tick before the end does nothing', () => {
  const st = start(createState(), S, 0);
  const r = tick(st, S, 25 * MIN - 1);
  assert.equal(r.state, st);
  assert.deepEqual(r.events, []);
});

test('focus expiry without autoSwitch emits focusDone and waits for a manual break', () => {
  const st = start(createState(), S, 0);
  const r = tick(st, S, 25 * MIN);
  assert.deepEqual(r.events, ['focusDone']);
  assert.equal(r.state.phase, 'idle');
  assert.equal(r.state.next, 'break');
  assert.equal(remainingMs(r.state, S, 0), 5 * MIN);
  const br = start(r.state, S, 30 * MIN);
  assert.equal(br.phase, 'break');
  assert.equal(br.endAt, 35 * MIN);
});

test('focus expiry with autoSwitch starts the break immediately', () => {
  const st = start(createState(), AUTO, 0);
  const r = tick(st, AUTO, 25 * MIN);
  assert.deepEqual(r.events, ['focusDone']);
  assert.equal(r.state.phase, 'break');
  assert.equal(r.state.endAt, 30 * MIN);
});

test('break expiry returns to idle ready for a new focus, even with autoSwitch', () => {
  const br = tick(start(createState(), AUTO, 0), AUTO, 25 * MIN).state;
  const r = tick(br, AUTO, 30 * MIN);
  assert.deepEqual(r.events, ['breakDone']);
  assert.equal(r.state.phase, 'idle');
  assert.equal(r.state.next, 'focus');
});

test('tick reports when the finished session actually ended, even for a late tick', () => {
  const st = start(createState(), S, 0);
  assert.equal(tick(st, S, 25 * MIN).endedAt, 25 * MIN);
  const late = tick(st, S, 10 * 60 * MIN);
  assert.equal(late.endedAt, 25 * MIN);
  assert.equal(tick(st, S, 1).endedAt, null);
  const br = tick(start(createState(), AUTO, 0), AUTO, 25 * MIN).state;
  assert.equal(tick(br, AUTO, 99 * MIN).endedAt, 30 * MIN);
});

test('a late tick (tab asleep) fires the transition exactly once', () => {
  const st = start(createState(), S, 0);
  const first = tick(st, S, 10 * 60 * MIN);
  assert.deepEqual(first.events, ['focusDone']);
  const second = tick(first.state, S, 10 * 60 * MIN + 250);
  assert.deepEqual(second.events, []);
  assert.equal(second.state, first.state);
});

test('reset returns to idle from any phase and never emits an event', () => {
  const running = start(createState(), S, 0);
  assert.deepEqual(reset(running), createState());
  assert.deepEqual(reset(pause(running, MIN)), createState());
  const waitingBreak = tick(running, S, 25 * MIN).state;
  assert.deepEqual(reset(waitingBreak), createState());
});

test('settings changed during a session apply only to the next session', () => {
  const st = start(createState(), S, 0);
  const changed = { ...S, focusMin: 50 };
  assert.equal(remainingMs(st, changed, 5 * MIN), 20 * MIN);
  assert.deepEqual(tick(st, changed, 25 * MIN).events, ['focusDone']);
});

test('msUntilEnd gives the time to the deadline only while a session is running', () => {
  const st = start(createState(), S, 1_000);
  assert.equal(msUntilEnd(st, 1_000), 25 * MIN);
  assert.equal(msUntilEnd(st, 1_000 + 10 * MIN), 15 * MIN);
  assert.equal(msUntilEnd(st, 1_000 + 30 * MIN), 0);
  assert.equal(msUntilEnd(createState(), 0), null);
  assert.equal(msUntilEnd(pause(st, 5_000), 6_000), null);
});

test('tabTitle shows the countdown with a phase icon while a session runs', () => {
  const focus = start(createState(), S, 0);
  assert.equal(tabTitle(focus, S, 1_000), `🍅 24:59 · ${APP_TITLE}`);
  const br = tick(focus, AUTO, 25 * MIN).state;
  assert.equal(tabTitle(br, AUTO, 25 * MIN), `☕ 05:00 · ${APP_TITLE}`);
});

test('tabTitle keeps the finish notice visible after a session ends, until a new one starts', () => {
  const done = tick(start(createState(), S, 0), S, 25 * MIN).state;
  assert.equal(tabTitle(done, S, 25 * MIN, finishNotice('focusDone')), `✅ 집중 끝! · ${APP_TITLE}`);
  assert.equal(tabTitle(done, S, 25 * MIN, null), APP_TITLE);
  const running = start(createState(), S, 0);
  assert.equal(tabTitle(running, S, 0, finishNotice('focusDone')), `🍅 25:00 · ${APP_TITLE}`);
});

test('tabTitle for a paused or idle timer is the plain app title', () => {
  const paused = pause(start(createState(), S, 0), MIN);
  assert.equal(tabTitle(paused, S, 2 * MIN), APP_TITLE);
  assert.equal(tabTitle(createState(), S, 0), APP_TITLE);
});

test('finishNotice names each end-of-session event and ignores unknown ones', () => {
  assert.equal(finishNotice('focusDone'), '✅ 집중 끝!');
  assert.equal(finishNotice('breakDone'), '✅ 휴식 끝!');
  assert.equal(finishNotice('other'), null);
});

test('formatMs rounds partial seconds up and pads', () => {
  assert.equal(formatMs(25 * MIN), '25:00');
  assert.equal(formatMs(61_000), '01:01');
  assert.equal(formatMs(1), '00:01');
  assert.equal(formatMs(0), '00:00');
  assert.equal(formatMs(-500), '00:00');
  assert.equal(formatMs(120 * MIN), '120:00');
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/pomodoro.test.js`
Expected: FAIL — `Cannot find module '../js/pomodoro.js'`

- [ ] **Step 3: 구현**

`focus-grass/js/pomodoro.js`:

```js
const MINUTE = 60_000;

export const APP_TITLE = 'Focus & Grass';

export function createState() {
  return { phase: 'idle', next: 'focus', endAt: null, remainingMs: null, resumePhase: null };
}

function durationMs(kind, settings) {
  return (kind === 'break' ? settings.breakMin : settings.focusMin) * MINUTE;
}

const isRunning = (state) => state.phase === 'focus' || state.phase === 'break';

export function start(state, settings, now) {
  if (state.phase !== 'idle') return state;
  return {
    phase: state.next,
    next: 'focus',
    endAt: now + durationMs(state.next, settings),
    remainingMs: null,
    resumePhase: null,
  };
}

export function pause(state, now) {
  if (!isRunning(state)) return state;
  return {
    ...state,
    phase: 'paused',
    resumePhase: state.phase,
    remainingMs: Math.max(0, state.endAt - now),
    endAt: null,
  };
}

export function resume(state, now) {
  if (state.phase !== 'paused') return state;
  return {
    ...state,
    phase: state.resumePhase,
    endAt: now + state.remainingMs,
    remainingMs: null,
    resumePhase: null,
  };
}

export function reset() {
  return createState();
}

export function remainingMs(state, settings, now) {
  if (state.phase === 'paused') return state.remainingMs;
  if (isRunning(state)) return Math.max(0, state.endAt - now);
  return durationMs(state.next, settings);
}

// 실행 중인 세션의 종료까지 남은 ms. 실행 중이 아니면 null (종료 시각에 맞춘 단발 타이머용)
export function msUntilEnd(state, now) {
  return isRunning(state) ? Math.max(0, state.endAt - now) : null;
}

// endedAt: 끝난 세션이 실제로 끝났어야 하는 시각. 탭이 절전이어서 틱이 늦게 와도 "그날"을 알 수 있게 한다.
export function tick(state, settings, now) {
  if (!isRunning(state) || now < state.endAt) return { state, events: [], endedAt: null };
  const endedAt = state.endAt;
  if (state.phase === 'focus') {
    if (settings.autoSwitch) {
      return {
        state: {
          phase: 'break', next: 'focus', endAt: now + durationMs('break', settings),
          remainingMs: null, resumePhase: null,
        },
        events: ['focusDone'],
        endedAt,
      };
    }
    return { state: { ...createState(), next: 'break' }, events: ['focusDone'], endedAt };
  }
  return { state: createState(), events: ['breakDone'], endedAt };
}

const FINISH_NOTICE = { focusDone: '✅ 집중 끝!', breakDone: '✅ 휴식 끝!' };

export function finishNotice(event) {
  return FINISH_NOTICE[event] ?? null;
}

// 탭 제목: 실행 중에는 남은 시간, 끝난 직후에는 종료 안내(알림 권한이 없거나 소리가 꺼져 있어도 알 수 있게)
export function tabTitle(state, settings, now, notice = null) {
  if (isRunning(state)) {
    const icon = state.phase === 'focus' ? '🍅' : '☕';
    return `${icon} ${formatMs(remainingMs(state, settings, now))} · ${APP_TITLE}`;
  }
  return notice ? `${notice} · ${APP_TITLE}` : APP_TITLE;
}

export function formatMs(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
```

- [ ] **Step 4: 통과 확인**

Run: `node --test`
Expected: PASS (모든 테스트 파일, 0 failures)

---

### Task 7: `notify` (소리, 브라우저 알림, 탭 제목)

브라우저 API(Web Audio, Notification, document)를 감싸는 얇은 래퍼다. 소리는 헤드리스 환경에서 확인할 수 없어 수동 확인(Task 9)에 맡기고, 브라우저 알림 생성이 예외를 던져도 앱이 멈추지 않는다는 점만 `Notification` 스텁으로 단위 테스트한다.

**Files:**
- Create: `focus-grass/js/notify.js`
- Test: `focus-grass/tests/notify.test.js`

**Interfaces:**
- Consumes: 없음
- Produces (`js/notify.js`):
  - `prepareAudio(): void` — 사용자 클릭 핸들러 안에서 호출. 오디오 컨텍스트를 만들고 `suspended`면 재개
  - `playSound(kind: 'focusDone' | 'breakDone'): void` — 컨텍스트가 없으면 조용히 무시
  - `requestNotifyPermission(): Promise<'granted' | 'denied' | 'default' | 'unsupported'>`
  - `showNotification(title: string, body: string): boolean` — 표시했으면 `true`. 권한이 없거나, 지원하지 않거나, 생성자가 예외를 던지면(안드로이드 Chrome) `false`
  - `setTabTitle(text: string): void` — 값이 다를 때만 `document.title`에 쓴다

- [ ] **Step 1: 실패하는 테스트 작성**

`focus-grass/tests/notify.test.js`:

```js
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
```

- [ ] **Step 2: 실패 확인**

Run (in `AI/Superpowers/focus-grass`): `node --test tests/notify.test.js`
Expected: FAIL — `Cannot find module '../js/notify.js'`

- [ ] **Step 3: 구현**

`focus-grass/js/notify.js`:

```js
let audioContext = null;

// 집중 종료: 올라가는 두 음, 휴식 종료: 낮은 두 음
const TONES = {
  focusDone: [880, 1174.66],
  breakDone: [523.25, 659.25],
};

export function prepareAudio() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audioContext ??= new Ctx();
    if (audioContext.state === 'suspended') audioContext.resume();
  } catch {
    // 소리를 쓸 수 없으면 알림과 탭 제목만 사용한다.
  }
}

export function playSound(kind) {
  if (!audioContext || !TONES[kind]) return;
  const t0 = audioContext.currentTime;
  TONES[kind].forEach((frequency, i) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.frequency.value = frequency;
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    const startAt = t0 + i * 0.25;
    gain.gain.setValueAtTime(0.2, startAt);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.2);
    oscillator.start(startAt);
    oscillator.stop(startAt + 0.22);
  });
}

export async function requestNotifyPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export function showNotification(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return false;
  try {
    new Notification(title, { body });
    return true;
  } catch {
    // 일부 브라우저(안드로이드 Chrome)는 생성자를 막는다. 소리와 탭 제목으로 대신한다.
    return false;
  }
}

export function setTabTitle(text) {
  if (document.title !== text) document.title = text;
}
```

- [ ] **Step 4: 통과 확인**

Run: `node --test`
Expected: PASS (0 failures)

---

### Task 8: 화면 골격과 체크리스트·히트맵 연결

`index.html`과 CSS 전체를 만들고(타이머·설정 마크업 포함), 체크리스트 컴포넌트(`todoList.js`)를 만든다. `main.js`는 모든 컴포넌트가 준비되는 Task 9에서 최종 형태로 한 번에 작성하므로, 이 태스크의 화면 동작 확인은 Task 9에서 한다.

**Files:**
- Create: `focus-grass/index.html`
- Create: `focus-grass/css/style.css`
- Create: `focus-grass/js/ui/todoList.js`

**Interfaces:**
- Consumes:
  - `completionStats(list)`, `MAX_TEXT_LENGTH` from `js/todos.js`
- Produces:
  - `createTodoList(root: HTMLElement, handlers: { onAdd(text), onToggle(id), onEdit(id, text), onRemove(id), onGoToday() }): { render({ key: string, todayKey: string, list: Todo[] }): void }` (`js/ui/todoList.js`)
  - `index.html`의 요소 id (Task 9가 사용): `#storage-banner`, `#heatmap`, `#todo-panel`(`#todo-date`, `#go-today`, `#todo-list`, `#todo-form`, `#todo-input`, `#todo-progress`), `#timer-panel`(`#timer-mode`, `#timer-display`, `#btn-start`, `#btn-pause`, `#btn-resume`, `#btn-reset`, `#timer-summary`, `#pomodoro-count`), `#settings-form`(`#set-focus`, `#set-break`, `#err-focus`, `#err-break`, `#set-auto`, `#set-sound`, `#set-notify`)

- [ ] **Step 1: `index.html` 작성**

`focus-grass/index.html`:

```html
<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Focus &amp; Grass</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <header class="app-header">
    <h1>🍅 Focus &amp; Grass</h1>
  </header>

  <p id="storage-banner" class="banner" role="alert" hidden>
    저장되지 않습니다. 브라우저 저장소를 사용할 수 없어 이 탭을 닫으면 기록이 사라집니다.
  </p>

  <section class="card" aria-labelledby="heatmap-title">
    <h2 id="heatmap-title" class="sr-only">달성 히트맵</h2>
    <div id="heatmap" class="heatmap"></div>
    <div class="legend" aria-hidden="true">
      <span>기록 없음</span><span class="cell" data-level="-1"></span>
      <span class="legend-gap">적음</span>
      <span class="cell" data-level="0"></span>
      <span class="cell" data-level="1"></span>
      <span class="cell" data-level="2"></span>
      <span class="cell" data-level="3"></span>
      <span class="cell" data-level="4"></span>
      <span>많음</span>
    </div>
  </section>

  <main class="columns">
    <section id="todo-panel" class="card" aria-labelledby="todo-date">
      <div class="todo-head">
        <h2 id="todo-date"></h2>
        <button id="go-today" type="button" hidden>오늘로</button>
      </div>
      <ul id="todo-list" class="todo-list"></ul>
      <form id="todo-form" class="todo-form">
        <input id="todo-input" type="text" maxlength="200" placeholder="할 일 추가" autocomplete="off" aria-label="할 일 추가">
        <button type="submit">추가</button>
      </form>
      <p id="todo-progress" class="muted"></p>
    </section>

    <section id="timer-panel" class="card" aria-labelledby="timer-mode" data-phase="idle">
      <h2 id="timer-mode">대기</h2>
      <div id="timer-display" class="timer-display" aria-live="off">25:00</div>
      <div class="timer-buttons">
        <button id="btn-start" type="button">시작</button>
        <button id="btn-pause" type="button" hidden>일시정지</button>
        <button id="btn-resume" type="button" hidden>재개</button>
        <button id="btn-reset" type="button">리셋</button>
      </div>
      <p id="timer-summary" class="muted"></p>
      <p id="pomodoro-count" class="muted"></p>

      <details class="settings">
        <summary>⚙ 시간 설정</summary>
        <form id="settings-form" novalidate>
          <label>집중 (분)
            <input id="set-focus" type="text" inputmode="numeric" autocomplete="off">
          </label>
          <small id="err-focus" class="error" role="alert"></small>
          <label>휴식 (분)
            <input id="set-break" type="text" inputmode="numeric" autocomplete="off">
          </label>
          <small id="err-break" class="error" role="alert"></small>
          <label class="check"><input id="set-auto" type="checkbox"> 집중 후 휴식 자동 시작</label>
          <label class="check"><input id="set-sound" type="checkbox"> 소리</label>
          <label class="check"><input id="set-notify" type="checkbox"> 브라우저 알림</label>
          <button type="submit">저장</button>
        </form>
      </details>
    </section>
  </main>

  <script type="module" src="js/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: `style.css` 작성**

`focus-grass/css/style.css`:

```css
:root {
  --bg: #f6f8fa;
  --card: #ffffff;
  --text: #1f2328;
  --muted: #656d76;
  --border: #d0d7de;
  --accent: #2da44e;
  --danger: #cf222e;
  --lv-none: #ebedf0;
  --lv-0: #d6dbe1;
  --lv-1: #aceebb;
  --lv-2: #4ac26b;
  --lv-3: #2da44e;
  --lv-4: #116329;
  --cell: 12px;
  --gap: 3px;
}

* { box-sizing: border-box; }

body {
  margin: 0 auto;
  max-width: 960px;
  padding: 16px;
  background: var(--bg);
  color: var(--text);
  font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
}

.sr-only {
  position: absolute; width: 1px; height: 1px; overflow: hidden;
  clip: rect(0 0 0 0); white-space: nowrap;
}

h1 { margin: 0 0 12px; font-size: 1.4rem; }
h2 { margin: 0; font-size: 1.1rem; }

.card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

.banner {
  background: #fff8c5; border: 1px solid #d4a72c; border-radius: 6px;
  padding: 8px 12px; margin: 0 0 16px;
}

.muted { color: var(--muted); margin: 8px 0 0; }
.error { display: block; min-height: 1.2em; color: var(--danger); }

/* 히트맵 */
.heatmap { display: flex; gap: var(--gap); overflow-x: auto; padding-bottom: 6px; }
.week { display: grid; grid-template-rows: repeat(7, var(--cell)); gap: var(--gap); }

.cell {
  width: var(--cell); height: var(--cell);
  padding: 0; border: 0; border-radius: 2px;
  background: var(--lv-none);
  display: inline-block;
}
button.cell { cursor: pointer; }
.cell[data-level="-1"] { background: var(--lv-none); }
.cell[data-level="0"] { background: var(--lv-0); }
.cell[data-level="1"] { background: var(--lv-1); }
.cell[data-level="2"] { background: var(--lv-2); }
.cell[data-level="3"] { background: var(--lv-3); }
.cell[data-level="4"] { background: var(--lv-4); }
.cell.future { background: transparent; cursor: default; }
.cell.selected { outline: 2px solid var(--text); outline-offset: 1px; }

.legend {
  display: flex; align-items: center; gap: 4px;
  margin-top: 8px; font-size: 0.8rem; color: var(--muted);
}
.legend-gap { margin-left: 12px; }

/* 본문 두 칼럼 */
.columns { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: start; }
@media (max-width: 720px) { .columns { grid-template-columns: 1fr; } }

/* 체크리스트 */
.todo-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.todo-list { list-style: none; margin: 12px 0; padding: 0; }
.todo-list li { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--border); }
.todo-list li.done .todo-text { text-decoration: line-through; color: var(--muted); }
.todo-text { flex: 1; overflow-wrap: anywhere; cursor: text; }
.todo-edit { flex: 1; font: inherit; }
.todo-del { border: 0; background: none; color: var(--muted); cursor: pointer; }
.todo-del:hover { color: var(--danger); }
.todo-form { display: flex; gap: 8px; }
.todo-form input { flex: 1; font: inherit; padding: 6px 8px; }

/* 타이머 */
.timer-display {
  font-size: 3.5rem; font-weight: 600; text-align: center;
  font-variant-numeric: tabular-nums; margin: 12px 0;
}
#timer-panel[data-phase="focus"] .timer-display { color: var(--danger); }
#timer-panel[data-phase="break"] .timer-display { color: var(--accent); }
.timer-buttons { display: flex; justify-content: center; gap: 8px; }
button { font: inherit; padding: 6px 14px; cursor: pointer; }
.settings { margin-top: 16px; }
.settings label { display: block; margin-top: 8px; }
.settings label.check { margin-top: 4px; }
.settings input[type="text"] { width: 5em; font: inherit; padding: 4px 6px; margin-left: 8px; }
.settings button { margin-top: 12px; }
```

- [ ] **Step 3: `todoList.js` 작성**

`focus-grass/js/ui/todoList.js`:

```js
import { completionStats, MAX_TEXT_LENGTH } from '../todos.js';

export function createTodoList(root, handlers) {
  const dateEl = root.querySelector('#todo-date');
  const goToday = root.querySelector('#go-today');
  const listEl = root.querySelector('#todo-list');
  const form = root.querySelector('#todo-form');
  const input = root.querySelector('#todo-input');
  const progress = root.querySelector('#todo-progress');

  // 항목 행(li)은 렌더링 사이에 재사용한다. 다시 만들면 편집 중인 입력창이 사라지고,
  // 마우스를 누른 요소가 뗄 때까지 교체되어 클릭이 유실된다.
  const rows = new Map(); // todo id -> { id, li, checkbox, label, text } (id 는 날짜 안에서 고유: storage 가 보장)
  let renderedKey = null;
  let activeEdit = null; // { row, edit, cancel() }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!input.value.trim()) return;
    handlers.onAdd(input.value);
    input.value = '';
    input.focus();
  });
  goToday.addEventListener('click', () => handlers.onGoToday());

  function cancelEdit() {
    if (!activeEdit) return;
    const { cancel } = activeEdit;
    activeEdit = null;
    cancel();
  }

  function startEdit(row) {
    if (activeEdit?.row === row) return;
    cancelEdit();
    const edit = document.createElement('input');
    edit.type = 'text';
    edit.className = 'todo-edit';
    edit.value = row.text;
    edit.maxLength = MAX_TEXT_LENGTH;
    let finished = false;
    const restoreLabel = () => { if (edit.isConnected) edit.replaceWith(row.label); };
    const finish = (commit) => {
      if (finished) return;
      finished = true;
      if (activeEdit?.edit === edit) activeEdit = null;
      const value = edit.value.trim();
      restoreLabel();
      if (commit && value && value !== row.text) handlers.onEdit(row.id, value);
    };
    activeEdit = {
      row,
      edit,
      cancel: () => { finished = true; restoreLabel(); },
    };
    edit.addEventListener('keydown', (event) => {
      // 한글 등 조합 입력 중의 Enter/Esc 는 글자 확정용이다 (keyCode 229 는 구형 브라우저의 같은 신호)
      if (event.isComposing || event.keyCode === 229) return;
      if (event.key === 'Enter') finish(true);
      else if (event.key === 'Escape') finish(false);
    });
    edit.addEventListener('blur', () => finish(true));
    row.label.replaceWith(edit);
    edit.focus();
    edit.select();
  }

  function createRow(id) {
    const li = document.createElement('li');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.setAttribute('aria-label', '완료 표시');
    checkbox.addEventListener('change', () => handlers.onToggle(id));

    const label = document.createElement('span');
    label.className = 'todo-text';
    label.title = '더블클릭하여 수정';

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'todo-del';
    remove.textContent = '✕';
    remove.setAttribute('aria-label', '삭제');
    remove.addEventListener('click', () => handlers.onRemove(id));

    li.append(checkbox, label, remove);
    const row = { id, li, checkbox, label, text: '' };
    label.addEventListener('dblclick', () => startEdit(row));
    return row;
  }

  function updateRow(row, todo) {
    row.text = todo.text;
    row.li.className = todo.done ? 'done' : '';
    if (row.checkbox.checked !== todo.done) row.checkbox.checked = todo.done;
    // textContent 로만 넣는다 (HTML 해석 금지)
    if (row.label.textContent !== todo.text) row.label.textContent = todo.text;
  }

  function render({ key, todayKey, list }) {
    dateEl.textContent = key === todayKey ? `📅 ${key} (오늘)` : `📅 ${key}`;
    goToday.hidden = key === todayKey;

    if (key !== renderedKey) {
      // 다른 날짜로 바뀌면 편집은 버리고 행을 모두 새로 만든다 (다른 날짜에 쓰이지 않도록)
      cancelEdit();
      rows.clear();
      listEl.replaceChildren();
      renderedKey = key;
    }

    const seen = new Set();
    const ordered = list.map((todo) => {
      let row = rows.get(todo.id);
      if (!row) {
        row = createRow(todo.id);
        rows.set(todo.id, row);
      }
      updateRow(row, todo);
      seen.add(todo.id);
      return row.li;
    });

    for (const [id, row] of rows) {
      if (seen.has(id)) continue;
      if (activeEdit?.row === row) cancelEdit();
      row.li.remove();
      rows.delete(id);
    }

    const current = [...listEl.children];
    if (current.length !== ordered.length || current.some((node, i) => node !== ordered[i])) {
      listEl.replaceChildren(...ordered);
    }

    const { done, total, rate } = completionStats(list);
    progress.textContent = total === 0
      ? '할 일을 추가해 보세요'
      : `진행률 ${done}/${total} (${Math.round(rate * 100)}%)`;
  }

  return { render };
}
```

- [ ] **Step 4: 문법 확인과 회귀 확인**

Run (in `AI/Superpowers/focus-grass`): `node --check js/ui/todoList.js && node --test`
Expected: 오류 없이 PASS (이 태스크는 브라우저 코드만 추가하므로 기존 테스트 전부 통과, 0 failures)

**`todoList.js`가 지켜야 하는 점 (리뷰에서 확인된 결함의 재발 방지):**
- 항목 행(`li`)은 렌더링 사이에 **재사용**한다(id 기준 맵). 매번 다시 만들면 편집 중인 입력창이 사라지고, 편집을 확정하는 순간 다른 체크박스·삭제 버튼 클릭이 유실된다.
- 날짜가 바뀌면 편집은 버리고 행을 모두 새로 만든다(다른 날짜에 쓰이지 않도록).
- 조합 입력(한글 등) 중의 Enter/Esc(`isComposing`, `keyCode 229`)는 편집 확정·취소로 처리하지 않는다.
- 할 일 글자는 `textContent`로만 넣는다.

---

### Task 9: 타이머 화면, 설정 화면, 알림 연결

**Files:**
- Create: `focus-grass/js/ui/timerView.js`
- Create: `focus-grass/js/ui/settingsView.js`
- Create: `focus-grass/js/main.js`
- Create: `focus-grass/tests/browser/ui-smoke.html`
- Create: `focus-grass/tests/browser/timer-smoke.html`

**Interfaces:**
- Consumes:
  - `toKey, fromKey, buildHeatmapGrid, canSelect, followToday` from `js/dateUtils.js`
  - `addTodo, toggleTodo, editTodo, removeTodo` from `js/todos.js`
  - `createState, start, pause, resume, reset, tick, msUntilEnd, tabTitle, finishNotice, remainingMs, formatMs` from `js/pomodoro.js`
  - `validateDurations` from `js/settings.js`
  - `createStorage, pickBackend, loadTodos, saveTodos, loadSettings, saveSettings, TODOS_KEY, SETTINGS_KEY` from `js/storage.js`
  - `renderHeatmap` from `js/heatmap.js`
  - `prepareAudio, playSound, requestNotifyPermission, showNotification, setTabTitle` from `js/notify.js`
  - Task 8의 `createTodoList`와 `index.html` 요소 id
- Produces:
  - `createTimerView(root, handlers: { onStart(), onPause(), onResume(), onReset() }): { render({ state, settings, now, count }): void }` (`js/ui/timerView.js`). 시작·일시정지·재개는 `click` 이벤트의 `detail > 1`(더블클릭의 두 번째 클릭)을 무시한다. `render`는 250ms마다 불리므로 값이 바뀐 곳만 DOM에 쓴다.
  - `createSettingsView(root, { onSave(patch) }): { fill(settings): void }` (`js/ui/settingsView.js`). `patch`는 `{ focusMin, breakMin, autoSwitch, soundOn, notifyOn }`.

- [ ] **Step 1: `timerView.js` 작성**

`focus-grass/js/ui/timerView.js`:

```js
import { remainingMs, formatMs } from '../pomodoro.js';

const MODE_LABEL = { focus: '집중', break: '휴식' };

export function createTimerView(root, handlers) {
  const mode = root.querySelector('#timer-mode');
  const display = root.querySelector('#timer-display');
  const startBtn = root.querySelector('#btn-start');
  const pauseBtn = root.querySelector('#btn-pause');
  const resumeBtn = root.querySelector('#btn-resume');
  const resetBtn = root.querySelector('#btn-reset');
  const summary = root.querySelector('#timer-summary');
  const countEl = root.querySelector('#pomodoro-count');

  // 더블클릭의 두 번째 클릭(detail > 1)은 같은 자리에 새로 나타난 버튼(시작 -> 일시정지,
  // 일시정지 -> 재개)에 떨어지므로 무시한다. 키보드 활성화는 detail 이 0 이라 영향 없다.
  const singleClick = (action) => (event) => {
    if (event.detail > 1) return;
    action();
  };
  startBtn.addEventListener('click', singleClick(() => handlers.onStart()));
  pauseBtn.addEventListener('click', singleClick(() => handlers.onPause()));
  resumeBtn.addEventListener('click', singleClick(() => handlers.onResume()));
  resetBtn.addEventListener('click', () => handlers.onReset());

  // 250ms 마다 호출되므로 값이 바뀐 곳만 DOM 에 쓴다 (대기·일시정지 중에는 아무것도 쓰지 않는다)
  const setText = (el, text) => { if (el.textContent !== text) el.textContent = text; };
  const setHidden = (el, hidden) => { if (el.hidden !== hidden) el.hidden = hidden; };

  function render({ state, settings, now, count }) {
    const phase = state.phase === 'paused' ? state.resumePhase : state.phase;
    if (root.dataset.phase !== phase) root.dataset.phase = phase;
    setText(display, formatMs(remainingMs(state, settings, now)));

    if (state.phase === 'paused') setText(mode, `${MODE_LABEL[phase]} (일시정지)`);
    else if (state.phase === 'idle') setText(mode, state.next === 'break' ? '휴식 대기' : '대기');
    else setText(mode, MODE_LABEL[phase]);

    setHidden(startBtn, state.phase !== 'idle');
    setText(startBtn, state.next === 'break' ? '휴식 시작' : '시작');
    setHidden(pauseBtn, !(state.phase === 'focus' || state.phase === 'break'));
    setHidden(resumeBtn, state.phase !== 'paused');

    setText(summary, `집중 ${settings.focusMin}분 / 휴식 ${settings.breakMin}분`);
    setText(countEl, `오늘 완료한 🍅: ${count}`);
  }

  return { render };
}
```

- [ ] **Step 2: `settingsView.js` 작성**

`focus-grass/js/ui/settingsView.js`:

```js
import { validateDurations } from '../settings.js';

export function createSettingsView(root, { onSave }) {
  const focusInput = root.querySelector('#set-focus');
  const breakInput = root.querySelector('#set-break');
  const focusError = root.querySelector('#err-focus');
  const breakError = root.querySelector('#err-break');
  const autoInput = root.querySelector('#set-auto');
  const soundInput = root.querySelector('#set-sound');
  const notifyInput = root.querySelector('#set-notify');

  function fill(settings) {
    focusInput.value = String(settings.focusMin);
    breakInput.value = String(settings.breakMin);
    autoInput.checked = settings.autoSwitch;
    soundInput.checked = settings.soundOn;
    notifyInput.checked = settings.notifyOn;
    focusError.textContent = '';
    breakError.textContent = '';
  }

  root.addEventListener('submit', (event) => {
    event.preventDefault();
    const result = validateDurations({ focusMin: focusInput.value, breakMin: breakInput.value });
    focusError.textContent = result.errors.focusMin ?? '';
    breakError.textContent = result.errors.breakMin ?? '';
    if (!result.ok) return; // 저장하지 않고 이전 값 유지
    onSave({
      focusMin: result.values.focusMin,
      breakMin: result.values.breakMin,
      autoSwitch: autoInput.checked,
      soundOn: soundInput.checked,
      notifyOn: notifyInput.checked,
    });
  });

  return { fill };
}
```

- [ ] **Step 3: `main.js` 작성 (히트맵 + 체크리스트 + 타이머 + 설정 + 알림)**

`focus-grass/js/main.js`:

```js
import { toKey, fromKey, buildHeatmapGrid, canSelect, followToday } from './dateUtils.js';
import { addTodo, toggleTodo, editTodo, removeTodo } from './todos.js';
import {
  createStorage, pickBackend, loadTodos, saveTodos, loadSettings, saveSettings,
  TODOS_KEY, SETTINGS_KEY,
} from './storage.js';
import { renderHeatmap } from './heatmap.js';
import {
  createState, start, pause, resume, reset, tick, msUntilEnd, tabTitle, finishNotice,
} from './pomodoro.js';
import {
  prepareAudio, playSound, requestNotifyPermission, showNotification, setTabTitle,
} from './notify.js';
import { createTodoList } from './ui/todoList.js';
import { createTimerView } from './ui/timerView.js';
import { createSettingsView } from './ui/settingsView.js';

const storage = createStorage(pickBackend());
let todosDoc = loadTodos(storage);
let settings = loadSettings(storage);
let timer = createState();
let titleNotice = null; // 세션이 끝난 직후 탭 제목에 남기는 안내
let todayKey = toKey(new Date());
let selectedKey = todayKey;

const heatmapEl = document.querySelector('#heatmap');
const banner = document.querySelector('#storage-banner');

/* ---------- 체크리스트 / 히트맵 ---------- */

function persistTodos(days) {
  if (days === todosDoc.days) return;
  todosDoc = { ...todosDoc, days };
  saveTodos(storage, todosDoc);
  render();
}

const todoList = createTodoList(document.querySelector('#todo-panel'), {
  onAdd: (text) => persistTodos(addTodo(todosDoc.days, selectedKey, text)),
  onToggle: (id) => persistTodos(toggleTodo(todosDoc.days, selectedKey, id)),
  onEdit: (id, text) => persistTodos(editTodo(todosDoc.days, selectedKey, id, text)),
  onRemove: (id) => persistTodos(removeTodo(todosDoc.days, selectedKey, id)),
  onGoToday: () => { selectedKey = todayKey; render(); },
});

function render() {
  banner.hidden = storage.isPersistent();
  renderHeatmap(heatmapEl, {
    grid: buildHeatmapGrid(fromKey(todayKey)),
    days: todosDoc.days,
    selectedKey,
    onSelect: (key) => {
      if (!canSelect(key, todayKey)) return;
      selectedKey = key;
      render();
    },
  });
  todoList.render({ key: selectedKey, todayKey, list: todosDoc.days[selectedKey] ?? [] });
  renderTimer(Date.now());
}

function checkRollover() {
  const nowKey = toKey(new Date());
  if (nowKey === todayKey) return;
  selectedKey = followToday(selectedKey, todayKey, nowKey);
  todayKey = nowKey;
  render();
}

/* ---------- 설정 ---------- */

const settingsView = createSettingsView(document.querySelector('#settings-form'), {
  onSave(patch) {
    settings = { ...settings, ...patch };
    saveSettings(storage, settings);
    settingsView.fill(settings); // 입력칸을 실제 저장된 값으로 맞춘다 (예: " 7 " -> "7")
    render();
  },
});
settingsView.fill(settings);

/* ---------- 타이머 ---------- */

const MESSAGES = {
  focusDone: () => ({ title: '집중 끝!', body: `${settings.breakMin}분 휴식하세요` }),
  breakDone: () => ({ title: '휴식 끝!', body: '다시 집중해 볼까요?' }),
};

function renderTimer(now) {
  timerView.render({
    state: timer,
    settings,
    now,
    count: settings.pomodoroCount[todayKey] ?? 0,
  });
  setTabTitle(tabTitle(timer, settings, now, titleNotice));
}

function handleTimerEvents(events, endedAt) {
  for (const event of events) {
    titleNotice = finishNotice(event);
    if (event === 'focusDone') {
      // 틱이 늦게 처리돼도(절전 등) 🍅 는 세션이 끝났어야 하는 날에 센다
      const key = toKey(new Date(endedAt));
      settings = {
        ...settings,
        pomodoroCount: { ...settings.pomodoroCount, [key]: (settings.pomodoroCount[key] ?? 0) + 1 },
      };
      saveSettings(storage, settings);
    }
    if (settings.soundOn) playSound(event);
    if (settings.notifyOn) {
      const { title, body } = MESSAGES[event]();
      showNotification(title, body);
    }
  }
}

// 250ms 주기 타이머는 숨겨진 탭에서 브라우저가 1분에 한 번 수준으로 늦출 수 있다.
// 종료 시각에 맞춘 단발 setTimeout 을 함께 걸어 알림이 늦지 않게 한다.
let deadlineTimer = null;

function armDeadline() {
  clearTimeout(deadlineTimer);
  const ms = msUntilEnd(timer, Date.now());
  deadlineTimer = ms === null ? null : setTimeout(runTick, ms + 10);
}

function runTick() {
  const now = Date.now();
  const result = tick(timer, settings, now);
  timer = result.state;
  if (result.events.length > 0) {
    handleTimerEvents(result.events, result.endedAt);
    armDeadline(); // 자동 전환으로 휴식이 시작된 경우를 포함
    render(); // 🍅 카운트 갱신
  } else {
    renderTimer(now);
  }
}

const timerView = createTimerView(document.querySelector('#timer-panel'), {
  onStart() {
    prepareAudio(); // 사용자 클릭 시점에 오디오 컨텍스트 준비
    if (settings.notifyOn) requestNotifyPermission();
    titleNotice = null;
    timer = start(timer, settings, Date.now());
    armDeadline();
    renderTimer(Date.now());
  },
  onPause() { timer = pause(timer, Date.now()); armDeadline(); renderTimer(Date.now()); },
  onResume() { timer = resume(timer, Date.now()); armDeadline(); renderTimer(Date.now()); },
  onReset() { titleNotice = null; timer = reset(); armDeadline(); renderTimer(Date.now()); },
});

setInterval(runTick, 250);

/* ---------- 부팅 ---------- */

render();
heatmapEl.scrollLeft = heatmapEl.scrollWidth;
setInterval(checkRollover, 1000); // 날짜 비교만 하므로 가볍다. 자정 직후 입력이 전날로 들어가는 창을 1초 안으로 줄인다.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  titleNotice = null; // 돌아와서 확인했으면 종료 안내는 지운다
  checkRollover();
  renderTimer(Date.now());
});

// 다른 탭이 저장한 내용을 반영한다. 반영하지 않으면 이 탭의 다음 저장이 그 내용을 덮어쓴다.
window.addEventListener('storage', (event) => {
  if (event.key !== null && event.key !== TODOS_KEY && event.key !== SETTINGS_KEY) return;
  storage.invalidate(TODOS_KEY);
  storage.invalidate(SETTINGS_KEY);
  todosDoc = loadTodos(storage);
  settings = loadSettings(storage);
  settingsView.fill(settings);
  render();
});
```

- [ ] **Step 4: 문법 확인과 회귀 확인**

Run (in `AI/Superpowers/focus-grass`): `for f in js/*.js js/ui/*.js; do node --check "$f"; done && node --test`
Expected: 오류 없이 PASS (0 failures)

- [ ] **Step 5: 브라우저에서 수동 확인**

`focus-grass/`에서 `python3 -m http.server 8000`을 띄우고 `http://localhost:8000`을 연다. 콘솔 오류가 없는지 본 뒤 아래를 하나씩 확인한다.

**A. 체크리스트와 히트맵**

1. 히트맵이 53열 × 7행으로 보이고, 오늘 칸이 선택 표시(검은 테두리)이며 오늘 이후 칸은 보이지 않는다.
2. "운동", "보고서 쓰기"를 추가 → 목록에 나타나고 진행률 `0/2 (0%)`. 오늘 칸이 0% 색(회색)으로 바뀐다.
3. "운동"을 체크 → `1/2 (50%)`, 오늘 칸 색이 한 단계 진해진다. 둘 다 체크 → 가장 진한 초록.
4. 항목을 모두 삭제 → 오늘 칸이 "기록 없음" 색(옅은 회색)으로 돌아가고, 칸 위에 마우스를 올리면 `MM/DD · 기록 없음`.
5. 과거 칸 클릭 → 제목이 해당 날짜로 바뀌고 `오늘로` 버튼이 보인다. 그 날짜에 항목을 추가·체크해도 동작한다. `오늘로`를 누르면 오늘로 돌아온다.
6. 새로고침 후에도 항목과 체크 상태가 유지된다.
7. 공백만 입력하고 Enter → 아무 일도 없다. `<img src=x onerror=alert(1)>` 를 입력 → 알림창이 뜨지 않고 문자열 그대로 보인다. 아주 긴 문장 붙여넣기 → 200자에서 잘린다.
8. 항목을 더블클릭 → 입력창으로 바뀜. 수정 후 Enter로 저장, Esc로 취소, 비우고 Enter면 원래 글자로 복구된다. **한글로 입력·수정**해 보고 마지막 글자가 남거나 중복되지 않는지 본다(조합 중 Enter는 확정되지 않아야 한다).
9. 개발자 도구 Application 탭에서 `ffg:todos` 값을 `[]` 나 `{broken` 로 바꾸고 새로고침 → 오류 없이 빈 목록으로 시작한다.
10. 같은 주소를 **두 번째 탭**으로 열어 한쪽에서 항목을 추가하면 다른 탭에도 곧 나타나고, 그 탭에서 이어서 추가해도 앞선 항목이 사라지지 않는다.

**B. 타이머와 설정**

1. 시작 화면: `대기`, `25:00`, `집중 25분 / 휴식 5분`, `오늘 완료한 🍅: 0`. 버튼은 `시작`, `리셋`만 보인다.
2. `시작` 클릭 → 알림 권한 창이 뜨고(허용/거부 모두 시도), `집중`으로 바뀌며 카운트다운이 1초씩 줄어든다. 탭 제목이 `🍅 24:5x · Focus & Grass`로 바뀐다. 버튼은 `일시정지`, `리셋`. `시작`을 **더블클릭**해도 일시정지되지 않는다.
3. `일시정지` → `집중 (일시정지)`, 시간이 멈추고 탭 제목이 앱 이름으로 돌아온다. 한참 뒤 `재개` → 멈춘 시간부터 다시 줄어든다.
4. `리셋` → `대기`, `25:00`으로 돌아오고 🍅 카운트는 늘지 않는다. 실행 중 `시작` 버튼은 보이지 않아 연타로 재시작할 수 없다.
5. 설정에서 집중을 `1`, 휴식을 `1`로 저장 → 요약이 `집중 1분 / 휴식 1분`, 표시가 `01:00`. `시작`하고 1분을 기다린다.
   - 자동 전환을 끈 상태: **소리가 나고**(소리 켬), **알림이 오고**(허용 시), 🍅 카운트가 `1`이 되며 `휴식 대기` / `휴식 시작` 버튼이 나온다. 탭 제목이 `✅ 집중 끝! · Focus & Grass`로 바뀐다. 누르면 `휴식` 1분이 시작되고(제목은 `☕ …`), 끝나면 소리와 알림 후 `대기`로 돌아가며 제목이 `✅ 휴식 끝! · …`이 된다.
   - 자동 전환을 켠 상태: 집중이 끝나면 곧바로 `휴식`이 시작된다.
   - 소리를 끄면 소리가 나지 않고, 알림을 끄면 알림이 오지 않는다. 알림 권한을 거부한 상태에서는 소리와 탭 제목만 동작한다.
6. 집중 도중 설정을 바꿔 저장 → 진행 중인 카운트다운 길이는 바뀌지 않고, `리셋` 후 새 값이 적용된다.
7. 설정에 `0`, `abc`, `25.5`, `1e1`, `0x10`, 빈 칸, 집중 `121`, 휴식 `61`을 각각 넣고 저장 → 해당 칸 아래에 `1~120 사이의 정수를 입력하세요`(휴식은 `1~60`)가 나오고 값은 저장되지 않는다(새로고침하면 이전 값). ` 7 `처럼 공백이 섞인 정상 값은 저장되고 입력칸이 `7`로 바뀐다.
8. 집중을 끝까지 돌린 뒤 새로고침 → 🍅 카운트는 유지되고, 진행 중이던 타이머는 복원되지 않고 `대기`로 시작한다.
9. 다른 탭으로 이동해 타이머를 돌려도 종료 시점에 정확히 한 번만 카운트가 오르고, 알림이 늦지 않다(탭 제목 안내 포함).
10. 설정 값을 모두 정상으로 되돌려 둔다(집중 25 / 휴식 5).

- [ ] **Step 6: 브라우저 테스트 페이지 작성과 실행**

수동 확인 중 자동화할 수 있는 DOM 동작은 테스트 페이지로 만든다. 두 페이지 모두 앱의 `localStorage`(`ffg:*`)를 비우고 테스트하며, 시작할 때 백업했다가 끝나면 복원한다. 저장소는 서버 주소(호스트+포트) 단위이므로 **앱을 실제로 쓰는 주소와 다른 포트**로 서버를 띄워 연다(예: `python3 -m http.server 8765`).

`focus-grass/tests/browser/ui-smoke.html`:

```html
<!doctype html>
<meta charset="utf-8">
<title>Focus &amp; Grass browser smoke test</title>
<!--
  브라우저 DOM 동작 확인용 페이지 (node --test 대상이 아님).
  1) focus-grass/ 에서 python3 -m http.server 8765
  2) http://localhost:8765/tests/browser/ui-smoke.html 을 열면 PASS/FAIL 목록이 보인다.
  이 페이지는 앱이 쓰는 localStorage(ffg:* 키)를 비우고 테스트합니다. 시작할 때 그 키들을 백업했다가
  끝나면 복원하지만, 도중에 탭을 닫으면 복원되지 않습니다. 위험은 "서버 주소(호스트+포트)" 기준이라
  실제 기록이 있는 주소(예: 앱을 8000 포트로 쓰고 있다면 8000)로는 이 페이지를 열지 말고,
  다른 포트(예: 8765)로 서버를 띄워서 여세요.
-->
<pre id="out"></pre>
<iframe id="app" style="width:1000px;height:900px"></iframe>
<script>
const out = document.getElementById('out');
const frame = document.getElementById('app');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0;
let fail = 0;

const ffgKeys = () => Object.keys(localStorage).filter((k) => k.startsWith('ffg:'));
const backup = Object.fromEntries(ffgKeys().map((k) => [k, localStorage.getItem(k)]));
function restoreStorage() {
  ffgKeys().forEach((k) => localStorage.removeItem(k));
  Object.entries(backup).forEach(([k, v]) => localStorage.setItem(k, v));
  out.textContent += `RESTORED ${Object.keys(backup).length} ffg key(s)\n`;
}

function check(name, ok, extra = '') {
  if (ok) pass += 1; else fail += 1;
  out.textContent += `${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ` ${extra}`}\n`;
}

function load() {
  return new Promise((resolve) => {
    frame.onload = () => resolve(frame.contentDocument);
    frame.src = `/?${Math.random()}`;
  });
}

function reload() {
  return new Promise((resolve) => {
    frame.onload = () => resolve(frame.contentDocument);
    frame.contentWindow.location.reload();
  });
}

const todayKey = (() => {
  const t = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`;
})();

(async () => {
  try {
    let d = await load();
    frame.contentWindow.localStorage.clear();
    d = await reload();
    const w = frame.contentWindow;
    const $ = (s) => d.querySelector(s);
    const $$ = (s) => [...d.querySelectorAll(s)];
    const add = (text) => { $('#todo-input').value = text; $('#todo-form').requestSubmit(); };
    const stored = () => JSON.parse(w.localStorage.getItem('ffg:todos')).days;
    const rows = () => $$('#todo-list li');
    const startEdit = (li) => li.querySelector('.todo-text')
      .dispatchEvent(new w.MouseEvent('dblclick', { bubbles: true }));

    add('alpha');
    add('beta');
    check('S0 two items rendered', rows().length === 2, `got ${rows().length}`);

    // 1) 편집 중 전체 렌더(설정 저장도 render() 를 호출한다)가 편집 상태를 깨면 안 된다
    startEdit(rows()[0]);
    $('.todo-edit').value = 'half typed';
    $('#settings-form').requestSubmit();
    check('F1 edit box survives a full re-render', !!$('.todo-edit') && $('.todo-edit').value === 'half typed');
    check('F1 uncommitted text is not saved', stored()[todayKey][0].text === 'alpha', `stored=${stored()[todayKey][0].text}`);

    // 1b) 한글 등 조합 입력 중의 Enter 는 글자 확정용이라 편집을 확정하면 안 된다
    $('.todo-edit').dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true }));
    check('F1b Enter during IME composition does not commit the edit',
      !!$('.todo-edit') && stored()[todayKey][0].text === 'alpha');
    $('.todo-edit').dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', keyCode: 229, bubbles: true }));
    check('F1b keyCode 229 (older IME events) is ignored too', !!$('.todo-edit'));

    // 2) 편집 확정(blur)으로 생기는 재렌더가 다른 컨트롤 노드를 바꿔치우면 클릭이 사라진다
    const betaLi = rows()[1];
    const betaCheckbox = betaLi.querySelector('input[type=checkbox]');
    const betaDelete = betaLi.querySelector('.todo-del');
    const selectedCell = $('#heatmap .cell.selected');
    $('.todo-edit').value = 'alpha2';
    $('.todo-edit').dispatchEvent(new w.FocusEvent('blur'));
    check('F2 edit is committed on blur', stored()[todayKey][0].text === 'alpha2', `stored=${stored()[todayKey][0].text}`);
    check('F2 other todo row nodes survive the commit re-render',
      betaLi.isConnected && betaCheckbox.isConnected && betaDelete.isConnected);
    check('F2 heatmap cell node survives the commit re-render', selectedCell.isConnected);
    check('F2 row shows the new text', rows()[0].querySelector('.todo-text').textContent === 'alpha2');

    // 3) 같은 노드가 값만 갱신되는지
    betaCheckbox.click();
    check('F3 toggling updates the same row in place',
      betaLi.isConnected && betaCheckbox.checked && betaLi.className === 'done');
    check('F3 heatmap level follows the completion rate (1/2 -> level 2)',
      $('#heatmap .cell.selected').dataset.level === '2', `level=${$('#heatmap .cell.selected').dataset.level}`);
    check('F3 progress text', $('#todo-progress').textContent === '진행률 1/2 (50%)', $('#todo-progress').textContent);

    // 4) 삭제는 해당 행만 제거하고 나머지 노드를 유지
    const alphaLi = rows()[0];
    betaDelete.click();
    check('F4 deleting removes only that row', rows().length === 1 && rows()[0] === alphaLi && !betaLi.isConnected);

    // 5) 실제 사용 경로: 마우스를 누르면 blur 가 먼저 일어나 편집이 원래 날짜에 확정된 뒤 날짜가 바뀐다
    startEdit(rows()[0]);
    $('.todo-edit').value = 'zzz';
    $('.todo-edit').dispatchEvent(new w.FocusEvent('blur'));
    const cells = $$('#heatmap .cell:not(.future)');
    cells[cells.length - 3].click();
    check('F5 switching day leaves no edit box', !$('.todo-edit'));
    check('F5 edit was committed to the original day, other day is empty',
      rows().length === 0 && stored()[todayKey][0].text === 'zzz', `rows=${rows().length}`);
    $('#go-today').click();
    check('F5 coming back shows today list', rows().length === 1 && rows()[0].querySelector('.todo-text').textContent === 'zzz');

    // 5b) blur 없이(자정 이동·프로그램에 의한 렌더) 날짜가 바뀌면 편집은 버려지고 다른 날짜에 쓰이지 않는다
    startEdit(rows()[0]);
    $('.todo-edit').value = 'never saved';
    cells[cells.length - 3].click();
    check('F5b day switch without blur discards the edit and writes nothing',
      !$('.todo-edit') && rows().length === 0 && stored()[todayKey][0].text === 'zzz');
    $('#go-today').click();

    // 6) 같은 날짜 화면에서 항목 추가 시 기존 행/셀 노드 유지, 순서 유지
    const keepLi = rows()[0];
    const keepCell = $('#heatmap .cell.selected');
    add('gamma');
    check('F6 adding keeps existing nodes and appends in order',
      keepLi.isConnected && keepCell.isConnected && rows()[0] === keepLi && rows().length === 2);

    // 7) 두 번째 탭의 변경이 첫 번째 탭의 다음 저장에 덮어써지면 안 된다
    const frameB = document.createElement('iframe');
    frameB.style.cssText = 'width:600px;height:400px';
    document.body.append(frameB);
    await new Promise((resolve) => { frameB.onload = resolve; frameB.src = `/?b${Math.random()}`; });
    const dB = frameB.contentDocument;
    dB.querySelector('#todo-input').value = 'from B';
    dB.querySelector('#todo-form').requestSubmit();
    await wait(300); // storage 이벤트가 탭 A 에 전달될 시간
    check('M1 tab A shows the item that tab B added', rows().some((li) => li.textContent.includes('from B')),
      rows().map((li) => li.textContent).join('|'));
    add('from A');
    const allTexts = Object.values(stored()).flat().map((t) => t.text);
    check('M1 both tabs\' items are stored (no silent overwrite)',
      allTexts.includes('from A') && allTexts.includes('from B'), allTexts.join('|'));
    frameB.remove();

    // 8) 시작 버튼을 더블클릭하면 같은 자리에 나타난 일시정지 버튼이 두 번째 클릭을 받는다
    const click = (el, detail) => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, detail }));
    click($('#btn-start'), 1);
    check('D1 start runs the timer', $('#timer-mode').textContent === '집중');
    click($('#btn-pause'), 2); // 더블클릭의 두 번째 클릭
    check('D1 the second click of a double-click does not pause', $('#timer-mode').textContent === '집중',
      $('#timer-mode').textContent);
    click($('#btn-pause'), 1);
    check('D1 a normal click still pauses', $('#timer-mode').textContent === '집중 (일시정지)');
    click($('#btn-resume'), 2);
    check('D1 a double-click tail does not resume either', $('#timer-mode').textContent === '집중 (일시정지)');
    click($('#btn-resume'), 1);
    check('D1 a normal click resumes', $('#timer-mode').textContent === '집중');
    click($('#btn-reset'), 1);

    // 9) 시간 입력: 저장되면 입력칸이 실제 저장값으로 보정되고, 숫자 이외의 형식은 거부된다
    const saveSettings = (focus, brk) => {
      $('#set-focus').value = focus;
      $('#set-break').value = brk;
      $('#settings-form').requestSubmit();
    };
    saveSettings(' 7 ', '5');
    check('S1 a valid padded value is saved and the box shows the stored value',
      $('#set-focus').value === '7' && $('#timer-summary').textContent === '집중 7분 / 휴식 5분',
      `${$('#set-focus').value} / ${$('#timer-summary').textContent}`);
    saveSettings('1e1', '0x10');
    check('S1 exponent and hex forms are rejected with errors and nothing changes',
      $('#err-focus').textContent !== '' && $('#err-break').textContent !== '' &&
      $('#timer-summary').textContent === '집중 7분 / 휴식 5분');
    saveSettings('25', '5');

    // 10) 대기 중에는 화면(DOM)을 다시 쓰지 않는다
    await wait(400);
    const mutations = [];
    const observer = new w.MutationObserver((records) => mutations.push(...records));
    observer.observe(d.documentElement, { subtree: true, childList: true, characterData: true, attributes: true });
    await wait(1000);
    observer.disconnect();
    check('P1 an idle timer causes no DOM writes', mutations.length === 0,
      `${mutations.length} mutation(s), first on <${mutations[0]?.target.nodeName}>`);

    // 11) 자정을 넘기면(앱을 켜 둔 채) 오늘을 보던 화면이 1~2초 안에 새 날짜로 넘어간다
    const nextDay = new Date();
    nextDay.setDate(nextDay.getDate() + 1);
    const offsetMs = nextDay.getTime() - Date.now();
    const pad2 = (n) => String(n).padStart(2, '0');
    const nextKey = `${nextDay.getFullYear()}-${pad2(nextDay.getMonth() + 1)}-${pad2(nextDay.getDate())}`;
    const RealDate = w.Date;
    w.Date = class extends RealDate {
      constructor(...args) { if (args.length === 0) super(RealDate.now() + offsetMs); else super(...args); }
      static now() { return RealDate.now() + offsetMs; }
    };
    await wait(2200);
    check('R1 viewing today follows the new day after midnight',
      $('#todo-date').textContent === `📅 ${nextKey} (오늘)`, $('#todo-date').textContent);
    w.Date = RealDate;

    restoreStorage();
    out.textContent += `SUMMARY ${pass} pass, ${fail} fail\nDONE\n`;
  } catch (error) {
    restoreStorage();
    out.textContent += `ERROR ${error.message}\nSUMMARY ${pass} pass, ${fail + 1} fail\nDONE\n`;
  }
})();
</script>
```

`focus-grass/tests/browser/timer-smoke.html`:

```html
<!doctype html>
<meta charset="utf-8">
<title>Focus &amp; Grass timer smoke test</title>
<!--
  실제 시간으로 약 4분이 걸리는 타이머 확인용 페이지 (node --test 대상이 아님).
  1) focus-grass/ 에서 python3 -m http.server 8765
  2) http://localhost:8765/tests/browser/timer-smoke.html 을 열고 SUMMARY 줄이 나올 때까지 기다린다.
  앱이 쓰는 localStorage(ffg:* 키)를 비우고 테스트합니다. 시작할 때 백업했다가 끝나면 복원하지만,
  도중에 탭을 닫으면 복원되지 않습니다. 위험은 "서버 주소(호스트+포트)" 기준이므로 실제 기록이 있는
  주소(예: 앱을 8000 포트로 쓰고 있다면 8000)가 아닌 다른 포트(예: 8765)로 서버를 띄워서 여세요.
-->
<pre id="out"></pre>
<iframe id="app" style="width:1000px;height:900px"></iframe>
<script>
const out = document.getElementById('out');
const frame = document.getElementById('app');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0;
let fail = 0;

const ffgKeys = () => Object.keys(localStorage).filter((k) => k.startsWith('ffg:'));
const backup = Object.fromEntries(ffgKeys().map((k) => [k, localStorage.getItem(k)]));
function restoreStorage() {
  ffgKeys().forEach((k) => localStorage.removeItem(k));
  Object.entries(backup).forEach(([k, v]) => localStorage.setItem(k, v));
  out.textContent += `RESTORED ${Object.keys(backup).length} ffg key(s)\n`;
}

function check(name, ok, extra = '') {
  if (ok) pass += 1; else fail += 1;
  out.textContent += `${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ` ${extra}`}\n`;
}

function load() {
  return new Promise((resolve) => {
    frame.onload = () => resolve(frame.contentDocument);
    frame.src = `/?${Math.random()}`;
  });
}

function reload() {
  return new Promise((resolve) => {
    frame.onload = () => resolve(frame.contentDocument);
    frame.contentWindow.location.reload();
  });
}

(async () => {
  try {
    let d = await load();
    frame.contentWindow.localStorage.clear();
    d = await reload();
    const $ = (s) => d.querySelector(s);
    const saveSettings = (focus, brk, auto) => {
      $('#set-focus').value = focus;
      $('#set-break').value = brk;
      $('#set-auto').checked = auto;
      $('#settings-form').requestSubmit();
    };

    // autoSwitch 꺼짐: 집중 종료 -> 휴식 대기, 🍅 1
    saveSettings('1', '1', false);
    $('#btn-start').click();
    await wait(1500);
    check('T1 running shows focus and a ticking tab title', $('#timer-mode').textContent === '집중' && d.title.startsWith('🍅'));
    $('#btn-start').hidden || check('T1 start button hidden while running', false);
    await wait(60500);
    check('T2 focus end -> waiting for break, count 1',
      $('#timer-mode').textContent === '휴식 대기' && $('#pomodoro-count').textContent.endsWith('1') && $('#btn-start').textContent === '휴식 시작',
      `${$('#timer-mode').textContent} / ${$('#pomodoro-count').textContent}`);
    check('T2 tab title announces the finished focus session', d.title === '✅ 집중 끝! · Focus & Grass', d.title);

    // 휴식 시작 -> 끝나면 대기, 카운트 그대로
    $('#btn-start').click();
    await wait(1500);
    check('T3 break running (title shows the break countdown, notice cleared)',
      $('#timer-mode').textContent === '휴식' && d.title.startsWith('☕'), d.title);
    await wait(60500);
    check('T4 break end -> idle, count still 1',
      $('#timer-mode').textContent === '대기' && $('#pomodoro-count').textContent.endsWith('1'),
      `${$('#timer-mode').textContent} / ${$('#pomodoro-count').textContent}`);
    check('T4 tab title announces the finished break', d.title === '✅ 휴식 끝! · Focus & Grass', d.title);

    // autoSwitch 켜짐: 집중 종료 -> 바로 휴식, 🍅 2
    saveSettings('1', '1', true);
    $('#btn-start').click();
    await wait(61500);
    check('T5 autoSwitch: focus end -> break starts at once, count 2',
      $('#timer-mode').textContent === '휴식' && $('#pomodoro-count').textContent.endsWith('2'),
      `${$('#timer-mode').textContent} / ${$('#pomodoro-count').textContent}`);
    // 자동 전환으로 시작된 휴식도 종료 시각에 끝나는지 (단발 타이머 재설정)
    await wait(60500);
    check('T6 auto-started break also ends', $('#timer-mode').textContent === '대기', $('#timer-mode').textContent);

    // 일시정지 / 재개 / 리셋
    $('#btn-start').click();
    await wait(1200);
    $('#btn-pause').click();
    const frozen = $('#timer-display').textContent;
    await wait(1200);
    check('T7 pause freezes the display', $('#timer-display').textContent === frozen && $('#timer-mode').textContent === '집중 (일시정지)');
    $('#btn-resume').click();
    await wait(600);
    $('#btn-reset').click();
    check('T8 reset returns to idle and does not add a pomodoro',
      $('#timer-mode').textContent === '대기' && $('#pomodoro-count').textContent.endsWith('2'),
      `${$('#timer-mode').textContent} / ${$('#pomodoro-count').textContent}`);
    check('T8 reset clears the finish notice from the tab title', d.title === 'Focus & Grass', d.title);

    restoreStorage();
    out.textContent += `SUMMARY ${pass} pass, ${fail} fail\nDONE\n`;
  } catch (error) {
    restoreStorage();
    out.textContent += `ERROR ${error.message}\nSUMMARY ${pass} pass, ${fail + 1} fail\nDONE\n`;
  }
})();
</script>
```

Run: `http://localhost:8765/tests/browser/ui-smoke.html` (몇 초), `http://localhost:8765/tests/browser/timer-smoke.html` (실제 시간으로 약 4분)
Expected: 두 페이지 모두 `SUMMARY N pass, 0 fail` (`FAIL` 줄 없음)

---

### Task 10: 실행 스크립트 (`serve.js`, `run.sh`, `run.bat`)

브라우저는 `file://`로 연 페이지의 ES 모듈을 막으므로 앱을 열려면 서버가 필요하다. 서버는 의존성 없는 Node 스크립트 하나(`serve.js`)로 만들어 macOS·Windows·Linux가 공통으로 쓴다(Node는 테스트에도 이미 필요하다). `run.sh`(macOS/Linux/Git Bash)와 `run.bat`(Windows)은 Node 버전을 확인하고 `serve.js`를 실행하는 얇은 래퍼다.

**Files:**
- Create: `focus-grass/serve.js`
- Create: `focus-grass/run.sh`
- Create: `focus-grass/run.bat`
- Test: `focus-grass/tests/serve.test.js`

**Interfaces:**
- Consumes: 없음 (Node 내장 모듈만 사용)
- Produces (`serve.js`):
  - `resolveRequestPath(root: string, requestUrl: string): string | null` — 요청 URL을 `root` 안의 파일 경로로 바꾼다. `/`→`index.html`, 쿼리·해시는 무시. 서빙하면 안 되는 경로(경로 이탈 `..`·인코딩·역슬래시·NUL·`//` 변형, 숨김 파일, 허용 목록 밖)는 `null`. 허용 목록은 `index.html`, `css/`, `js/`, `tests/browser/` 뿐이다(서버 스크립트, `package.json`, 문서, 단위 테스트는 노출하지 않는다).
  - `mimeFor(file: string): string` — 확장자별 MIME(텍스트는 utf-8), 모르면 `application/octet-stream`
  - `createServer(root: string): http.Server` — GET/HEAD만 허용(그 외 405 + `Allow`), 없는 파일·비허용 경로는 404, `Cache-Control: no-store`
  - 직접 실행(`node serve.js [포트] [--no-open]`)하면 `127.0.0.1`에만 열고(기본 8000, 사용 중이면 다음 포트를 최대 20번 시도), 브라우저를 연다(macOS `open`, Windows `cmd /c start`, 그 외 `xdg-open`). import할 때는 서버를 띄우지 않는다.

- [ ] **Step 1: 실패하는 테스트 작성**

`focus-grass/tests/serve.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { resolveRequestPath, mimeFor, createServer } from '../serve.js';

const ROOT = path.resolve('/app');

test('"/" and directories map to index.html, and app files map to their path', () => {
  assert.equal(resolveRequestPath(ROOT, '/'), path.join(ROOT, 'index.html'));
  assert.equal(resolveRequestPath(ROOT, '/index.html'), path.join(ROOT, 'index.html'));
  assert.equal(resolveRequestPath(ROOT, '/js/main.js'), path.join(ROOT, 'js', 'main.js'));
  assert.equal(resolveRequestPath(ROOT, '/js/ui/todoList.js'), path.join(ROOT, 'js', 'ui', 'todoList.js'));
  assert.equal(resolveRequestPath(ROOT, '/css/style.css'), path.join(ROOT, 'css', 'style.css'));
  assert.equal(
    resolveRequestPath(ROOT, '/tests/browser/ui-smoke.html'),
    path.join(ROOT, 'tests', 'browser', 'ui-smoke.html'),
  );
});

test('query strings and fragments are ignored', () => {
  assert.equal(resolveRequestPath(ROOT, '/index.html?x=1#y'), path.join(ROOT, 'index.html'));
  assert.equal(resolveRequestPath(ROOT, '/?b0.123'), path.join(ROOT, 'index.html'));
});

test('path traversal is rejected in every spelling', () => {
  const attacks = [
    '/../package.json',
    '/js/../../x',
    '/%2e%2e/package.json',
    '/js/%2e%2e/%2e%2e/x',
    '/..%2fpackage.json',
    '/js\\..\\..\\x',
    '/js/%5c..%5c..%5cx',
    '/js/\u0000x',
    '/js/%00x',
    '/%',
    '//etc/passwd',
  ];
  for (const attack of attacks) {
    assert.equal(resolveRequestPath(ROOT, attack), null, attack);
  }
});

test('only the web surface is served: no server script, package files, docs, unit tests or dotfiles', () => {
  const blocked = [
    '/package.json', '/serve.js', '/run.sh', '/run.bat', '/README.md',
    '/tests/dateUtils.test.js', '/tests/storage.test.js', '/tests',
    '/tests/browser/../dateUtils.test.js', '/.git/config', '/js/.hidden', '/.env',
  ];
  for (const url of blocked) {
    assert.equal(resolveRequestPath(ROOT, url), null, url);
  }
});

test('mimeFor returns utf-8 text types and a safe default', () => {
  assert.equal(mimeFor('a/index.html'), 'text/html; charset=utf-8');
  assert.equal(mimeFor('a/main.js'), 'text/javascript; charset=utf-8');
  assert.equal(mimeFor('a/style.css'), 'text/css; charset=utf-8');
  assert.equal(mimeFor('a/data.json'), 'application/json; charset=utf-8');
  assert.equal(mimeFor('a/icon.svg'), 'image/svg+xml');
  assert.equal(mimeFor('a/unknown.bin'), 'application/octet-stream');
  assert.equal(mimeFor('a/UPPER.JS'), 'text/javascript; charset=utf-8');
});

function request(port, method, urlPath) {
  return new Promise((resolve, reject) => {
    // http.request 는 경로를 정규화하지 않으므로 ".." 같은 원본 경로를 그대로 보낼 수 있다
    const req = http.request({ host: '127.0.0.1', port, method, path: urlPath }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('the server serves app files, hides everything else and only answers GET/HEAD', async (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ffg-serve-'));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const root = path.join(tmp, 'web');
  fs.mkdirSync(path.join(root, 'js'), { recursive: true });
  fs.writeFileSync(path.join(root, 'index.html'), '<h1>hello 한글</h1>');
  fs.writeFileSync(path.join(root, 'js', 'a.js'), 'export const a = 1;');
  fs.writeFileSync(path.join(root, 'secret.txt'), 'top secret');
  fs.writeFileSync(path.join(tmp, 'outside.txt'), 'outside the root');

  const server = createServer(root);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const { port } = server.address();

  const home = await request(port, 'GET', '/');
  assert.equal(home.status, 200);
  assert.equal(home.headers['content-type'], 'text/html; charset=utf-8');
  assert.equal(home.headers['cache-control'], 'no-store');
  assert.equal(home.body, '<h1>hello 한글</h1>');

  const js = await request(port, 'GET', '/js/a.js');
  assert.equal(js.status, 200);
  assert.equal(js.headers['content-type'], 'text/javascript; charset=utf-8');
  assert.equal(js.body, 'export const a = 1;');

  assert.equal((await request(port, 'GET', '/js/missing.js')).status, 404);
  assert.equal((await request(port, 'GET', '/secret.txt')).status, 404);
  assert.equal((await request(port, 'GET', '/../outside.txt')).status, 404);
  assert.equal((await request(port, 'GET', '/%2e%2e/outside.txt')).status, 404);

  const head = await request(port, 'HEAD', '/index.html');
  assert.equal(head.status, 200);
  assert.equal(head.body, '');
  assert.ok(Number(head.headers['content-length']) > 0);

  const post = await request(port, 'POST', '/index.html');
  assert.equal(post.status, 405);
  assert.equal(post.headers.allow, 'GET, HEAD');
});
```

- [ ] **Step 2: 실패 확인**

Run (in `AI/Superpowers/focus-grass`): `node --test tests/serve.test.js`
Expected: FAIL — `Cannot find module '.../serve.js'`

- [ ] **Step 3: 구현**

`focus-grass/serve.js`:

```js
// Focus & Grass 로컬 서버: 의존성 없이 앱 파일만 127.0.0.1 로 서빙한다. (macOS / Windows / Linux 공통)
//   node serve.js [포트] [--no-open]
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const DEFAULT_PORT = 8000;
const PORT_TRIES = 20;

// 브라우저가 필요한 파일만 내보낸다. 서버 스크립트, package.json, 문서, 단위 테스트는 노출하지 않는다.
const ALLOWED_TOP = new Set(['index.html', 'css', 'js', 'tests']);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

export function mimeFor(file) {
  return MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
}

// 요청 URL 을 root 안의 파일 경로로 바꾼다. 서빙하면 안 되는 경로는 null.
export function resolveRequestPath(root, requestUrl) {
  const raw = String(requestUrl).split(/[?#]/)[0];
  let decoded;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;
  if (!decoded.startsWith('/') || decoded.startsWith('//')) return null;

  const segments = decoded.replace(/\\/g, '/').split('/').filter(Boolean);
  if (segments.some((s) => s.startsWith('.'))) return null; // ".." 와 숨김 파일(.git, .env 등)
  if (segments.length === 0) segments.push('index.html');

  const [top, second] = segments;
  if (!ALLOWED_TOP.has(top)) return null;
  if (top === 'index.html' && segments.length !== 1) return null;
  if (top === 'tests' && second !== 'browser') return null; // 단위 테스트는 노출하지 않고 브라우저 테스트 페이지만

  const rootDir = path.resolve(root);
  const resolved = path.join(rootDir, ...segments);
  return resolved.startsWith(rootDir + path.sep) ? resolved : null;
}

function notFound(res) {
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
}

export function createServer(root) {
  return http.createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' });
      res.end();
      return;
    }
    const file = resolveRequestPath(root, req.url ?? '/');
    if (!file) {
      notFound(res);
      return;
    }
    fs.stat(file, (statError, stat) => {
      const target = !statError && stat.isDirectory() ? path.join(file, 'index.html') : file;
      fs.stat(target, (error, info) => {
        if (error || !info.isFile()) {
          notFound(res);
          return;
        }
        res.writeHead(200, {
          'Content-Type': mimeFor(target),
          'Content-Length': info.size,
          'Cache-Control': 'no-store', // 코드를 고친 뒤 새로고침하면 바로 반영되게
        });
        if (req.method === 'HEAD') {
          res.end();
          return;
        }
        const stream = fs.createReadStream(target);
        stream.on('error', () => res.destroy());
        stream.pipe(res);
      });
    });
  });
}

function parseArgs(argv) {
  const options = { port: DEFAULT_PORT, open: true, help: false };
  for (const arg of argv) {
    if (arg === '--no-open') options.open = false;
    else if (arg === '-h' || arg === '--help') options.help = true;
    else if (/^\d+$/.test(arg) && Number(arg) <= 65535) options.port = Number(arg);
    else throw new Error(`알 수 없는 인자: ${arg}`);
  }
  return options;
}

// 포트가 사용 중이면 다음 포트로 넘어가며 최대 PORT_TRIES 번 시도한다. 실제 포트를 반환한다.
async function listenOnFreePort(server, startPort) {
  for (let port = startPort; port < startPort + PORT_TRIES; port += 1) {
    try {
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, '127.0.0.1', () => {
          server.off('error', reject);
          resolve();
        });
      });
      return port;
    } catch (error) {
      if (error.code !== 'EADDRINUSE') throw error;
    }
  }
  throw new Error(`${startPort}~${startPort + PORT_TRIES - 1} 포트가 모두 사용 중입니다.`);
}

function openBrowser(url) {
  const [command, args] = {
    darwin: ['open', [url]],
    win32: ['cmd', ['/c', 'start', '', url]],
  }[process.platform] ?? ['xdg-open', [url]];
  try {
    const child = spawn(command, args, { stdio: 'ignore', detached: true });
    child.on('error', () => {}); // 브라우저를 못 열어도 서버는 계속 동작한다 (주소는 출력된다)
    child.unref();
  } catch {
    // 위와 같다
  }
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
  if (options.help) {
    console.log('사용법: node serve.js [포트] [--no-open]\n  포트: 기본 8000 (사용 중이면 다음 포트를 시도)\n  --no-open: 브라우저를 자동으로 열지 않음');
    return;
  }

  const root = path.dirname(fileURLToPath(import.meta.url));
  const server = createServer(root);
  let port;
  try {
    port = await listenOnFreePort(server, options.port);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  const url = `http://localhost:${port}`;
  console.log(`Focus & Grass 실행 중: ${url}`);
  console.log('종료하려면 Ctrl+C 를 누르세요.');
  if (port !== options.port) {
    console.log(`(${options.port} 포트가 사용 중이어서 ${port} 포트로 열었습니다. 포트가 바뀌면 브라우저 저장소(기록)도 따로 보입니다.)`);
  }
  if (options.open) openBrowser(url);

  process.on('SIGINT', () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 500).unref();
  });
}

// `node serve.js` 로 직접 실행했을 때만 서버를 띄운다 (테스트에서 import 할 때는 띄우지 않는다)
const isEntry = process.argv[1]
  && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
if (isEntry) main();
```

- [ ] **Step 4: 통과 확인**

Run: `node --test`
Expected: PASS (0 failures)

- [ ] **Step 5: 실행 래퍼 작성**

`focus-grass/run.sh` (LF 줄바꿈, 실행 권한 필요: `chmod +x run.sh`):

```bash
#!/usr/bin/env bash
# Focus & Grass 실행 스크립트 (macOS / Linux / Windows Git Bash)
#   ./run.sh [포트] [--no-open]
# 실제 서버는 serve.js 하나이고, 이 파일은 Node 확인 후 그것을 실행하는 얇은 래퍼입니다.
set -e
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 가 필요합니다 (18 이상). https://nodejs.org 에서 설치한 뒤 다시 실행하세요." >&2
  exit 1
fi
if ! node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 18 ? 0 : 1)'; then
  echo "Node.js 18 이상이 필요합니다. 현재 버전: $(node --version)" >&2
  exit 1
fi

exec node serve.js "$@"
```

`focus-grass/run.bat` (CRLF 줄바꿈으로 저장한다. 메시지는 콘솔 코드 페이지 문제를 피하려고 영어로 쓴다):

```bat
@echo off
rem Focus & Grass launcher for Windows (double-click or run from cmd)
rem   run.bat [port] [--no-open]
rem The real server is serve.js; this file only checks Node.js and starts it.
chcp 65001 >nul
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required, version 18 or newer. Install it from https://nodejs.org and run this again.
  pause
  exit /b 1
)

node -e "process.exit(Number(process.versions.node.split('.')[0])>=18?0:1)"
if errorlevel 1 (
  echo Node.js 18 or newer is required.
  node --version
  pause
  exit /b 1
)

node serve.js %*
if errorlevel 1 pause
```

- [ ] **Step 6: 실행 확인**

Run (in `AI/Superpowers/focus-grass`): `chmod +x run.sh && bash -n run.sh && ./run.sh --no-open 8777` (서버는 계속 실행되므로 다른 터미널에서 이어서 확인)

1. 출력에 `Focus & Grass 실행 중: http://localhost:8777`이 나온다.
2. `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8777/` → `200`. `/js/main.js`, `/css/style.css`, `/tests/browser/ui-smoke.html`도 `200`.
3. 앱 파일이 아닌 것은 `404`: `/package.json`, `/serve.js`, `/run.sh`, `/README.md`, `/tests/storage.test.js`, `/.git/config`. `curl --path-as-is http://127.0.0.1:8777/../package.json` → `404`. `curl -X POST http://127.0.0.1:8777/` → `405`.
4. 서버는 `127.0.0.1`에만 열려 있다 (`lsof -nP -iTCP:8777 -sTCP:LISTEN`의 주소가 `127.0.0.1:8777`).
5. 같은 명령(`./run.sh --no-open 8777`)을 한 번 더 실행하면 `8778 포트로 열었습니다` 안내와 함께 다음 포트로 뜬다.
6. `http://localhost:8777/tests/browser/ui-smoke.html`의 결과가 `0 fail` (이 서버로 앱이 정상 동작함을 확인).
7. `Ctrl+C`(또는 `kill -INT`)로 정상 종료되고 포트가 비워진다.
8. `./run.sh --no-open 9000`처럼 포트를 지정하면 그 포트로 열린다. 브라우저 자동 열기는 `--no-open`을 빼고 실행해 확인한다.
9. Windows에서는 `run.bat`을 더블클릭해 같은 동작을 확인한다. **이 계획을 구현한 환경(macOS)에서는 `run.bat`을 실행해 보지 못했으므로, Windows 확인은 별도로 필요하다.**

---

### Task 11: README와 최종 점검

**Files:**
- Create: `focus-grass/README.md`

**Interfaces:**
- Consumes: 앞선 모든 태스크의 산출물
- Produces: 실행·테스트 방법 문서

- [ ] **Step 1: `README.md` 작성**

`focus-grass/README.md`:

````markdown
# Focus & Grass 🍅🌱

오늘의 할 일을 체크리스트로 기록하고, 날짜별 달성 현황을 GitHub 잔디처럼 **히트맵**으로 보여 주며, 집중 시간 관리를 위한 **포모도로 타이머**(기본 25분 집중 / 5분 휴식, 조절 가능)를 한 화면에서 쓰는 개인용 웹앱입니다.

- 설치할 패키지가 없습니다. 빌드도 필요 없습니다. (Node.js만 있으면 됩니다.)
- 서버·계정·로그인이 없습니다. 기록은 **내 브라우저 안(`localStorage`)에만** 저장되고 어디로도 전송되지 않습니다.

```
┌──────────────────────────────────────────────┐
│  🍅 Focus & Grass                            │
├──────────────────────────────────────────────┤
│  [히트맵]  최근 53주 × 7요일, 칸 = 하루         │
│   범례: 기록 없음 · 적음 ▢▤▥▦▣ 많음            │
├───────────────────────┬──────────────────────┤
│  [체크리스트]           │  [포모도로]            │
│  📅 2026-10-13 (오늘)   │      25:00           │
│  ☑ 보고서 쓰기          │  [시작] [일시정지] [리셋]│
│  ☐ 운동                │  집중 25분 / 휴식 5분   │
│  [+ 할 일 추가]         │  ⚙ 시간 설정           │
│  진행률 1/2 (50%)       │  오늘 완료한 🍅: 2      │
└───────────────────────┴──────────────────────┘
```

## 목차

- [빠른 시작](#빠른-시작)
- [주요 기능](#주요-기능)
- [사용법](#사용법)
- [실행 상세](#실행-상세)
- [데이터와 개인정보](#데이터와-개인정보)
- [테스트](#테스트)
- [프로젝트 구조](#프로젝트-구조)
- [문제 해결](#문제-해결)
- [알려진 한계](#알려진-한계)
- [설계 문서](#설계-문서)

## 빠른 시작

[Node.js](https://nodejs.org) 18 이상이 필요합니다.

**macOS / Linux** (Windows의 Git Bash에서도 됩니다)

```bash
cd focus-grass
./run.sh
```

**Windows**: `run.bat`을 더블클릭하세요.

브라우저가 자동으로 열리며 `http://localhost:8000`에서 앱이 보입니다. 끄려면 터미널에서 `Ctrl+C`를 누르세요.

## 주요 기능

### ✅ 날짜별 체크리스트
- 할 일을 추가·체크·삭제하고, 더블클릭해서 제목을 수정합니다.
- **날짜별로 완전히 분리**됩니다. 안 끝낸 일이 다음 날로 넘어가지 않으므로 기록이 그대로 남습니다.
- 지난 날짜도 열어서 보고 수정할 수 있습니다. 미래 날짜는 열 수 없습니다.
- 하단에 그날의 진행률(`완료/전체`, %)을 보여 줍니다.

### 🌱 달성 히트맵
- 최근 **53주 × 7요일**, 칸 하나가 하루입니다.
- 칸 색은 그날의 **완료율**(완료 ÷ 전체)입니다. 많이 끝낼수록 진해집니다.

  | 색 | 의미 |
  |---|---|
  | 옅은 회색 | 기록 없음 (그날 할 일이 하나도 없음) |
  | 회색 | 할 일은 있지만 완료 0% |
  | 연한 초록 → 진한 초록 | 완료율 ~25% / ~50% / ~75% / 100% |

- 칸 위에 마우스를 올리면 `10/12 · 3/4 완료 (75%)`처럼 보입니다.
- 칸을 누르면 그 날짜의 체크리스트로 이동합니다. 포모도로 횟수는 히트맵에 반영되지 않습니다.

### 🍅 포모도로 타이머
- 기본 **집중 25분 / 휴식 5분**. 설정에서 집중 1~120분, 휴식 1~60분(정수)로 바꿀 수 있습니다.
- 시작·일시정지·재개·리셋을 지원합니다. 할 일과는 독립적으로 동작합니다.
- **자동 전환** 옵션: 켜면 집중이 끝나자마자 휴식이 시작됩니다. 끄면 "휴식 시작" 버튼을 눌러야 합니다. (휴식이 끝나면 항상 대기 상태이고, 다음 집중은 직접 시작합니다.)
- 집중을 끝까지 마치면 오늘 완료한 🍅 카운트가 올라갑니다. 리셋한 세션은 세지 않습니다.
- 종료 알림은 세 가지입니다. **소리**(집중 종료·휴식 종료가 서로 다른 음), **브라우저 알림**, **탭 제목**(`🍅 24:13 · Focus & Grass`, 끝나면 `✅ 집중 끝! · Focus & Grass`). 알림 권한을 거부해도 소리와 탭 제목은 동작합니다.
- 다른 탭이나 창에 가 있어도 종료 시각에 맞춰 알려 줍니다.

### 기타
- **여러 탭**: 같은 앱을 두 탭에 열어도 서로의 기록을 덮어쓰지 않고, 한쪽의 변경이 다른 쪽에 곧 반영됩니다. (타이머는 탭마다 따로 돌아갑니다.)
- **자정**: 앱을 켜 둔 채 자정이 지나면 "오늘" 화면이 새 날짜로 넘어갑니다. 과거 날짜를 보고 있었다면 그대로 둡니다.
- **저장소를 쓸 수 없을 때**(브라우저 설정으로 막힘 등): "저장되지 않습니다" 배너를 띄우고 메모리로만 동작합니다. 탭을 닫으면 사라집니다.
- 새로고침하거나 탭을 닫으면 **진행 중이던 타이머는 복원되지 않고** 대기 상태로 돌아갑니다. (기록과 🍅 카운트는 유지됩니다.)

## 사용법

| 하고 싶은 일 | 방법 |
|---|---|
| 할 일 추가 | 입력창에 쓰고 Enter 또는 `추가` (최대 200자) |
| 완료 표시 | 항목 앞의 체크박스 |
| 제목 수정 | 항목을 **더블클릭** → Enter로 저장, Esc로 취소 |
| 삭제 | 항목 오른쪽 `✕` |
| 지난 날짜 보기/수정 | 히트맵에서 그 날짜 칸 클릭 → `오늘로` 버튼으로 복귀 |
| 집중 시작 | `시작` (처음 누를 때 알림 권한을 요청합니다) |
| 잠깐 멈춤 | `일시정지` → `재개` |
| 처음부터 다시 | `리셋` |
| 시간 바꾸기 | `⚙ 시간 설정`에서 집중/휴식 분을 입력하고 `저장` |

- 시간 입력은 **숫자만** 받습니다(`25`, ` 25 ` 가능 / `25.5`, `1e1`, `abc` 불가). 잘못된 값은 저장되지 않고 오류 문구가 나옵니다.
- 집중 도중에 설정을 바꾸면 진행 중인 세션에는 적용되지 않고 **다음 세션부터** 적용됩니다.
- 설정의 소리·알림·자동 전환 체크박스는 `저장`을 눌러야 적용됩니다.

## 실행 상세

```bash
./run.sh              # 기본 포트 8000, 브라우저 자동 열기
./run.sh 9000         # 포트 지정
./run.sh --no-open    # 브라우저를 자동으로 열지 않음
./run.sh --help       # 도움말
```

Windows는 `run.bat [포트] [--no-open]` 형식입니다(명령 프롬프트).

- **왜 서버가 필요한가요?** 브라우저는 `file://`로 연 페이지의 ES 모듈을 막습니다. 그래서 `index.html`을 더블클릭해서는 열리지 않습니다.
- **서버는 어떻게 생겼나요?** `serve.js`(Node 내장 모듈만 사용) 하나가 서버이고, `run.sh`·`run.bat`은 Node 버전을 확인하고 그것을 실행하는 얇은 래퍼입니다. 맥·윈도우·리눅스에서 똑같이 동작합니다.
- **보안**: 서버는 내 컴퓨터(`127.0.0.1`)에서만 접근할 수 있고, 앱 파일(`index.html`, `css/`, `js/`, `tests/browser/`)만 내보냅니다. `package.json`, `serve.js`, 문서, 단위 테스트, 숨김 파일, `..`로 상위 폴더를 읽는 시도는 모두 404입니다. GET/HEAD 외의 요청은 405입니다.
- **포트 충돌**: 지정한(또는 기본) 포트가 사용 중이면 다음 포트(최대 20개)로 자동으로 넘어가며 화면에 알려 줍니다.
- Node 대신 파이썬이 있다면 `python3 -m http.server 8000`으로도 열 수 있습니다.
- 실행 권한 오류(`Permission denied`)가 나면 `chmod +x run.sh` 후 다시 실행하거나 `bash run.sh`로 실행하세요.

## 데이터와 개인정보

- 기록은 브라우저 `localStorage`의 두 키에만 저장됩니다.
  - `ffg:todos`: 날짜별 할 일 (`{ "version": 1, "days": { "2026-10-13": [ { "id", "text", "done" } ] } }`)
  - `ffg:settings`: 집중/휴식 분, 자동 전환, 소리·알림 설정, 날짜별 🍅 횟수
- 외부 서버로 아무것도 보내지 않습니다. 계정도, 추적도 없습니다.
- **저장소는 주소(호스트+포트) 단위로 따로**입니다. `localhost:8000`에서 쓴 기록은 `localhost:8001`이나 `127.0.0.1:8000`에서는 보이지 않습니다. 항상 같은 주소로 여세요. (포트를 고정하려면 `./run.sh 8000`.)
- 브라우저의 "사이트 데이터 삭제"나 시크릿 창은 기록을 지우거나 따로 취급합니다. 백업이 필요하면 개발자 도구 → Application(저장소) → Local Storage에서 위 두 키의 값을 복사해 두세요.
- 날짜는 **로컬 시간대**의 `YYYY-MM-DD`로 기록됩니다.
- 저장된 값이 손상됐거나 모양이 틀려도 앱이 멈추지 않습니다. 해당 부분만 버리고 계속 동작합니다.

## 테스트

Node 18 이상이 필요하고 설치할 패키지는 없습니다.

```bash
cd focus-grass
node --test
```

순수 로직(날짜 계산, 할 일, 설정 검증, 저장 데이터 정규화, 히트맵 레벨, 타이머 상태 머신, 알림 래퍼)과 서버(경로 이탈 방어, 허용 파일, MIME, 메서드)를 79개 테스트로 확인합니다.

### 브라우저 테스트

화면(DOM) 동작은 브라우저 페이지로 확인합니다. 서버를 띄운 뒤(`./run.sh --no-open 8765`) 아래 주소를 열면 `PASS`/`FAIL` 목록이 나옵니다.

- `http://localhost:8765/tests/browser/ui-smoke.html`: 체크리스트·히트맵·편집·여러 탭·더블클릭·설정 입력·자정 이동 (몇 초)
- `http://localhost:8765/tests/browser/timer-smoke.html`: 1분 집중/휴식 사이클, 자동 전환, 종료 안내 제목 (실제 시간으로 약 4분)

**주의:** 두 페이지는 앱의 `localStorage`(`ffg:*` 키)를 비우고 테스트합니다. 시작할 때 백업했다가 끝나면 복원하지만, 도중에 탭을 닫으면 복원되지 않습니다. 저장소는 주소 단위이므로, 앱을 실제로 쓰는 주소(예: `localhost:8000`)가 **아닌 다른 포트**로 서버를 띄워서 여세요.

소리, 실제 브라우저 알림, 한글 입력기(IME)의 실제 조합 동작은 자동으로 확인하지 못하므로 직접 써 보며 확인하세요.

## 프로젝트 구조

```
focus-grass/
├── index.html            # 화면 골격
├── css/style.css
├── js/
│   ├── main.js           # 부팅, 상태 보관, 모듈 연결, 타이머 루프, 다른 탭 변경 반영
│   ├── dateUtils.js      # 로컬 날짜 키, 53주 격자, 자정 이동          [순수]
│   ├── todos.js          # 추가/토글/수정/삭제, 완료율, 글자 수 제한    [순수]
│   ├── settings.js       # 기본값, 시간 입력 검증                      [순수]
│   ├── pomodoro.js       # 타이머 상태 머신, 탭 제목 문구, 시간 포맷   [순수]
│   ├── storage.js        # localStorage 접근, 데이터 정규화, 메모리 폴백
│   ├── heatmap.js        # 완료율 → 레벨(순수) + 히트맵 렌더링
│   ├── notify.js         # 소리, 브라우저 알림, 탭 제목
│   └── ui/               # todoList.js, timerView.js, settingsView.js
├── tests/
│   ├── *.test.js         # 단위 테스트 (node --test)
│   └── browser/          # 브라우저 테스트 페이지
├── serve.js              # 로컬 서버 (공통)
├── run.sh                # macOS / Linux / Git Bash 실행
├── run.bat               # Windows 실행
└── package.json
```

설계 원칙은 다음과 같습니다.
- **규칙을 가진 로직은 DOM과 저장소를 모르는 순수 모듈**로 두어 브라우저 없이 테스트합니다. `ui/`는 화면 그리기와 입력만 맡고 규칙을 갖지 않습니다.
- `localStorage` 접근은 `storage.js`만 합니다.
- 타이머는 "종료 시각 − 현재 시각"으로 남은 시간을 계산합니다(탭이 느려져도 어긋나지 않습니다). 종료 시각에 맞춘 타이머를 따로 걸어 숨겨진 탭에서도 알림이 늦지 않게 합니다.

## 문제 해결

| 증상 | 원인과 해결 |
|---|---|
| 이전에 쓴 기록이 안 보임 | 주소(포트)가 바뀌었을 가능성이 큽니다. 처음 쓰던 주소(예: `localhost:8000`)로 열어 보세요. 포트가 사용 중이면 `run.sh`가 다음 포트로 열고 화면에 알려 줍니다. 그 포트를 쓰던 프로그램을 끄고 다시 실행하세요. |
| 페이지가 비어 있음 / 모듈 오류 | `index.html`을 파일로 직접 열었을 때 나타납니다. `run.sh`(또는 `run.bat`)로 여세요. |
| `Node.js 가 필요합니다` | Node.js 18 이상을 설치하세요(https://nodejs.org). `node --version`으로 확인할 수 있습니다. |
| `Permission denied` (맥/리눅스) | `chmod +x run.sh` 후 다시 실행하거나 `bash run.sh`로 실행하세요. |
| 소리가 안 남 | 설정에서 소리가 켜져 있는지, 그리고 **`시작` 버튼을 눌렀는지** 확인하세요. 브라우저 정책상 소리는 사용자 클릭 이후에만 재생됩니다. |
| 알림이 안 옴 | 처음 `시작`을 눌렀을 때 알림을 허용했는지, 설정에서 브라우저 알림이 켜져 있는지, 브라우저·OS의 알림 차단(집중 모드 등)을 확인하세요. 알림이 막혀 있어도 소리와 탭 제목 `✅ 집중 끝!`으로 알 수 있습니다. |
| "저장되지 않습니다" 배너 | 브라우저가 저장소를 막았거나 가득 찬 상태입니다. 시크릿 창이거나 사이트 데이터 차단 설정이 아닌지 확인하세요. 이 상태에서는 탭을 닫으면 기록이 사라집니다. |
| 서버가 안 꺼짐 | 실행한 터미널에서 `Ctrl+C`를 누르세요. 터미널을 잃었다면 맥에서 `lsof -nP -iTCP:8000 -sTCP:LISTEN`으로 프로세스를 찾아 종료할 수 있습니다. |

## 알려진 한계

- 히트맵 칸이 모두 Tab 이동 대상이라 **키보드만으로는 불편**합니다. 마우스 사용을 전제로 합니다.
- 편집 중에 자정이 지나 화면이 새 날짜로 넘어가면 그 편집은 저장되지 않고 버려집니다.
- 여러 탭을 열면 타이머는 탭마다 독립적으로 돌고, 저장된 기록만 공유합니다.
- 다기기 동기화, 내보내기/가져오기, 미완료 이월, 포모도로와 할 일의 연결은 없습니다.
- Chrome에서 검증했습니다. 다른 최신 브라우저(Safari, Firefox, Edge)는 같은 표준 기능만 쓰지만 직접 확인하지는 않았습니다. `run.bat`(Windows)도 맥에서 만들어서 실행해 보지 못했습니다.

## 설계 문서

- 설계 스펙: [`../docs/superpowers/specs/2026-10-13-focus-grass-design.md`](../docs/superpowers/specs/2026-10-13-focus-grass-design.md)
- 구현 계획: [`../docs/superpowers/plans/2026-10-13-focus-grass.md`](../docs/superpowers/plans/2026-10-13-focus-grass.md)
````

- [ ] **Step 2: 전체 테스트 실행**

Run (in `AI/Superpowers/focus-grass`): `node --test`
Expected: PASS — 8개 테스트 파일(`dateUtils`, `todos`, `settings`, `storage`, `heatmap`, `pomodoro`, `notify`, `serve`) 전부, 0 failures

- [ ] **Step 3: 브라우저 테스트와 스펙 요구사항 최종 점검**

1. Task 9 Step 6의 두 브라우저 테스트 페이지가 모두 `0 fail`인지 다시 확인한다.
2. `python3 -m http.server 8000`으로 앱을 열고, 스펙 문서와 대조해 빠진 것이 없는지 훑는다. 화면 3영역(히트맵 / 체크리스트 / 포모도로)과 히트맵 범례가 있고, 콘솔에 오류·경고가 없다.
3. `localStorage`가 막힌 상황(시크릿 창이나 저장소 차단 설정)에서 `저장되지 않습니다` 배너가 뜨고 앱이 계속 동작하는지 확인한다(가능한 경우).

---

## 부록: 구현 이력과 알려진 한계

**코드 리뷰로 보강된 부분.** 구현 후 코드 리뷰(2회)와 수정 패스에서 아래 결함이 나와 코드·테스트에 반영했고, 이 계획서의 설명과 코드 블록도 그에 맞춰 갱신했다. 위 Review Focus 5가지에 더해 이 상황들이 테스트로 고정되어 있다.

- 편집 중 전체 렌더가 일어나면(타이머 종료, 설정 저장, 자정 이동) 편집창이 사라지고 확정하지 않은 글자가 저장되던 문제, 편집 확정 직후 다른 체크박스·삭제 버튼 클릭이 유실되던 문제 → 목록·히트맵 DOM 재사용(Task 5, 8).
- 숨겨진 탭에서 종료 알림이 최대 1분 늦던 문제 → 종료 시각에 맞춘 단발 `setTimeout`(`msUntilEnd`, Task 6, 9).
- 두 탭을 열면 나중에 저장한 탭이 앞선 탭의 데이터를 덮어쓰던 문제 → `storage` 이벤트 + `storage.invalidate`(Task 4, 9).
- 저장소가 가득 차면 기존 기록이 모두 안 보이던 문제 → `pickBackend`는 읽기만 확인(Task 4). 한 번 실패한 뒤에도 저장이 성공하면 배너가 사라진다.
- 시작 버튼 더블클릭 시 같은 자리의 일시정지 버튼이 두 번째 클릭을 받던 문제 → `detail > 1` 무시(Task 9).
- 알림이 거부되면 종료를 알릴 방법이 없던 문제 → 종료 시 탭 제목에 `✅ …` 안내(`tabTitle`, `finishNotice`, Task 6, 9).
- 🍅가 끝난 날이 아니라 틱이 처리된 날에 집계되던 문제 → `tick`이 `endedAt`을 반환(Task 6, 9).
- 자정 직후 최대 30초 동안 입력이 전날로 들어가던 문제 → 날짜 확인 주기를 1초로(Task 9).
- `1e1`, `0x10`, `10.0` 같은 시간 입력이 받아들여지고 입력칸이 보정되지 않던 문제 → 숫자만 허용, 저장 후 입력칸 갱신(Task 3, 9).
- 저장소의 공백뿐인 항목·중복 id, 200자 제한이 이모지를 반으로 자르던 문제(Task 2, 4).
- 한글 입력 조합 중 Enter가 편집을 확정하던 문제(Task 8), `new Notification` 예외(Task 7), 대기 중 250ms마다 DOM을 다시 쓰던 문제(Task 9).

**알려진 한계 (의도적으로 두었음)**
- 히트맵 칸이 모두 Tab 이동 대상이라 키보드만으로는 지나가기 번거롭다 (마우스 사용을 전제로 함).
- 편집 중에 자정이 지나 날짜 화면이 바뀌면 그 편집은 저장되지 않고 버려진다.
- 설정 체크박스(자동 전환, 소리, 알림)는 "저장"을 눌러야 적용된다.
- 두 탭이 각각 독립된 타이머를 돌린다(저장 데이터만 공유).
- 브라우저 테스트 페이지는 도중에 탭을 닫으면 백업한 저장소를 복원하지 못한다.
- 서버 포트가 사용 중이어서 다음 포트로 넘어가면 브라우저 저장소(주소 단위)가 달라져 이전 기록이 보이지 않는다. 항상 같은 포트를 쓰려면 포트를 지정한다.
- `run.bat`(Windows)은 macOS에서 구현해 실행해 보지 못했다. `serve.js`와 `run.sh`는 macOS에서 실행해 검증했다.
- 실제 소리와 브라우저 알림, 한글 입력기(IME) 조합의 실제 동작은 자동 검증하지 못했다(이벤트를 흉내 낸 검사만 있다). 직접 확인이 필요하다.
