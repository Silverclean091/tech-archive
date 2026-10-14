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
