/* ─── Study Now · app.js ──────────────────────────────── */

let DURATION = 25*60; 
const CIRCUMFERENCE = 552.92; 
let breakDuration = 5*60; 

/* ── DOM refs ── */
const screenStart  = document.getElementById('screen-start');
const screenFocus  = document.getElementById('screen-focus');
const screenBreak  = document.getElementById('screen-break');
const screenDone   = document.getElementById('screen-done');

const inputTopic         = document.getElementById('study-topic');
const inputDuration      = document.getElementById('session-duration');
const btnStart           = document.getElementById('btn-start');
const startBtnText       = document.getElementById('start-btn-text');
const btnCancel          = document.getElementById('btn-cancel');
const btnRestart         = document.getElementById('btn-restart');
const btnChangeDuration  = document.getElementById('btn-change-duration');
const btnSettings        = document.getElementById('btn-settings');
const btnSkipBreak       = document.getElementById('btn-skip-break');
const durationDisplay    = document.getElementById('duration-display');
const durationInputGroup = document.getElementById('duration-input-group');

const focusTopic         = document.getElementById('focus-topic');
const timerDisplay       = document.getElementById('timer-display');
const ringProgress       = document.getElementById('ring-progress');
const breakDisplay       = document.getElementById('break-display');
const breakRingProgress  = document.getElementById('break-ring-progress');
const doneTopic          = document.getElementById('done-topic');
const sessionsToday      = document.getElementById('sessions-today');
const streakDisplay      = document.getElementById('streak-display');
const statsTotalTime     = document.getElementById('stats-total-time');
const statsTotalSessions = document.getElementById('stats-total-sessions');
const statsLongestStreak = document.getElementById('stats-longest-streak');
const todaySessions      = document.getElementById('today-sessions');
const todayTime          = document.getElementById('today-time');
const breakPercentage    = document.getElementById('break-percentage');
const settingsPanel      = document.getElementById('settings-panel');
const settingsSection    = document.getElementById('settings-section');
const btnCloseSettings   = document.getElementById('btn-close-settings');
const completionMicrocopy = document.getElementById('completion-microcopy');

const contentContainer = document.getElementById('content-container');

/* ── State ── */
let intervalId  = null;
let breakIntervalId = null;
let secondsLeft = DURATION;
let zoomLevel   = 1;
let isFullscreen = false;
let currentMode = 'focus'; // 'focus' or 'break'
let sessionStartTime = null;
let wasAbandoned = false;

/* ────────────────────────────────────────────────────────
   Zoom Controls
──────────────────────────────────────────────────────── */
function setZoom(level) {
  zoomLevel = Math.max(0.5, Math.min(2, level));
  contentContainer.style.transform = `scale(${zoomLevel})`;
  contentContainer.style.transformOrigin = 'center center';
}

/* ────────────────────────────────────────────────────────
   Helpers
──────────────────────────────────────────────────────── */
function fmt(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function setRing(remaining, total, ring) {
  const fraction = remaining / total;            
  const offset   = CIRCUMFERENCE * (1 - fraction); 
  ring.style.strokeDashoffset = offset;
}

function show(screen) {
  // Fade out all screens first
  [screenStart, screenFocus, screenBreak, screenDone].forEach(s => {
    s.classList.add('hidden');
  });
  
  // Fade in the target screen after a short delay for smooth transition
  setTimeout(() => {
    screen.classList.remove('hidden');
  }, 50);
}

/* ────────────────────────────────────────────────────────
   Session Counter
──────────────────────────────────────────────────────── */
function getSessionCount() {
  resetSessionCountIfMidnight();
  const count = localStorage.getItem('sessionsToday');
  return count ? parseInt(count, 10) : 0;
}

function incrementSessionCount() {
  resetSessionCountIfMidnight();
  const count = getSessionCount() + 1;
  localStorage.setItem('sessionsToday', count);
  localStorage.setItem('lastSessionDate', new Date().toDateString());
  return count;
}

function resetSessionCountIfMidnight() {
  const lastDate = localStorage.getItem('lastSessionDate');
  const today = new Date().toDateString();
  if (lastDate !== today) {
    localStorage.setItem('sessionsToday', '0');
    localStorage.setItem('lastSessionDate', today);
  }
}

function updateSessionCounterDisplay() {
  const count = getSessionCount();
  sessionsToday.textContent = `Sessions today: ${count}`;
}

/* ────────────────────────────────────────────────────────
   Session Validation
──────────────────────────────────────────────────────── */
function isSessionValid(totalSeconds, completedSeconds) {
  const completionPercentage = completedSeconds / totalSeconds;
  const minDurationMinutes = 10;
  const actualDurationMinutes = totalSeconds / 60;
  
  return completionPercentage >= 0.9 && actualDurationMinutes >= minDurationMinutes;
}

/* ────────────────────────────────────────────────────────
   Streak Tracking
──────────────────────────────────────────────────────── */
function getStreakData() {
  return {
    current: parseInt(localStorage.getItem('currentStreak') || '0'),
    longest: parseInt(localStorage.getItem('longestStreak') || '0'),
    lastSessionDate: localStorage.getItem('lastSessionDate')
  };
}

function updateStreak() {
  const streakData = getStreakData();
  const today = new Date().toDateString();
  const lastDate = streakData.lastSessionDate;
  
  let newStreak = streakData.current;
  
  if (lastDate !== today) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (lastDate === yesterday.toDateString()) {
      newStreak++;
    } else {
      newStreak = 1;
    }
  }
  
  const newLongest = Math.max(newStreak, streakData.longest);
  
  localStorage.setItem('currentStreak', newStreak);
  localStorage.setItem('longestStreak', newLongest);
  localStorage.setItem('lastSessionDate', today);
  
  return { current: newStreak, longest: newLongest };
}

function checkStreakReset() {
  const streakData = getStreakData();
  const today = new Date().toDateString();
  const lastDate = streakData.lastSessionDate;
  
  if (lastDate) {
    const lastSession = new Date(lastDate);
    const daysSince = Math.floor((new Date() - lastSession) / (1000 * 60 * 60 * 24));
    
    if (daysSince > 1) {
      localStorage.setItem('currentStreak', '0');
    }
  }
}

/* ────────────────────────────────────────────────────────
   Stats Tracking
──────────────────────────────────────────────────────── */
function getStats() {
  return {
    totalFocusTime: parseInt(localStorage.getItem('totalFocusTime') || '0'), // in minutes
    totalSessions: parseInt(localStorage.getItem('totalSessions') || '0'),
    currentStreak: parseInt(localStorage.getItem('currentStreak') || '0'),
    longestStreak: parseInt(localStorage.getItem('longestStreak') || '0')
  };
}

function updateStats(sessionMinutes) {
  const stats = getStats();
  
  stats.totalFocusTime += sessionMinutes;
  stats.totalSessions += 1;
  
  localStorage.setItem('totalFocusTime', stats.totalFocusTime);
  localStorage.setItem('totalSessions', stats.totalSessions);
  
  return stats;
}

function formatTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

/* ────────────────────────────────────────────────────────
   Today's Stats Tracking
──────────────────────────────────────────────────────── */
function getTodayStats() {
  const today = new Date().toDateString();
  const stored = localStorage.getItem('todayStats');
  
  if (stored) {
    const data = JSON.parse(stored);
    if (data.date === today) {
      return data;
    }
  }
  
  return { date: today, sessions: 0, minutes: 0 };
}

function updateTodayStats(sessionMinutes) {
  const stats = getTodayStats();
  stats.sessions += 1;
  stats.minutes += sessionMinutes;
  localStorage.setItem('todayStats', JSON.stringify(stats));
  return stats;
}

function updateTodayStatsDisplay() {
  const stats = getTodayStats();
  todaySessions.textContent = stats.sessions;
  todayTime.textContent = formatTime(stats.minutes);
}

function getBreakPercentage() {
  return parseInt(breakPercentage.value) || 20;
}

/* ────────────────────────────────────────────────────────
   Break Timer
──────────────────────────────────────────────────────── */
function startBreakTimer() {
  clearInterval(breakIntervalId);
  currentMode = 'break';
  
  // Break duration based on user setting (default 20%)
  const sessionMins = DURATION / 60;
  const breakPercentage = getBreakPercentage();
  const breakMins = Math.round(sessionMins * (breakPercentage / 100));
  const breakSecs = Math.max(1, breakMins) * 60; // Ensure at least 1 min break
  
  let breakSecondsLeft = breakSecs;
  
  breakDisplay.textContent = fmt(breakSecondsLeft);
  setRing(breakSecondsLeft, breakSecs, breakRingProgress);
  show(screenBreak);

  breakIntervalId = setInterval(() => {
    breakSecondsLeft--;
    breakDisplay.textContent = fmt(breakSecondsLeft);
    setRing(breakSecondsLeft, breakSecs, breakRingProgress);

    if (breakSecondsLeft <= 0) {
      clearInterval(breakIntervalId);
      endBreak();
    }
  }, 1000);
}

function endBreak() {
  clearInterval(breakIntervalId);
  show(screenDone);
}

function stopBreakTimer() {
  clearInterval(breakIntervalId);
}

/* ────────────────────────────────────────────────────────
   Timer
──────────────────────────────────────────────────────── */
function startTimer() {
  clearInterval(intervalId);
  currentMode = 'focus';
  wasAbandoned = false;
  sessionStartTime = Date.now();
  
  // Get duration from input or default to 25
  let durationMins = parseInt(inputDuration.value, 10);
  if (isNaN(durationMins) || durationMins < 1 || durationMins > 180) {
    durationMins = 25;
  }
  DURATION = durationMins * 60;
  secondsLeft = DURATION;

  timerDisplay.textContent = fmt(secondsLeft);
  setRing(secondsLeft, DURATION, ringProgress);

  intervalId = setInterval(() => {
    secondsLeft--;
    timerDisplay.textContent = fmt(secondsLeft);
    setRing(secondsLeft, DURATION, ringProgress);

    if (secondsLeft <= 0) {
      clearInterval(intervalId);
      endSession();
    }
  }, 1000);
}

function endSession() {
  clearInterval(intervalId);
  
  const sessionEndTime = Date.now();
  const totalSessionSeconds = DURATION;
  const completedSeconds = totalSessionSeconds - secondsLeft;
  const sessionMinutes = Math.floor(completedSeconds / 60);
  
  const isValid = isSessionValid(totalSessionSeconds, completedSeconds);
  
  if (isValid) {
    // Update session count (only for valid sessions)
    incrementSessionCount();
    updateSessionCounterDisplay();
    
    // Update stats and streak
    updateStats(sessionMinutes);
    updateStreak();
    updateTodayStats(sessionMinutes);
    
    // Refresh UI displays
    updateStreakDisplay();
    updateStatsDisplay();
    updateTodayStatsDisplay();
  } else {
    wasAbandoned = true;
  }
  
  // Play completion sound
  playCompletionSound();
  
  // Show studied topic on completion screen
  const topic = inputTopic.value.trim();
  const doneTopicElement = document.getElementById('done-topic');
  const doneSubElement = doneTopicElement.parentElement;
  const doneTitleElement = document.querySelector('.done-title');
  const checkMarkElement = document.querySelector('.check-mark');
  
  // Update title, checkmark, and microcopy based on session validity
  doneTitleElement.textContent = isValid ? 'Session Complete' : 'Session Abandoned';
  
  // Update checkmark/cross based on session validity
  if (isValid) {
    checkMarkElement.textContent = '✓';
    completionMicrocopy.textContent = 'Good.';
  } else {
    checkMarkElement.textContent = '✗';
    completionMicrocopy.textContent = 'You stopped early.';
  }
  
  if (topic) {
    doneSubElement.innerHTML = `You studied: <span id="done-topic">${topic}</span>`;
  } else {
    doneSubElement.innerHTML = `<span id="done-topic">Focus Session</span>`;
  }
  
  startBreakTimer();
}

/* ────────────────────────────────────────────────────────
   Event Listeners
──────────────────────────────────────────────────────── */
btnStart.addEventListener('click', () => {
  const topic = inputTopic.value.trim();
  focusTopic.textContent = topic ? topic : 'Focus Session';
  show(screenFocus);
  startTimer();
});

btnSkipBreak.addEventListener('click', () => {
  clearInterval(breakIntervalId);
  show(screenDone);
});

btnChangeDuration.addEventListener('click', (e) => {
  e.preventDefault();
  durationInputGroup.classList.toggle('hidden');
  if (!durationInputGroup.classList.contains('hidden')) {
    inputDuration.focus();
    inputDuration.select(); // Automatically select all text
  }
});

inputDuration.addEventListener('input', () => {
  let val = parseInt(inputDuration.value, 10);
  
  // Clamp value to 180
  if (val > 180) {
    val = 180;
    inputDuration.value = 180;
  }
  
  if (!isNaN(val) && val >= 1) {
    durationDisplay.textContent = `${val} min`;
    startBtnText.textContent = `Start ${val} Minute Session`;
  }
});

// Allow Enter key on input to start
inputTopic.addEventListener('keydown', e => {
  if (e.key === 'Enter') btnStart.click();
});

inputDuration.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    durationInputGroup.classList.add('hidden');
    btnStart.click();
  }
});

btnCancel.addEventListener('click', () => {
  clearInterval(intervalId);
  wasAbandoned = true;
  
  // Reset ring & display before going back
  secondsLeft = DURATION;
  timerDisplay.textContent = fmt(secondsLeft);
  // Disable transition momentarily so ring resets instantly
  ringProgress.style.transition = 'none';
  setRing(secondsLeft, DURATION, ringProgress);
  requestAnimationFrame(() => {
    ringProgress.style.transition = '';
  });
  show(screenStart);
  // Focus the input for fast re-entry
  setTimeout(() => inputTopic.focus(), 50);
});

btnRestart.addEventListener('click', () => {
  inputTopic.value = '';
  stopBreakTimer();
  show(screenStart);
  // Focus the input for fast re-entry
  setTimeout(() => inputTopic.focus(), 50);
});

/* ────────────────────────────────────────────────────────
   Sound
──────────────────────────────────────────────────────── */
async function playCompletionSound() {
  if (window.__TAURI__) {
    try {
      const { readBinaryFile } = window.__TAURI__.core;
      const audioData = await readBinaryFile('assets/bellsound.wav');
      const blob = new Blob([audioData], { type: 'audio/wav' });
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      audio.volume = 0.5;
      await audio.play();
      URL.revokeObjectURL(audioUrl);
      return;
    } catch (error) {
      console.log('Tauri audio failed, trying fallback:', error);
    }
  }
  
  // Fallback for development or if Tauri fails
  const bellPath = '/assets/bellsound.wav';
  const audio = new Audio(bellPath);
  audio.volume = 0.5;
  audio.play().catch(error => {
    console.log('Audio file failed, using fallback sound');
    playFallbackSound();
  });
}

function playFallbackSound() {
  // Fallback using Web Audio API if audio file fails
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 1.5);
  } catch (error) {
    console.log('Audio fallback also failed');
  }
}

/* ── Init ── */
async function init() {
  checkStreakReset();
  updateSessionCounterDisplay();
  updateStreakDisplay();
  updateStatsDisplay();
  updateTodayStatsDisplay();
  show(screenStart);
}

// Break percentage input validation - only validate on blur or when user finishes
breakPercentage.addEventListener('blur', () => {
  let val = parseFloat(breakPercentage.value);
  
  if (isNaN(val) || val < 10) {
    breakPercentage.value = 10;
  } else if (val > 35) {
    breakPercentage.value = 35;
  }
});

// Also validate on Enter key press
breakPercentage.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    breakPercentage.blur();
  }
});

// Settings panel controls
btnSettings.addEventListener('click', () => {
  settingsPanel.classList.remove('hidden');
});

btnCloseSettings.addEventListener('click', () => {
  settingsPanel.classList.add('hidden');
});

settingsPanel.addEventListener('click', (e) => {
  if (e.target === settingsPanel) {
    settingsPanel.classList.add('hidden');
  }
});

function updateStreakDisplay() {
  const streakData = getStreakData();
  const streakDisplay = document.getElementById('streak-display');
  streakDisplay.innerHTML = `<span class="day-number">Day ${streakData.current}</span> <span class="streak-label">streak</span>`;
}

function updateStatsDisplay() {
  const stats = getStats();
  statsTotalTime.textContent = formatTime(stats.totalFocusTime);
  statsTotalSessions.textContent = stats.totalSessions;
  statsLongestStreak.textContent = `${stats.longestStreak} days`;
}

init();

/* ────────────────────────────────────────────────────────
   Tauri Window Controls
──────────────────────────────────────────────────────── */
document.getElementById('tb-minimize').addEventListener('click', async () => {
  const { Window } = window.__TAURI__.window;
  await Window.getCurrent().minimize();
});

document.getElementById('tb-maximize').addEventListener('click', async () => {
  const { Window } = window.__TAURI__.window;
  await Window.getCurrent().toggleMaximize();
});

document.getElementById('tb-close').addEventListener('click', async () => {
  const { Window } = window.__TAURI__.window;
  await Window.getCurrent().hide();
});
