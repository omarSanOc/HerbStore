---
description: SDD · Valida una implementación RF por RF
agent: reviewer
---

Valida la implementación de `specs/$1/` sin modificar archivos:
1. Lee `spec.md`, `plan.md`, `tasks.md`, `AGENTS.md` y el diff actual.
2. Ejecuta lint, typecheck y las pruebas Jest/RNTL/Maestro definidas en el plan.
3. Recorre cada RF e indica la prueba o verificación que lo cubre y su resultado.
4. Revisa evidencia separada de Android e iOS para requisitos de UI o plataforma.
5. Comprueba accesibilidad, estados loading/error/empty/offline y criterios de finalización cuando apliquen.

Empieza con `VEREDICTO: APROBADO` o `VEREDICTO: CAMBIOS NECESARIOS`. No arregles nada.
