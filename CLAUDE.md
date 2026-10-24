# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla JavaScript Tetris on HTML5 Canvas. No dependencies, no `package.json`, no build, no linter, no tests. UI text and README are in Spanish; keep user-facing strings in Spanish.

## Running

Open `index.html` directly, or serve the folder statically (recommended):

```bash
python -m http.server 8000   # then http://localhost:8000
npx serve .
```

Verification is manual in the browser.

## Architecture

- `index.html` — DOM: `#board` canvas (300×600), side panel (`#score`, `#lines`, `#level`, `#next-canvas`), and a single `#overlay` reused for both PAUSA and GAME OVER. Loads `game.js` as a classic (non-module) script at the end of `<body>`.
- `game.js` — all logic, as top-level functions sharing module-level mutable state (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, `animId`, …). `init()` resets all of it and is also the restart handler.
- `style.css` — dark/retro styling; `.hidden` toggles the overlay.

Key invariants in `game.js`:

- A piece's type index (1–7) is the value stored in its shape matrix, in `board` cells after `merge()`, and the index into `COLORS`. `PIECES` and `COLORS` must stay aligned; `0` means empty.
- `collide(shape, x, y)` is the single source of truth for bounds/overlap. Cells with `y < 0` are allowed (above the board). Movement, rotation wall kicks (`tryRotate`, offsets `0, -1, 1, -2, 2`), ghost projection (`ghostY`), and gravity all go through it.
- Locking flow is always `lockPiece()` → `merge()` → `clearLines()` → `spawn()`. `spawn()` promotes `next` to `current`; a collision on spawn triggers `endGame()`.
- `clearLines()` owns scoring for cleared lines, level (`floor(lines / 10) + 1`), and speed (`dropInterval = max(100, 1000 − (level − 1) × 90)`). Drop bonuses live in `softDrop` (+1/row) and `hardDrop` (+2/cell).
- The game loop is `requestAnimationFrame`-based: `loop()` accumulates `dt` into `dropAccum` and applies gravity when it reaches `dropInterval`. Pause/game over stop it via `cancelAnimationFrame(animId)`.
- Board dimensions: if `COLS`, `ROWS`, or `BLOCK` change, update the `<canvas id="board">` `width`/`height` in `index.html` to `COLS×BLOCK` × `ROWS×BLOCK`. The next-piece preview assumes a 4×4 grid of 30px cells (120×120 canvas).
