/* GlowTimer by SWC behaviour */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const SETTINGS_KEY = "glowtimer_prefs_v1";
const STATS_KEY = "glowtimer_stats_v1";

const defaultPrefs = {
  focus: 25,
  short: 5,
  long: 15,
  autoNext: false,
  sound: true,
};

const state = {
  mode: "focus",
  total: defaultPrefs.focus * 60,
  left: defaultPrefs.focus * 60,
  running: false,
  intervalId: null,
  cycle: 0,
};

let audioCtx = null;
function ensureAudioCtx() {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {}
  }
}

function loadPrefs() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    return saved ? { ...defaultPrefs, ...saved } : { ...defaultPrefs };
  } catch {
    return { ...defaultPrefs };
  }
}
function savePrefs(p) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(p));
}
function loadStats() {
  try {
    const saved = JSON.parse(localStorage.getItem(STATS_KEY));
    return (
      saved || { today: dateKey(), todayCount: 0, streak: 0, totalMinutes: 0 }
    );
  } catch {
    return { today: dateKey(), todayCount: 0, streak: 0, totalMinutes: 0 };
  }
}
function saveStats(s) {
  localStorage.setItem(STATS_KEY, JSON.stringify(s));
}
function dateKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

let prefs = loadPrefs();
let stats = loadStats();

const minutesEl = $("#minutes");
const secondsEl = $("#seconds");
const ring = $(".ring");
const modeLabel = $("#modeLabel");
const linearProgress = $("#linearProgress");

const startPauseBtn = $("#startPause");
const resetBtn = $("#reset");
const skipBtn = $("#skip");

const chips = $$(".chip");

const settingsDlg = $("#settings");
const openSettingsBtn = $("#openSettings");
const focusIn = $("#setFocus");
const shortIn = $("#setShort");
const longIn = $("#setLong");
const autoNextIn = $("#autoNext");
const chimeToggle = $("#chimeToggle");
const resetPrefsBtn = $("#resetPrefs");

const notifyAsk = $("#notifyAsk");

const todayCountEl = $("#todayCount");
const streakDaysEl = $("#streakDays");
const totalMinutesEl = $("#totalMinutes");

function init() {
  setMode("focus", false);
  focusIn.value = prefs.focus;
  shortIn.value = prefs.short;
  longIn.value = prefs.long;
  autoNextIn.checked = prefs.autoNext;
  chimeToggle.checked = prefs.sound;

  refreshStats();
  updateDisplay();
}
init();

function setMode(next, resetTimer = true) {
  const allowed = ["focus", "short", "long"];
  if (!allowed.includes(next)) return; // guard bad clicks

  state.mode = next;
  chips.forEach((c) => c.classList.toggle("active", c.dataset.mode === next));

  const minutes = Number(prefs[next]);
  const safeMinutes =
    Number.isFinite(minutes) && minutes > 0 ? minutes : defaultPrefs[next];

  if (resetTimer) {
    state.total = safeMinutes * 60;
    state.left = state.total;
    state.running = false;
    clearInterval(state.intervalId);
    startPauseBtn.textContent = "Start";
  } else {
    state.total = safeMinutes * 60;
    // keep state.left as is so partial progress can carry if you changed lengths mid run
    // but clamp it to the new total to avoid ratio > 1
    state.left = Math.min(state.left, state.total);
  }

  modeLabel.textContent =
    next === "focus"
      ? "Time to focus"
      : next === "short"
      ? "Short break"
      : "Long break";
  updateDisplay();
}

function formatTime(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return [m, s];
}
function updateDisplay() {
  const left = Math.max(0, state.left);
  const [m, s] = formatTime(left);
  minutesEl.textContent = m;
  secondsEl.textContent = s;

  const safeTotal =
    Number.isFinite(state.total) && state.total > 0 ? state.total : 1;
  const rawRatio = 1 - left / safeTotal;
  const ratio = Math.max(
    0,
    Math.min(1, Number.isFinite(rawRatio) ? rawRatio : 0)
  );

  const angle = 360 * ratio;
  if (Number.isFinite(angle)) {
    ring.style.setProperty("--progress", angle + "deg");
  }

  const width = 100 * ratio;
  if (Number.isFinite(width)) {
    linearProgress.style.width = width.toFixed(2) + "%";
  }
}

function tick() {
  if (!state.running) return;
  state.left -= 1;
  if (state.left <= 0) {
    finishSession();
  }
  updateDisplay();
}

function start() {
  if (state.running) return;
  state.running = true;
  startPauseBtn.textContent = "Pause";
  clearInterval(state.intervalId);
  ensureAudioCtx();
  try {
    audioCtx?.resume?.();
  } catch {}
  state.intervalId = setInterval(tick, 1000);
}

function pause() {
  state.running = false;
  startPauseBtn.textContent = "Start";
  clearInterval(state.intervalId);
}
function reset() {
  pause();
  state.left = state.total;
  updateDisplay();
}
function skip() {
  pause();
  state.left = 0;
  finishSession();
}

function finishSession() {
  pause();
  state.left = 0;
  updateDisplay();
  chime();
  notify(`${prettyMode(state.mode)} finished`, "Nice work");
  if (state.mode === "focus") {
    const today = dateKey();
    if (stats.today !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yKey = dateKey(yesterday);
      stats.streak =
        stats.today === yKey && stats.todayCount > 0
          ? stats.streak + 1
          : stats.streak;
      stats.today = today;
      stats.todayCount = 0;
    }
    stats.todayCount += 1;
    stats.totalMinutes += Math.round(state.total / 60);
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
    refreshStats();
    state.cycle += 1;
  }

  let next = "focus";
  if (state.mode === "focus") {
    next = state.cycle % 4 === 0 ? "long" : "short";
  } else {
    next = "focus";
  }
  setMode(next);
  if (prefs.autoNext) start();
}

function prettyMode(m) {
  return m === "focus" ? "Focus" : m === "short" ? "Short break" : "Long break";
}

function refreshStats() {
  const today = dateKey();
  if (stats.today !== today) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yKey = dateKey(yesterday);
    stats.streak =
      stats.today === yKey && stats.todayCount > 0
        ? stats.streak + 1
        : stats.streak;
    stats.today = today;
    stats.todayCount = 0;
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  }
  todayCountEl.textContent = stats.todayCount;
  streakDaysEl.textContent = stats.streak;
  totalMinutesEl.textContent = stats.totalMinutes;
}

// CHANGED: reuse the AudioContext instead of creating one every time
function chime() {
  if (!prefs.sound) return;
  try {
    ensureAudioCtx();
    if (!audioCtx) return;

    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "sine";
    o.frequency.value = 880;
    o.connect(g);
    g.connect(audioCtx.destination);

    const t0 = audioCtx.currentTime;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.2, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.6);

    o.start(t0);
    o.stop(t0 + 0.65);
  } catch {}
}

function notify(title, body) {
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    new Notification(title, { body });
  }
}
notifyAsk?.addEventListener("click", (e) => {
  e.preventDefault();
  if (!("Notification" in window)) return;
  Notification.requestPermission().then((perm) => {
    if (perm === "granted")
      notify("Notifications enabled", "I will remind you when time is up");
  });
});

startPauseBtn.addEventListener("click", () =>
  state.running ? pause() : start()
);
resetBtn.addEventListener("click", reset);
skipBtn.addEventListener("click", skip);

chips
  .filter((ch) => typeof ch.dataset.mode === "string")
  .forEach((ch) =>
    ch.addEventListener("click", () => setMode(ch.dataset.mode))
  );

openSettingsBtn.addEventListener("click", () => settingsDlg.showModal());
settingsDlg.addEventListener("close", () => {
  if (settingsDlg.returnValue === "ok") {
    prefs.focus = clamp(intVal(focusIn.value), 1, 180);
    prefs.short = clamp(intVal(shortIn.value), 1, 60);
    prefs.long = clamp(intVal(longIn.value), 1, 120);
    prefs.autoNext = autoNextIn.checked;
    prefs.sound = chimeToggle.checked;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(prefs));
    setMode(state.mode);
  } else {
    focusIn.value = prefs.focus;
    shortIn.value = prefs.short;
    longIn.value = prefs.long;
    autoNextIn.checked = prefs.autoNext;
    chimeToggle.checked = prefs.sound;
  }
});
resetPrefsBtn.addEventListener("click", () => {
  prefs = {
    ...{ focus: 25, short: 5, long: 15, autoNext: false, sound: true },
  };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(prefs));
  setMode("focus");
  focusIn.value = prefs.focus;
  shortIn.value = prefs.short;
  longIn.value = prefs.long;
  autoNextIn.checked = prefs.autoNext;
  chimeToggle.checked = prefs.sound;
});

window.addEventListener("keydown", (e) => {
  if (e.target.matches("input, textarea")) return;
  if (e.code === "Space") {
    e.preventDefault();
    state.running ? pause() : start();
  } else if (e.key.toLowerCase() === "r") {
    reset();
  } else if (e.key === "ArrowUp") {
    adjustMinutes(1);
  } else if (e.key === "ArrowDown") {
    adjustMinutes(-1);
  }
});

function adjustMinutes(delta) {
  const mins = Math.max(1, Math.round(state.total / 60) + delta);
  state.total = mins * 60;
  state.left = Math.min(state.left, state.total);
  updateDisplay();
}

function intVal(v) {
  return parseInt(v, 10) || 0;
}
function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden && state.running) {
    pause();
  }
});
