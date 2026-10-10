---
description: SDD · Genera el plan técnico de una spec aprobada
agent: planner
---

Lee `AGENTS.md`, `MEMORY.md`, `docs/constitution.md` si existe y `specs/$1/spec.md`. Usa la skill `sdd` y no escribas código.

Genera `specs/$1/plan.md` con:
1. Archivos y responsabilidades dentro de la arquitectura de HerbStore.
2. Flujo de datos, contratos API, estado y lógica pura.
3. Algoritmo o secuencia en pseudocódigo.
4. Comportamiento de interfaz y estados loading/error/empty/offline.
5. Impacto Android/iOS, CNG y necesidad de recompilar.
6. Accesibilidad, i18n y rendimiento.
7. Decisiones técnicas con alternativa descartada y trade-off.
8. Estrategia Jest/RNTL/Maestro y RF cubiertos por cada prueba.
9. Conceptos RN y equivalentes Kotlin/Compose y Swift/SwiftUI.

Si la spec no está aprobada o tiene dudas abiertas, para y avísame.
