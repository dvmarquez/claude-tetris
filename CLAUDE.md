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

## Key invariants in `game.js`

- A piece's type index (1–9) is the value stored in its shape matrix, in `board` cells after `merge()`, and the index into `COLORS`. `PIECES` and `COLORS` must stay aligned; `0` means empty.
- `collide(shape, x, y)` is the single source of truth for bounds/overlap. Cells with `y < 0` are allowed (above the board). Movement, rotation wall kicks (`tryRotate`, offsets `0, -1, 1, -2, 2`), ghost projection (`ghostY`), and gravity all go through it.
- Locking flow is always `lockPiece()` → `merge()` → `clearLines()` → `spawn()`. `spawn()` promotes `next` to `current`; a collision on spawn triggers `endGame()`.
- Board dimensions: if `COLS`, `ROWS`, or `BLOCK` change, update the `<canvas id="board">` `width`/`height` in `index.html` to `COLS×BLOCK` × `ROWS×BLOCK`. The next-piece preview assumes a 4×4 grid of 30px cells (120×120 canvas).
