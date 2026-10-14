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
