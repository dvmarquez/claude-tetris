'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

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

const THEME_KEY = 'tetris-theme';
let gridColor = '#22222e';

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let combo = 0, bestCombo = 0;

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
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
  // Combo: piezas consecutivas que limpian líneas
  combo = cleared ? combo + 1 : 0;
  if (combo > bestCombo) bestCombo = combo;
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

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = gridColor;
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
  ctx.clearRect(0, 0, canvas.width, canvas.height);
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
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
  showGameOverRecords();
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

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
  level = 1;
  combo = 0;
  bestCombo = 0;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  gameOverRecords.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.target instanceof HTMLInputElement) return; // escribiendo el nombre del récord
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
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
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

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
  else if (board) drawIdleBoard();
}

themeToggle.addEventListener('click', () => {
  const light = document.documentElement.dataset.theme !== 'light';
  try { localStorage.setItem(THEME_KEY, light ? 'light' : 'dark'); } catch (e) {}
  applyTheme(light ? 'light' : 'dark');
  themeToggle.blur(); // evita que Space active el botón
});

let savedTheme = 'dark';
try { savedTheme = localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'; } catch (e) {}
applyTheme(savedTheme);

// ---- Records ----
const RECORDS_KEY = 'tetris-records';
const MAX_RECORDS = 5;
const startScreen = document.getElementById('start-screen');
const playBtn = document.getElementById('play-btn');
const startRecordsEl = document.getElementById('start-records-table');
const gameOverRecords = document.getElementById('gameover-records');
const gameOverRecordsEl = document.getElementById('gameover-records-table');
const recordForm = document.getElementById('record-form');
const recordName = document.getElementById('record-name');

let pendingRecord = null; // récord de la partida actual aún sin guardar
let highlightedRecord = null;

function isValidRecord(r) {
  return r && typeof r === 'object' &&
    typeof r.name === 'string' &&
    [r.score, r.lines, r.level, r.combo].every(n => Number.isFinite(n) && n >= 0);
}

function loadRecords() {
  try {
    const data = JSON.parse(localStorage.getItem(RECORDS_KEY));
    if (!Array.isArray(data)) return [];
    return data.filter(isValidRecord)
      .map(r => ({ name: r.name.slice(0, 12), score: r.score, lines: r.lines, level: r.level, combo: r.combo, date: typeof r.date === 'string' ? r.date : '' }))
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RECORDS);
  } catch (e) {
    return [];
  }
}

function saveRecords(records) {
  try { localStorage.setItem(RECORDS_KEY, JSON.stringify(records)); } catch (e) {}
}

function qualifies(value) {
  if (value <= 0) return false;
  const records = loadRecords();
  return records.length < MAX_RECORDS || value > records[records.length - 1].score;
}

function renderRecords(container, records, highlight) {
  container.replaceChildren();
  if (!records.length) {
    const empty = document.createElement('p');
    empty.className = 'records-empty';
    empty.textContent = 'Aún no hay records';
    container.appendChild(empty);
  } else {
    const table = document.createElement('table');
    table.className = 'records-table';
    const head = table.createTHead().insertRow();
    for (const h of ['#', 'NOMBRE', 'PUNTOS', 'LÍNEAS', 'NIVEL', 'COMBO']) {
      const th = document.createElement('th');
      th.textContent = h;
      head.appendChild(th);
    }
    const body = table.createTBody();
    records.forEach((r, i) => {
      const row = body.insertRow();
      if (highlight && r.date === highlight.date && r.name === highlight.name && r.score === highlight.score)
        row.className = 'records-highlight';
      const cells = [i + 1, r.name, r.score.toLocaleString(), r.lines, r.level, r.combo];
      cells.forEach((v, j) => {
        const td = row.insertCell();
        td.textContent = v; // textContent: escapa el nombre del jugador
        if (j === 1) { td.className = 'records-name'; td.title = r.name; }
      });
    });
    container.appendChild(table);
  }

  const stats = document.createElement('div');
  stats.className = 'records-stats';
  const bestComboAll = records.reduce((m, r) => Math.max(m, r.combo), 0);
  const maxLinesAll = records.reduce((m, r) => Math.max(m, r.lines), 0);
  for (const [label, value] of [['Mejor combo', bestComboAll], ['Máx. líneas', maxLinesAll]]) {
    const span = document.createElement('span');
    span.append(label + ': ');
    const strong = document.createElement('strong');
    strong.textContent = value;
    span.appendChild(strong);
    stats.appendChild(span);
  }
  container.appendChild(stats);

  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'records-reset';
  reset.textContent = 'Borrar records';
  reset.addEventListener('click', resetRecords);
  container.appendChild(reset);
}

function renderAllRecords() {
  const records = loadRecords();
  renderRecords(startRecordsEl, records, null);
  renderRecords(gameOverRecordsEl, records, highlightedRecord);
}

function resetRecords() {
  if (!confirm('¿Borrar todos los records? Esta acción no se puede deshacer.')) return;
  try { localStorage.removeItem(RECORDS_KEY); } catch (e) {}
  highlightedRecord = null;
  // Si la partida actual seguía pendiente de guardar, vuelve a poder entrar en el top
  if (gameOver && pendingRecord && qualifies(pendingRecord.score)) recordForm.classList.remove('hidden');
  renderAllRecords();
}

function showGameOverRecords() {
  highlightedRecord = null;
  pendingRecord = { name: '', score, lines, level, combo: bestCombo, date: new Date().toISOString() };
  const isRecord = qualifies(score);
  recordForm.classList.toggle('hidden', !isRecord);
  gameOverRecords.classList.remove('hidden');
  renderAllRecords();
  if (isRecord) {
    recordName.value = '';
    recordName.focus();
  }
}

recordForm.addEventListener('submit', e => {
  e.preventDefault();
  if (!pendingRecord) return;
  pendingRecord.name = recordName.value.trim().slice(0, 12) || 'Jugador';
  const records = loadRecords();
  records.push(pendingRecord);
  records.sort((a, b) => b.score - a.score);
  saveRecords(records.slice(0, MAX_RECORDS));
  highlightedRecord = pendingRecord;
  pendingRecord = null;
  recordName.blur();
  recordForm.classList.add('hidden');
  renderAllRecords();
});

function drawIdleBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();
}

playBtn.addEventListener('click', () => {
  startScreen.classList.add('hidden');
  playBtn.blur();
  init();
});

// Pantalla de inicio: tablero vacío detrás y el juego en espera hasta pulsar "Jugar"
board = createBoard();
gameOver = true;
drawIdleBoard();
renderAllRecords();
