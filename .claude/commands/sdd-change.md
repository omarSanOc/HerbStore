---
description: SDD · Añade o cambia un requisito (uso /sdd-change 001-nombre "texto")
argument-hint: <NNN-nombre> "<requisito>"
context: fork
agent: planner
background: false
---
Ejecuta las instrucciones de `.opencode/commands/sdd-change.md` (fuente única compartida con OpenCode; ignora su frontmatter). La carpeta de la spec es `specs/$0/` y el requisito es el texto que sigue a `$0` en «$ARGUMENTS».
Como no puedes mostrar el diff con git, devuelve el bloque antes/después de cada sección modificada.
