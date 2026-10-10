---
description: SDD · Añade un requisito (uso /sdd-change 001-nombre texto)
agent: planner
---

Nuevo requisito para `specs/$1/`: $2

No toques código. Usa la skill `sdd`:
1. Actualiza `specs/$1/spec.md` con el RF nuevo o modificado en EARS.
2. Añade casos límite y ajusta lo que queda fuera de alcance.
3. Indica qué partes de `plan.md` y `tasks.md` deberán cambiar después.
4. Actualiza `MEMORY.md` de forma breve.
5. Muéstrame el diff de la spec y espera mi aprobación.
