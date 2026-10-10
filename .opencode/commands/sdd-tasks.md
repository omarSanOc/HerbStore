---
description: SDD · Divide el plan en tareas pequeñas y verificables
agent: planner
---

A partir de `specs/$1/spec.md` y `specs/$1/plan.md`, genera `specs/$1/tasks.md` según la skill `sdd`:
- Tareas de 20–30 minutos, ordenadas por dependencia.
- Cada tarea incluye RF y una línea `Hecho cuando:` verificable.
- Incluye tests y validación Android/iOS dentro de la tarea que corresponda.
- No separes archivos y tests en tareas distintas si forman un mismo comportamiento.
- Máximo 10 tareas; si salen más, propón dividir la spec.

Actualiza `MEMORY.md` y espera mi aprobación.
