---
description: SDD · Entrevista y genera una spec (uso /sdd-spec 007-nombre "idea")
argument-hint: <NNN-nombre> "<idea>"
---
Fase SDD: Spec. Carpeta: `specs/$0/`. Idea inicial: el texto que sigue a `$0` en «$ARGUMENTS».

Los pasos están en `.opencode/commands/sdd-spec.md` (fuente única compartida con OpenCode). En Claude Code se reparten así, porque un subagente no puede conversar con el usuario:
1. Tú, la sesión principal, haces la entrevista: preguntas de una en una, máximo 5, cubriendo comportamiento, errores, casos límite, diferencias de plataforma y fuera de alcance. No escribas archivos.
2. Con las respuestas, delega en el subagente `planner` la redacción de `specs/$0/spec.md` y la actualización de `MEMORY.md`. Pásale la carpeta, la idea, las preguntas y respuestas literales y que siga `.opencode/commands/sdd-spec.md`.
3. Muestra las rutas y el resumen que devuelva y para hasta que el usuario apruebe la spec.
