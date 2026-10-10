---
name: sdd
description: Úsala siempre que trabajes con Spec-Driven Development en este proyecto (docs/constitution.md o cualquier archivo dentro de specs/) - redactar, revisar o cambiar specs, planes y tareas, o implementar y validar tareas de una spec.
---
# Spec-Driven Development (SDD)

## Flujo
Constitución → Spec → Clarificación → Plan → Tareas → Implementación → Validación → Cambio.
- Nunca pases a la siguiente fase sin la aprobación explícita del usuario.
- La spec manda: si algo no está en la spec, no se implementa. Si falta una decisión, para y pregunta.
- Un cambio de requisitos se hace primero en la spec, luego en el plan y las tareas, y por último en el código.
- Cada spec vive en su carpeta: `specs/NNN-nombre/` con `spec.md`, `plan.md` y `tasks.md`.
- Al terminar cada fase, actualiza `MEMORY.md`.

## Plantilla de spec (spec.md)
```
# Spec NNN — <Nombre>
Estado: borrador | aprobada | implementada
## Contexto y objetivo
## Usuarios
## Historias de usuario
- HU-1. Como <rol>, quiero <acción> para <beneficio>.
## Definiciones (solo si hay términos que puedan interpretarse de varias formas)
## Requisitos funcionales
## Requisitos no funcionales
## Casos límite
## Fuera de alcance
## Criterios de finalización
## Dudas abiertas
- [NECESITA ACLARACIÓN] <duda>
```
La spec describe el QUÉ y el POR QUÉ. Nada de stack, arquitectura ni nombres de archivos.

## Requisitos en EARS (en español)
- RF-x: CUANDO <evento>, EL SISTEMA <respuesta>.
- RF-x: SI <condición no deseada>, ENTONCES EL SISTEMA <respuesta>.
- RF-x: MIENTRAS <estado>, EL SISTEMA <respuesta>.
- RF-x: EL SISTEMA <comportamiento permanente>.
Cada RF debe ser verificable: nada de "rápido", "intenso" o "bonito" sin un criterio medible.

## Plan (plan.md)
- Archivos y responsabilidades dentro de `src/app`, `src/features`, `src/core`, `src/design-system` o `mock-server`.
- Estado, flujo de datos, contratos API y lógica pura que pueda probarse de forma aislada.
- Impacto en Android/iOS, CNG/config plugins y necesidad de recompilar el Development Build.
- Estados loading/error/empty/offline, accesibilidad, i18n y rendimiento cuando apliquen.
- Decisiones justificadas con la alternativa descartada y sus trade-offs.
- Estrategia de Jest, React Native Testing Library y/o Maestro según el tipo de requisito.
- Conceptos RN que se enseñarán y su analogía con Kotlin/Compose y Swift/SwiftUI.
- Indica qué RF cubre cada parte. No agregues capas de arquitectura sin responsabilidad real.

## Tareas (tasks.md)
```
- [ ] **Tn. <Descripción>.** RF-x, RF-y
- Hecho cuando: <comprobación verificable>.
```
Máximo 20-30 min por tarea, en orden de dependencia. Si salen más de 10, propón dividir la spec.

## Implementación
Una sola tarea cada vez:
1. Lee `AGENTS.md`, `MEMORY.md`, la constitución si existe, la spec, el plan y la tarea.
2. Para lógica verificable, escribe primero el test y confirma que falla por la razón esperada.
3. Implementa solo lo necesario para poner en verde los tests de la tarea.
4. Ejecuta `npx expo lint`, `npx tsc --noEmit` y las pruebas indicadas en el plan.
5. Si cambia código/configuración nativa, recompila; si cambia UI o comportamiento, valida Android e iOS.
6. Marca la tarea, actualiza `MEMORY.md` y para. No empieces la siguiente.
