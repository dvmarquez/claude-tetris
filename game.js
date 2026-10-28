'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

// Paleta retro (por defecto). Toda paleta de SKINS debe seguir el mismo orden que PIECES.
const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - pale blue
  '#ffb74d', // L - orange
  '#b0bec5', // N - tuerca (gris metálico)
  '#f06292', // U - rosa
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // N (tuerca)
  [[9,0,9],[9,9,9],[0,0,0]],                  // U
];

const LINE_SCORES = [0, 100, 300, 500, 800];
const MAX_START_LEVEL = 10;
// Teclas que el navegador usa para hacer scroll
const SCROLL_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggle = document.getElementById('theme-toggle');
const pauseMenu = document.getElementById('pause-menu');
const resumeBtn = document.getElementById('resume-btn');
const menuRestartBtn = document.getElementById('menu-restart-btn');
const controlsBtn = document.getElementById('controls-btn');
const menuControls = document.getElementById('menu-controls');
const startLevelSelect = document.getElementById('start-level');

const skinSelect = document.getElementById('skin-select');
const nameForm = document.getElementById('name-form');
const nameInput = document.getElementById('player-name');
const recordsEl = document.getElementById('records');
const recordsList = document.getElementById('records-list');
const recordsStats = document.getElementById('records-stats');
const resetRecordsBtn = document.getElementById('reset-records');

const THEME_KEY = 'tetris-theme';
const START_LEVEL_KEY = 'tetris-start-level';
let startLevel = 1;
const SKIN_KEY = 'tetris-skin';
let gridColor = '#22222e';

const RECORDS_KEY = 'tetris-records';
const MAX_RECORDS = 5;
const DEFAULT_NAME = 'Anónimo';

// Patrón 6×6 de la skin pixel art: 1 = brillo, 2 = sombra
const PIXEL_PATTERN = [
  [1,1,1,1,1,0],
  [1,0,0,0,0,2],
  [1,0,1,0,0,2],
  [1,0,0,0,0,2],
  [1,0,0,0,2,2],
  [0,2,2,2,2,2],
];

const SKINS = {
  retro: {
    colors: COLORS,
    drawCell(context, px, py, s, color) {
      context.fillStyle = color;
      context.fillRect(px + 1, py + 1, s - 2, s - 2);
      context.fillStyle = 'rgba(255,255,255,0.12)';
      context.fillRect(px + 1, py + 1, s - 2, 4);
    },
  },
  neon: {
    colors: [null, '#00f0ff', '#fff200', '#d400ff', '#39ff14', '#ff1744', '#2979ff', '#ff9100', '#e0e0ff', '#ff2ec4'],
    background: '#000',
    grid: '#0c1420',
    drawCell(context, px, py, s, color) {
      context.shadowColor = color;
      context.shadowBlur = 12;
      context.strokeStyle = color;
      context.lineWidth = 2;
      context.strokeRect(px + 3, py + 3, s - 6, s - 6);
      context.fillStyle = color;
      context.globalAlpha *= 0.35;
      context.fillRect(px + 3, py + 3, s - 6, s - 6);
      context.shadowBlur = 0;
    },
  },
  pastel: {
    colors: [null, '#a8e6ef', '#fdf1a8', '#d9c2ec', '#c1e8c3', '#f5b8b8', '#c3dcf7', '#fdd3a8', '#d7dde0', '#f9c2d8'],
    drawCell(context, px, py, s, color) {
      context.fillStyle = color;
      context.beginPath();
      context.roundRect(px + 2, py + 2, s - 4, s - 4, s / 4);
      context.fill();
      context.fillStyle = 'rgba(255,255,255,0.45)';
      context.beginPath();
      context.roundRect(px + 5, py + 4, s - 10, s / 5, s / 10);
      context.fill();
    },
  },
  pixel: {
    colors: COLORS,
    drawCell(context, px, py, s, color) {
      context.fillStyle = color;
      context.fillRect(px, py, s, s);
      const p = s / PIXEL_PATTERN.length;
      for (let r = 0; r < PIXEL_PATTERN.length; r++)
        for (let c = 0; c < PIXEL_PATTERN[r].length; c++) {
          const v = PIXEL_PATTERN[r][c];
          if (!v) continue;
          context.fillStyle = v === 1 ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)';
          context.fillRect(px + c * p, py + r * p, p, p);
        }
    },
  },
};

let skin = SKINS.retro;

let board, current, next, score, lines, level, combo, maxCombo, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let records;          // { top: [{ name, score, lines }], bestCombo, maxLines }
let currentEntry;     // entrada de la partida actual dentro de records.top (o null)

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * (PIECES.length - 1)) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  // combo = bloqueos consecutivos que limpian al menos una línea
  combo = cleared ? combo + 1 : 0;
  maxCombo = Math.max(maxCombo, combo);
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    setLevel(startLevel + Math.floor(lines / 10));
    updateHUD();
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function setLevel(lvl) {
  level = lvl;
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  context.globalAlpha = alpha ?? 1;
  skin.drawCell(context, x * size, y * size, size, skin.colors[colorIndex]);
  context.globalAlpha = 1;
}

function clearCanvas(context) {
  context.clearRect(0, 0, context.canvas.width, context.canvas.height);
  if (skin.background) {
    context.fillStyle = skin.background;
    context.fillRect(0, 0, context.canvas.width, context.canvas.height);
  }
}

function drawGrid() {
  ctx.strokeStyle = skin.grid ?? gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  clearCanvas(ctx);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  clearCanvas(nextCtx);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

// ---- Récords ----
function loadRecords() {
  const empty = { top: [], bestCombo: 0, maxLines: 0 };
  try {
    const data = JSON.parse(localStorage.getItem(RECORDS_KEY));
    if (!data || !Array.isArray(data.top)) return empty;
    return {
      top: data.top
        .filter(r => r && Number.isFinite(r.score))
        .map(r => ({ name: String(r.name || DEFAULT_NAME).slice(0, 12), score: r.score, lines: Number(r.lines) || 0 }))
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_RECORDS),
      bestCombo: Number(data.bestCombo) || 0,
      maxLines: Number(data.maxLines) || 0,
    };
  } catch (e) {
    return empty;
  }
}

function saveRecords() {
  try { localStorage.setItem(RECORDS_KEY, JSON.stringify(records)); } catch (e) {}
}

// Registra la partida terminada; devuelve la entrada si entra en el top
function recordGame() {
  records.bestCombo = Math.max(records.bestCombo, maxCombo);
  records.maxLines = Math.max(records.maxLines, lines);
  let entry = null;
  const top = records.top;
  if (score > 0 && (top.length < MAX_RECORDS || score > top[top.length - 1].score)) {
    entry = { name: DEFAULT_NAME, score, lines };
    top.push(entry);
    top.sort((a, b) => b.score - a.score);
    top.length = Math.min(top.length, MAX_RECORDS);
  }
  saveRecords();
  return entry;
}

function renderRecords() {
  recordsList.replaceChildren();
  if (!records.top.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'Sin récords todavía';
    recordsList.append(li);
  }
  records.top.forEach((r, i) => {
    const li = document.createElement('li');
    if (r === currentEntry) li.classList.add('highlight');
    for (const [cls, text] of [['rank', `${i + 1}.`], ['name', r.name], ['pts', r.score.toLocaleString()]]) {
      const span = document.createElement('span');
      span.className = cls;
      span.textContent = text;
      li.append(span);
    }
    recordsList.append(li);
  });
  recordsStats.textContent = `Mejor combo: ${records.bestCombo} · Líneas máx.: ${records.maxLines}`;
}

function showOverlay(title, text, { accent = false, showRecords = false } = {}) {
  overlayTitle.textContent = title;
  overlayTitle.classList.toggle('accent', accent);
  overlayScore.textContent = text;
  recordsEl.classList.toggle('hidden', !showRecords);
  nameForm.classList.toggle('hidden', !(showRecords && currentEntry));
  if (showRecords) renderRecords();
  overlay.classList.remove('hidden');
}

function showStart() {
  currentEntry = null;
  restartBtn.textContent = 'Jugar';
  showOverlay('TETRIS', 'Pulsa Jugar para empezar', { accent: true, showRecords: true });
  restartBtn.focus();
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  currentEntry = recordGame();
  const rank = currentEntry ? records.top.indexOf(currentEntry) + 1 : 0;
  const text = `Puntuación: ${score.toLocaleString()} · Líneas: ${lines} · Combo máx.: ${maxCombo}` +
    (rank ? ` — ¡Puesto #${rank}!` : '');
  restartBtn.textContent = 'Reiniciar';
  showOverlay('GAME OVER', text, { showRecords: true });
  if (currentEntry) {
    nameInput.value = '';
    nameInput.focus();
  }
}

nameForm.addEventListener('submit', e => {
  e.preventDefault();
  if (!currentEntry) return;
  currentEntry.name = nameInput.value.trim().slice(0, 12) || DEFAULT_NAME;
  saveRecords();
  nameForm.classList.add('hidden');
  renderRecords();
  restartBtn.focus();
});

resetRecordsBtn.addEventListener('click', () => {
  if (!confirm('¿Borrar todos los récords?')) return;
  records = { top: [], bestCombo: 0, maxLines: 0 };
  currentEntry = null;
  saveRecords();
  nameForm.classList.add('hidden');
  renderRecords();
});

function openPauseMenu() {
  if (gameOver || paused || !current) return;
  paused = true;
  cancelAnimationFrame(animId);
  pauseMenu.returnValue = '';
  pauseMenu.showModal();
}

// Todo cierre del menú (Reanudar, Reiniciar, P, Escape nativo) pasa por aquí
pauseMenu.addEventListener('close', () => {
  // Evita que Space active un botón del menú durante la partida
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  if (pauseMenu.returnValue === 'restart') {
    init();
    return;
  }
  paused = false;
  lastTime = performance.now();
  dropAccum = 0;
  animId = requestAnimationFrame(loop);
});

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  if (gameOver) return;
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  setLevel(startLevel);
  combo = 0;
  maxCombo = 0;
  currentEntry = null;
  paused = false;
  gameOver = false;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.target === nameInput) return; // escribiendo el nombre
  if (pauseMenu.open) {
    // Escape lo maneja el <dialog> nativo (cancel → close)
    if (e.code === 'KeyP') { e.preventDefault(); pauseMenu.close(); return; }
    // Navegación nativa: flechas en el selector y Space en botones; el resto no hace scroll
    const native = e.target instanceof HTMLSelectElement ||
      (e.code === 'Space' && e.target instanceof HTMLButtonElement);
    if (SCROLL_KEYS.includes(e.code) && !native) e.preventDefault();
    return;
  }
  if (e.code === 'KeyP' || e.code === 'Escape') {
    // preventDefault: que este mismo Escape no cierre el menú recién abierto
    e.preventDefault();
    openPauseMenu();
    return;
  }
  if (paused || gameOver || !current) return;
  if (SCROLL_KEYS.includes(e.code)) e.preventDefault();
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);
resumeBtn.addEventListener('click', () => pauseMenu.close());
menuRestartBtn.addEventListener('click', () => pauseMenu.close('restart'));

menuControls.append(document.querySelector('.panel .controls ul').cloneNode(true));
controlsBtn.addEventListener('click', () => {
  const show = menuControls.hidden;
  menuControls.hidden = !show;
  controlsBtn.setAttribute('aria-expanded', String(show));
  controlsBtn.textContent = show ? 'Ocultar controles' : 'Ver controles';
});

try {
  const saved = parseInt(localStorage.getItem(START_LEVEL_KEY), 10);
  if (saved >= 1 && saved <= MAX_START_LEVEL) startLevel = saved;
} catch (e) {}
for (let n = 1; n <= MAX_START_LEVEL; n++) startLevelSelect.add(new Option(n, n));
startLevelSelect.value = startLevel;
startLevelSelect.addEventListener('change', () => {
  startLevel = Number(startLevelSelect.value);
  try { localStorage.setItem(START_LEVEL_KEY, String(startLevel)); } catch (e) {}
});

restartBtn.addEventListener('click', () => {
  // si escribió un nombre sin pulsar Guardar, se conserva
  if (currentEntry && !nameForm.classList.contains('hidden') && nameInput.value.trim()) {
    nameForm.requestSubmit();
  }
  restartBtn.blur(); // evita que Space reactive el botón durante la partida
  init();
});

function applyTheme(theme) {
  const light = theme === 'light';
  if (light) document.documentElement.dataset.theme = 'light';
  else delete document.documentElement.dataset.theme;
  const label = light ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro';
  themeToggle.textContent = light ? '☀️' : '🌙';
  themeToggle.setAttribute('aria-label', label);
  themeToggle.title = label;
  themeToggle.setAttribute('aria-pressed', String(light));
  gridColor = light ? '#e3e6f0' : '#22222e';
  // El bucle está detenido en pausa/game over: redibujar manualmente
  if (current && next) { draw(); drawNext(); }
}

themeToggle.addEventListener('click', () => {
  const light = document.documentElement.dataset.theme !== 'light';
  try { localStorage.setItem(THEME_KEY, light ? 'light' : 'dark'); } catch (e) {}
  applyTheme(light ? 'light' : 'dark');
  themeToggle.blur(); // evita que Space active el botón
});

function applySkin(name) {
  skin = SKINS[name];
  skinSelect.value = name;
  // El bucle está detenido en pausa/game over: redibujar manualmente
  if (current && next) { draw(); drawNext(); }
}

skinSelect.addEventListener('change', () => {
  try { localStorage.setItem(SKIN_KEY, skinSelect.value); } catch (e) {}
  applySkin(skinSelect.value);
  skinSelect.blur(); // evita que las flechas cambien la skin en vez de mover la pieza
});

let savedSkin = 'retro';
try {
  const stored = localStorage.getItem(SKIN_KEY);
  if (Object.hasOwn(SKINS, stored)) savedSkin = stored;
} catch (e) {}
applySkin(savedSkin);

let savedTheme = 'dark';
try { savedTheme = localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'; } catch (e) {}
applyTheme(savedTheme);

records = loadRecords();
showStart();
