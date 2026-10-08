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
  '#f06292', // Ring - pink
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
  [[8,8,8],[8,0,8],[8,8,8]],                  // Ring 3x3 con hueco
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const holdCanvas = document.getElementById('hold-canvas');
const holdCtx = holdCanvas.getContext('2d');
const scoreEl =document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const pauseMenu = document.getElementById('pause-menu');
const pauseMain = document.getElementById('pause-main');
const pauseControls = document.getElementById('pause-controls');
const resumeBtn = document.getElementById('resume-btn');
const pauseRestartBtn = document.getElementById('pause-restart-btn');
const controlsBtn = document.getElementById('controls-btn');
const controlsBackBtn = document.getElementById('controls-back-btn');
const levelDownBtn = document.getElementById('level-down');
const levelUpBtn = document.getElementById('level-up');
const startLevelEl = document.getElementById('start-level');
const themeToggle = document.getElementById('theme-toggle');

const MIN_LEVEL = 1;
const MAX_LEVEL = 15;

let startLevel = 1;
let hold, canHold;
let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

function intervalForLevel(lvl) {
  return Math.max(100, 1000 - (lvl - 1) * 90);
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  return createPiece(Math.floor(Math.random() * (PIECES.length - 1)) + 1);
}

function createPiece(type) {
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
    level = startLevel + Math.floor(lines / 10);
    dropInterval = intervalForLevel(level);
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
  canHold = true;
  drawHold();
}

function holdPiece() {
  if (!canHold) return;
  if (hold === null) {
    hold = current.type;
    spawn();
  } else {
    const t = hold;
    hold = current.type;
    current = createPiece(t);
    if (collide(current.shape, current.x, current.y)) endGame();
  }
  canHold = false;
  dropAccum = 0;
  drawHold();
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
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--grid').trim();
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

function drawPreview(context, cnv, piece) {
  const NB = 30;
  context.clearRect(0, 0, cnv.width, cnv.height);
  if (!piece) return;
  const shape = piece.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(context, offX + c, offY + r, shape[r][c], NB);
}

function drawNext() {
  drawPreview(nextCtx, nextCanvas, next);
}

function drawHold() {
  drawPreview(holdCtx, holdCanvas, hold === null ? null : createPiece(hold));
  holdCanvas.classList.toggle('locked', !canHold);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function showPauseView(view) {
  const controls = view === 'controls';
  pauseMain.classList.toggle('hidden', controls);
  pauseControls.classList.toggle('hidden', !controls);
  (controls ? controlsBackBtn : resumeBtn).focus();
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    pauseMenu.classList.add('hidden');
    if (document.activeElement) document.activeElement.blur();
    lastTime = performance.now();
    animId = requestAnimationFrame(loop);
  } else {
    cancelAnimationFrame(animId);
    pauseMenu.classList.remove('hidden');
    showPauseView('main');
  }
}

function setStartLevel(lvl) {
  startLevel = Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, lvl));
  startLevelEl.textContent = startLevel;
}

function loop(ts) {
  if (gameOver || paused) return;
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
  draw();
  if (!gameOver) animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = startLevel;
  paused = false;
  gameOver = false;
  dropInterval = intervalForLevel(level);
  dropAccum = 0;
  lastTime = performance.now();
  hold = null;
  canHold = true;
  next = randomPiece();
  spawn();
  drawHold();
  updateHUD();
  overlay.classList.add('hidden');
  pauseMenu.classList.add('hidden');
  if (document.activeElement) document.activeElement.blur();
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (e.code === 'Escape' && paused && !pauseControls.classList.contains('hidden')) {
      showPauseView('main'); // Esc dentro de controles vuelve al menú
    } else {
      togglePause();
    }
    return;
  }
  if (paused) {
    handleMenuKey(e);
    return;
  }
  if (gameOver) return;
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
    case 'KeyC':
    case 'ShiftLeft':
    case 'ShiftRight':
      holdPiece();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

// Navegación dentro del menú; los inputs del juego quedan bloqueados mientras está abierto
function handleMenuKey(e) {
  const visible = [...pauseMenu.querySelectorAll('button')].filter(b => b.offsetParent !== null);
  const i = visible.indexOf(document.activeElement);
  const inMain = !pauseMain.classList.contains('hidden');
  if (e.code === 'ArrowDown') {
    e.preventDefault();
    visible[(i + 1) % visible.length].focus();
  } else if (e.code === 'ArrowUp') {
    e.preventDefault();
    visible[(i - 1 + visible.length) % visible.length].focus();
  } else if (e.code === 'ArrowLeft' && inMain) {
    setStartLevel(startLevel - 1);
  } else if (e.code === 'ArrowRight' && inMain) {
    setStartLevel(startLevel + 1);
  } else if (e.code === 'Space') {
    e.preventDefault(); // evita doble activación del botón enfocado
    if (document.activeElement && document.activeElement.click) document.activeElement.click();
  }
}

restartBtn.addEventListener('click', init);
resumeBtn.addEventListener('click', togglePause);
pauseRestartBtn.addEventListener('click', init);
controlsBtn.addEventListener('click', () => showPauseView('controls'));
controlsBackBtn.addEventListener('click', () => showPauseView('main'));
levelDownBtn.addEventListener('click', () => setStartLevel(startLevel - 1));
levelUpBtn.addEventListener('click', () => setStartLevel(startLevel + 1));

function applyTheme(theme) {
  const light = theme === 'light';
  if (light) document.documentElement.dataset.theme = 'light';
  else delete document.documentElement.dataset.theme;
  themeToggle.setAttribute('aria-checked', String(light));
  try { localStorage.setItem('theme', theme); } catch (e) { /* ignore */ }
  // redibujar para pausa / game over (el loop no corre)
  if (current) { draw(); drawNext(); drawHold(); }
}

themeToggle.addEventListener('click', () => {
  const light = document.documentElement.dataset.theme !== 'light';
  applyTheme(light ? 'light' : 'dark');
  themeToggle.blur(); // evitar que Space active el botón
});

let savedTheme = 'dark';
try { savedTheme = localStorage.getItem('theme') === 'light' ? 'light' : 'dark'; } catch (e) { /* ignore */ }
applyTheme(savedTheme);

init();
