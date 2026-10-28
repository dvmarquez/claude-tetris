---
description: Crea un worktree aislado en .trees/[nombre] y ejecuta ahí el requerimiento
argument-hint: <requerimiento a implementar>
allowed-tools: Bash(git worktree:*), Bash(git branch:*), Bash(git status:*), Bash(git -C:*)
---

Requerimiento: $ARGUMENTS

Si el requerimiento está vacío, pide al usuario que lo indique y detente.

## 1. Determinar el nombre

A partir del requerimiento, elige un nombre corto en kebab-case, en minúsculas y sin acentos (2–4 palabras, p. ej. `pieza-nueva-l`, `fix-colision-rotacion`). Ese nombre se usa tanto para la carpeta como para la rama.

Antes de crearlo, verifica con `git worktree list` y `git branch --list <nombre>` que no exista ya; si existe, añade un sufijo (`-2`, `-3`, …).

## 2. Crear el worktree

```bash
git worktree add .trees/<nombre> -b <nombre>
```

La rama nueva parte del `HEAD` actual. Confirma que se creó con `git worktree list`.

## 3. Ejecutar el requerimiento dentro del worktree

Todo el trabajo ocurre **exclusivamente** en `.trees/<nombre>/`, aislado del código principal:

- Lee, edita y crea archivos solo con rutas bajo `.trees/<nombre>/`. No modifiques ningún archivo fuera de esa carpeta.
- Ejecuta los comandos git con `git -C .trees/<nombre> ...` para que actúen sobre la rama del worktree.
- Respeta las convenciones de `CLAUDE.md` (textos de UI en español, invariantes de `game.js`).
- Al terminar, haz commit de los cambios en la rama `<nombre>` dentro del worktree. No hagas merge ni push salvo que el usuario lo pida.

## 4. Reportar

Indica al usuario:

- Nombre del worktree, ruta (`.trees/<nombre>`) y rama.
- Resumen de los cambios y el commit creado.
- Cómo probarlo: `cd .trees/<nombre> && python -m http.server 8000`.
- Cómo integrarlo o descartarlo: `git merge <nombre>` / `git worktree remove .trees/<nombre> && git branch -D <nombre>`.
