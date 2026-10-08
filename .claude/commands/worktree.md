---
description: Crea un git worktree aislado en .trees/[nombre] y ejecuta ahí las instrucciones dadas
argument-hint: <instrucciones a ejecutar en el worktree>
---

Instrucciones recibidas para ejecutar en un worktree aislado:

$ARGUMENTS

## Pasos

1. **Elige el nombre**: deriva un nombre corto en kebab-case (2-4 palabras, minúsculas, sin acentos) que describa el requerimiento. Ejemplo: "agregar sistema de puntaje" → `score-system`.
2. **Verifica** que `.trees/<nombre>` no exista ya (`git worktree list`). Si existe, agrega un sufijo (`-2`).
3. **Asegura el ignore**: si `.trees/` no está en `.gitignore`, agrégalo.
4. **Crea el worktree** desde la raíz del repo:
   ```
   git worktree add .trees/<nombre> -b worktree/<nombre>
   ```
5. **Ejecuta las instrucciones ahí**, de forma independiente y aislada:
   - Trabaja SOLO dentro de `.trees/<nombre>` (usa rutas absolutas a ese directorio para leer/editar y `git -C .trees/<nombre> ...` para git).
   - NO modifiques archivos del directorio principal ni de otros worktrees.
   - Si el proyecto necesita dependencias (p. ej. `npm install`), instálalas dentro del worktree.
   - Haz commits en la rama `worktree/<nombre>` cuando el trabajo esté completo.
6. **Reporta** al terminar: nombre del worktree, ruta, rama, resumen de cambios y cómo integrarlo (`git merge worktree/<nombre>`) o eliminarlo (`git worktree remove .trees/<nombre>`). No hagas merge ni push sin que el usuario lo pida.
