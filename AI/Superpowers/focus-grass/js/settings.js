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
