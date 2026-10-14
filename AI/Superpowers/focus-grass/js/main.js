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
