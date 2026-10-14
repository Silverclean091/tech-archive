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
