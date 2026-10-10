---
description: SDD · Entrevista y genera una spec (uso /sdd-spec 001-nombre idea)
agent: planner
---

No escribas código. Lee `AGENTS.md`, `MEMORY.md`, `docs/constitution.md` si existe y usa la skill `sdd`.

Carpeta de la spec: `specs/$1/`
Idea inicial: $2

1. Haz preguntas de una en una para eliminar ambigüedades; máximo 5.
2. Cubre comportamiento, errores, casos límite, diferencias de plataforma y fuera de alcance.
3. Con mis respuestas, genera `specs/$1/spec.md` con requisitos EARS y `Estado: borrador`.
4. Describe solo el QUÉ y el POR QUÉ: nada de stack, arquitectura o nombres de archivos.
5. Actualiza `MEMORY.md` y espera mi aprobación.
