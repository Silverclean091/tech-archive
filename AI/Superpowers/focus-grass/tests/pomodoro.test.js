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
