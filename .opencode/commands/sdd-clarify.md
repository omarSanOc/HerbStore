---
description: SDD · Revisa una spec como QA sin modificarla
agent: reviewer
---

Revisa `specs/$1/spec.md` como QA mobile. Usa la skill `sdd` y lista únicamente:
1. Ambigüedades o requisitos no verificables.
2. Contradicciones.
3. Casos límite no cubiertos, incluidos loading/error/empty/offline.
4. Diferencias Android/iOS, accesibilidad o rendimiento omitidos.
5. Conflictos con `AGENTS.md` o `docs/constitution.md` si existe.

No propongas soluciones todavía. Devuelve una lista numerada.
