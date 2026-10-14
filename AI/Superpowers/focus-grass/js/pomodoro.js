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
