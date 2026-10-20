# Tareas 007 — Integración con API persistente

Estado de las tareas: aprobadas.

- [x] **T1. Añadir el contrato de idioma en la frontera HTTP.** RF-22, RF-23, RF-27, RF-34; RNF-3, RNF-7
  - Escribir primero tests de `http`, base query y `mock-fetch` para `Accept-Language`, `Content-Language` correcto, ausente, inválido y distinto, comprobando que health/órdenes sin opt-in siguen aceptándose.
  - Hecho cuando: la frontera devuelve `invalid` ante incoherencia localizada, no registra headers/inputs, los tests dirigidos pasan y lint/typecheck están limpios.

- [x] **T2. Hacer el idioma parte de todas las identidades de consulta localizadas.** RF-9–RF-14, RF-21–RF-27, RF-40; RNF-3, RNF-5
  - Escribir primero pruebas de dos cachés `es/en`, una sola solicitud por consulta equivalente y respuesta tardía; después adaptar Home, productos, categorías, marcas, detalle, scanner y refresh de stock para argumentos localizados y `currentData`.
  - Hecho cuando: cada GET localizado envía el header, `es` y `en` tienen entradas distintas, no se muestra data previa tras cambiar idioma, ids/EAN inválidos hacen cero requests y los tests dirigidos pasan con lint/typecheck.

- [x] **T3. Entregar copy remoto y completar estados de facets e imágenes.** RF-8, RF-9, RF-15, RF-28–RF-32, RF-35; RNF-3, RNF-4
  - Escribir primero tests Node/RNTL para copy es/en venido de API, marcas/categorías loading/sin opciones/offline/error/stale y fallback de imagen; después retirar tablas estáticas de banners/categorías/secciones/subcategorías y añadir la presentación accesible necesaria.
  - Hecho cuando: la API es la única propietaria del copy de catálogo, i18n conserva solo chrome/fallbacks, la matriz visible de Home/listas/facets/detail/barcode/imágenes está cubierta y paridad i18n, lint y typecheck pasan.

- [x] **T4. Reforzar order status, privacidad y datos locales ante productos desaparecidos.** RF-16–RF-20, RF-33, RF-34, RF-36–RF-40; RNF-4, RNF-7, RNF-9
  - Escribir primero tablas de parsers/máquina y RNTL para loading/pending/offline/5xx/422/incompatible, doble toque, key nueva por intento y mismo intento recuperado; añadir casos de carrito, historial y pedido local cuando detalle devuelve 404.
  - Hecho cuando: solo pares contractuales liberan/confirman, offline/error son observables sin persistir PII, una consulta incoherente conserva `unresolved`, el snapshot/historial local sobreviven y tests, lint y typecheck pasan.

- [x] **T5. Desacoplar por completo la suite automática del backend y blindar artefactos.** RF-5, RF-17, RF-18, RF-41, RF-49; RNF-2
  - Hacer fallar primero la auditoría ante imports de `mock-server`, `src/test` o `testing` desde producto; sustituir tests que importan backend por fixtures locales y actualizar todas las respuestas localizadas controladas con headers explícitos.
  - Hecho cuando: `npm test` pasa con la API detenida, no existe ningún import de tests/backend desde producto, los fixtures exclusivos siguen disponibles para pruebas y la auditoría de fuentes rechaza activadores runtime.

- [x] **T6. Crear la verificación viva opt-in y no mutante.** RF-7–RF-23, RF-27, RF-34, RF-40–RF-42; RNF-8, RNF-9
  - Escribir primero pruebas de las funciones puras del verificador con fetch inyectado; después añadir el comando que exige origen explícito y comprueba OpenAPI, health, es/en, filtros/sorts/paginación, detalle, barcode, imagen y errores GET sin ejecutar `POST /orders`.
  - Hecho cuando: el script falla con causa por contrato/idioma, no imprime keys/inputs, termina en verde contra la API disponible, `npm test` sigue sin invocarlo y lint/typecheck pasan.

- [x] **T7. Migrar Maestro a stock persistente y entorno exclusivo.** RF-36, RF-37, RF-43, RF-44, RF-47, RF-48; RNF-8, RNF-9
  - Mantener primero en Jest/RNTL la carrera determinista de dos toques y un POST; adaptar preflight/scripts/YAML para health, producto parametrizable, stock observado >0, exclusividad declarada, una confirmación/fila y delta −1, eliminando stock 99 y `ORDER_POST_DELAY_MS`.
  - Hecho cuando: el flujo no resetea backend, aborta antes de mutar como `INCONCLUSA` si falta precondición, y con exclusividad sostenida prueba una orden; los extras no mutantes y README de Maestro quedan coherentes.

- [x] **T8. Eliminar fixtures runtime y `mock-server`, y limpiar automatización activa.** RF-1, RF-5, RF-6, RF-17, RF-41, RF-49
  - Ejecutar primero suite/auditorías ya desacopladas; borrar `home-fixture-env.ts`, `home-fixtures.ts`, sus tests, `/home?fail=true` y el backend completo; retirar de CI y Dependabot lockfiles, instalaciones, tests y actualizaciones del backend.
  - Hecho cuando: no quedan fuentes/comandos activos del backend, CI solo ejecuta verificaciones offline de la app, specs/evidencia históricas permanecen intactas y `npm test`, lint, typecheck y `git diff --check` pasan.

- [x] **T9. Actualizar normas, documentación y memoria técnica.** RF-5, RF-6, RF-41, RF-42, RF-47; RNF-5, RNF-8
  - Retirar de CI y Dependabot toda referencia al backend eliminado; ajustar AGENTS, README y `.env.example` a la API persistente (`EXPO_PUBLIC_API_ORIGIN`, smoke opt-in, Maestro sin reset); conservar sin cambio el placeholder EAS de `eas.json` (decisión registrada en el plan); añadir nota de transición en LEARNING sin reescribir Días 1–6, auditar comentarios de producto y actualizar MEMORY al cierre.
  - Hecho cuando: ninguna norma o guía activa exige el backend eliminado, la nueva frontera de API/idioma/pruebas queda documentada, la evidencia histórica no se reescribe y `npm test`, lint, typecheck y `git diff --check` pasan.

- [x] **T10. Implementar QR→EAN-13 y validar la matriz bloqueante en Samsung USB e iOS Simulator.** RF-2, RF-3, RF-22–RF-35, RF-40, RF-43–RF-53; RNF-3–RNF-5, RNF-8–RNF-11
  - Escribir primero tests puros y Jest/RNTL para trim externo, EAN-13 válido por checksum, espacios internos, longitud/caracteres/checksum inválidos, URL/id/deep link/payload arbitrario sin request, QR válido existente e inexistente, EAN-13 directo de regresión y callbacks duplicados con una sola consulta; comprobar también estados, reintento y acción accesible para escanear de nuevo.
  - Después habilitar la simbología QR sin retirar EAN-13, normalizar y validar localmente el payload y reutilizar únicamente `GET /products/barcode/{ean13}`; no cambiar la API, no enviar el payload original, no abrir enlaces y no persistir ni registrar entradas rechazadas.
  - Con los tests verdes, ejecutar en Samsung físico la matriz de RF-48 incluyendo QR válido existente, QR válido inexistente, QR inválido y payloads no interpretables; en iOS Simulator cubrir lo aplicable y documentar explícitamente cualquier limitación de cámara; ejecutar Maestro sin reset bajo exclusividad o registrar `INCONCLUSA` según RF-44 y auditar los exports de producción Android/iOS contra los marcadores prohibidos (RF-17, RF-49).
  - Hecho cuando: tests dirigidos, lint, typecheck y `npm test` pasan; `docs/evidence/spec-007-api-persistente.md` contiene plataforma, condición, pasos, tráfico/observación y resultado de ambas plataformas sin seriales, PII ni keys; RF-50–RF-53 y RNF-10–RNF-11 están evidenciados. Si falta evidencia Android o iOS, devolver `PENDIENTE DE VALIDACIÓN MANUAL` y no marcar la tarea.
