/* Focus Timer by SWC - Enhanced rewrite.
   Accurate ticking with drift correction.
   Flicker safe visuals. Notifications on user gesture.
   Stats with export. Title time toggle. Auto pause when hidden. */

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

const SETTINGS_KEY = "focus_swc_prefs_v2";
const STATS_KEY = "focus_swc_stats_v2";

const defaultPrefs = {
  focus: 25,
  short: 5,
  long: 15,
  longEvery: 4,
  autoNext: false,
  sound: true,
  volume: 0.3,
  titleTick: true,
  autoPauseHidden: true,
};

const state = {
  mode: "focus",
  total: defaultPrefs.focus * 60,
  left: defaultPrefs.focus * 60,
  running: false,
  cycle: 0, // number of focus sessions completed since last long break decision
  tickHandle: 0,
  targetEnd: 0, // high resolution end time in ms
  lastRenderSec: -1, // for title tick throttling
};

let audioCtx = null;
let masterGain = null;

function ensureAudio() {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = prefs.volume;
      masterGain.connect(audioCtx.destination);
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
function savePrefs() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(prefs));
}
function loadStats() {
  try {
    const saved = JSON.parse(localStorage.getItem(STATS_KEY));
    return saved || { today: dateKey(), todayCount: 0, streak: 0, totalMinutes: 0 };
  } catch {
    return { today: dateKey(), todayCount: 0, streak: 0, totalMinutes: 0 };
  }
}
function saveStats() {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}
function dateKey(d = new Date()) {
  return d.toISOString().slice(0,10);
}

let prefs = loadPrefs();
let stats = loadStats();

// Elements
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
const longEveryIn = $("#setLongEvery");
const autoNextIn = $("#autoNext");
const chimeToggle = $("#chimeToggle");
const volIn = $("#volume");

const resetPrefsBtn = $("#resetPrefs");
const resetStatsBtn = $("#resetStats");

const notifyAsk = $("#notifyAsk");
const exportCsvBtn = $("#exportCsv");

const todayCountEl = $("#todayCount");
const streakDaysEl = $("#streakDays");
const totalMinutesEl = $("#totalMinutes");

const titleTickIn = $("#titleTick");
const autoPauseHiddenIn = $("#autoPauseHidden");

// Init
function init(){
  setMode("focus", false);
  // Settings UI
  focusIn.value = prefs.focus;
  shortIn.value = prefs.short;
  longIn.value = prefs.long;
  longEveryIn.value = prefs.longEvery;
  autoNextIn.checked = prefs.autoNext;
  chimeToggle.checked = prefs.sound;
  volIn.value = prefs.volume;
  titleTickIn.checked = prefs.titleTick;
  autoPauseHiddenIn.checked = prefs.autoPauseHidden;

  refreshStats();
  updateDisplay( /*force*/ true );
}
init();

function setMode(next, resetTimer=true){
  const allowed = ["focus","short","long"];
  if (!allowed.includes(next)) return;
  state.mode = next;
  chips.forEach(c => c.classList.toggle("active", c.dataset.mode === next));

  const mins = Number(prefs[next]);
  const safe = Number.isFinite(mins) && mins > 0 ? mins : defaultPrefs[next];
  const newTotal = safe * 60;

  if (resetTimer){
    state.total = newTotal;
    state.left = newTotal;
    stop();
  } else {
    // keep partial progress but clamp to new total
    state.total = newTotal;
    state.left = Math.min(state.left, newTotal);
  }

  modeLabel.textContent = next === "focus" ? "Time to focus" : next === "short" ? "Short break" : "Long break";
  updateDisplay(true);
}

function mmss(sec){
  const s = Math.max(0, Math.floor(sec));
  const m = String(Math.floor(s / 60)).padStart(2,"0");
  const r = String(s % 60).padStart(2,"0");
  return [m,r];
}

function updateDisplay(force=false){
  const left = Math.max(0, state.left);
  const [m, s] = mmss(left);
  minutesEl.textContent = m;
  secondsEl.textContent = s;

  const total = Math.max(1, state.total);
  const ratio = Math.min(1, Math.max(0, 1 - left / total));
  ring.style.setProperty("--progress", (360 * ratio) + "deg");
  linearProgress.style.width = (ratio * 100).toFixed(2) + "%";

  // Title tick at most once a second
  const secNow = Math.floor(left);
  if ((force || secNow !== state.lastRenderSec) && prefs.titleTick){
    document.title = `Focus Timer • ${m}:${s}`;
    state.lastRenderSec = secNow;
  } else if (!prefs.titleTick) {
    document.title = "Focus Timer by SWC";
  }
}

function start(){
  if (state.running) return;
  state.running = true;
  startPauseBtn.textContent = "Pause";
  ensureAudio();
  try { audioCtx?.resume?.(); } catch {}

  const now = performance.now();
  state.targetEnd = now + state.left * 1000;

  const step = () => {
    if (!state.running) return;
    const t = performance.now();
    const msLeft = Math.max(0, state.targetEnd - t);
    state.left = msLeft / 1000;
    updateDisplay();

    if (msLeft <= 0){
      finishSession();
      return;
    }
    state.tickHandle = requestAnimationFrame(step);
  };
  state.tickHandle = requestAnimationFrame(step);
}

function stop(){
  state.running = false;
  startPauseBtn.textContent = "Start";
  cancelAnimationFrame(state.tickHandle);
}

function reset(){
  stop();
  state.left = state.total;
  updateDisplay(true);
}

function skip(){
  stop();
  state.left = 0;
  updateDisplay(true);
  finishSession();
}

function finishSession(){
  stop();
  state.left = 0;
  updateDisplay(true);
  chime();
  notify(`${labelFor(state.mode)} finished`, "Nice work");

  if (state.mode === "focus"){
    rollStatsOnFinish();
    state.cycle += 1;
  }

  let next = "focus";
  if (state.mode === "focus"){
    next = state.cycle % prefs.longEvery === 0 ? "long" : "short";
  } else {
    next = "focus";
  }
  setMode(next);
  if (prefs.autoNext) start();
}

function labelFor(m){
  return m === "focus" ? "Focus" : m === "short" ? "Short break" : "Long break";
}

function rollStatsOnFinish(){
  const today = dateKey();
  if (stats.today !== today){
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const yKey = dateKey(y);
    if (stats.today === yKey && stats.todayCount > 0) stats.streak += 1;
    stats.today = today;
    stats.todayCount = 0;
  }
  stats.todayCount += 1;
  stats.totalMinutes += Math.round(state.total / 60);
  saveStats();
  refreshStats();
}

function refreshStats(){
  const today = dateKey();
  if (stats.today !== today){
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const yKey = dateKey(y);
    if (stats.today === yKey && stats.todayCount > 0) stats.streak += 1;
    stats.today = today;
    stats.todayCount = 0;
    saveStats();
  }
  todayCountEl.textContent = stats.todayCount;
  streakDaysEl.textContent = stats.streak;
  totalMinutesEl.textContent = stats.totalMinutes;
}

// Sound
function chime(){
  if (!prefs.sound) return;
  ensureAudio();
  if (!audioCtx) return;

  const now = audioCtx.currentTime;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = "sine";
  o.frequency.value = 880;
  o.connect(g);
  g.connect(masterGain || audioCtx.destination);

  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.25, now + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);

  o.start(now);
  o.stop(now + 0.65);
}

// Notifications
function notify(title, body){
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted"){
    new Notification(title, { body });
  }
}
notifyAsk?.addEventListener("click", async (e)=>{
  e.preventDefault();
  if (!("Notification" in window)) return;
  try {
    const perm = await Notification.requestPermission();
    if (perm === "granted") notify("Notifications enabled", "I will remind you when time is up");
  } catch {}
});

// CSV export for stats
exportCsvBtn?.addEventListener("click", ()=>{
  const rows = [
    ["date","sessions_today","streak_days","total_minutes"],
    [stats.today, String(stats.todayCount), String(stats.streak), String(stats.totalMinutes)]
  ];
  const csv = rows.map(r => r.map(x => `"${String(x).replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], {type:"text/csv"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "focus-timer-stats.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

// Buttons
startPauseBtn.addEventListener("click", ()=> state.running ? stop() : start());
resetBtn.addEventListener("click", reset);
skipBtn.addEventListener("click", skip);

chips.forEach(ch => ch.addEventListener("click", ()=> setMode(ch.dataset.mode)));

// Settings dialog
openSettingsBtn.addEventListener("click", ()=> settingsDlg.showModal());
settingsDlg.addEventListener("close", ()=>{
  if (settingsDlg.returnValue === "ok"){
    prefs.focus = clamp(intVal(focusIn.value), 1, 180);
    prefs.short = clamp(intVal(shortIn.value), 1, 60);
    prefs.long = clamp(intVal(longIn.value), 1, 120);
    prefs.longEvery = clamp(intVal(longEveryIn.value), 2, 12);
    prefs.autoNext = autoNextIn.checked;
    prefs.sound = chimeToggle.checked;
    prefs.volume = Number(volIn.value);
    prefs.titleTick = titleTickIn.checked;
    prefs.autoPauseHidden = autoPauseHiddenIn.checked;
    savePrefs();
    setMode(state.mode);
    if (masterGain) masterGain.gain.value = prefs.volume;
  } else {
    // restore UI
    focusIn.value = prefs.focus;
    shortIn.value = prefs.short;
    longIn.value = prefs.long;
    longEveryIn.value = prefs.longEvery;
    autoNextIn.checked = prefs.autoNext;
    chimeToggle.checked = prefs.sound;
    volIn.value = prefs.volume;
    titleTickIn.checked = prefs.titleTick;
    autoPauseHiddenIn.checked = prefs.autoPauseHidden;
  }
});

resetPrefsBtn.addEventListener("click", ()=>{
  prefs = { ...defaultPrefs };
  savePrefs();
  setMode("focus");
  // sync UI
  focusIn.value = prefs.focus;
  shortIn.value = prefs.short;
  longIn.value = prefs.long;
  longEveryIn.value = prefs.longEvery;
  autoNextIn.checked = prefs.autoNext;
  chimeToggle.checked = prefs.sound;
  volIn.value = prefs.volume;
  titleTickIn.checked = prefs.titleTick;
  autoPauseHiddenIn.checked = prefs.autoPauseHidden;
});

resetStatsBtn.addEventListener("click", ()=>{
  stats = { today: dateKey(), todayCount: 0, streak: 0, totalMinutes: 0 };
  saveStats();
  refreshStats();
});

// Keyboard shortcuts
window.addEventListener("keydown", (e)=>{
  if (e.target.matches("input,textarea")) return;
  if (e.code === "Space") { e.preventDefault(); state.running ? stop() : start(); }
  else if (e.key.toLowerCase() === "r") reset();
  else if (e.key === "ArrowUp") adjustMinutes(1);
  else if (e.key === "ArrowDown") adjustMinutes(-1);
  else if (e.key.toLowerCase() === "t") {
    prefs.titleTick = !prefs.titleTick;
    titleTickIn.checked = prefs.titleTick;
    savePrefs();
    updateDisplay(true);
  }
});

function adjustMinutes(delta){
  const mins = Math.max(1, Math.round(state.total / 60) + delta);
  state.total = mins * 60;
  state.left = Math.min(state.left, state.total);
  if (state.running){
    const now = performance.now();
    state.targetEnd = now + state.left * 1000;
  }
  updateDisplay(true);
}

function intVal(v){ return parseInt(v, 10) || 0; }
function clamp(v, lo, hi){ return Math.min(hi, Math.max(lo, v)); }

// Auto pause on hidden tab
document.addEventListener("visibilitychange", ()=>{
  if (document.hidden && state.running && prefs.autoPauseHidden){
    stop();
  }
});
