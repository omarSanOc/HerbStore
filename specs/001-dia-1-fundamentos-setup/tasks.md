# Tareas 001 — Día 1: fundamentos y preparación del entorno

- [x] **T1. Preparar el paquete aislado del mock y los contratos base.** RF-7, RF-8, RF-9, RF-25
- Hecho cuando: las dependencias Express/Faker están limitadas a `mock-server`, el proceso responde health/home y las tres URLs de conexión están documentadas; parar y comprobar el acceso desde Android e iOS.
- [x] **T2. Generar el catálogo determinista.** RF-7, RF-8, RF-11
- Hecho cuando: dos ejecuciones con la misma seed producen exactamente 300 productos con ids/EAN iguales y la prueba Node de normalización y seed pasa.
- [x] **T3. Completar consultas de catálogo y contratos HTTP.** RF-9, RF-10, RF-11, RF-12, RF-13, RF-14, RF-15, RF-16, RF-17
- Hecho cuando: endpoints, facets CSV, sort, búsqueda, metadatos y matriz 200/400/404/500 pasan pruebas Node, incluida latencia antes de `fail=true`.
- [x] **T4. Completar órdenes idempotentes y consulta de estado.** RF-18, RF-19, RF-20, RF-21, RF-22, RF-23, RF-24
- Hecho cuando: ciclos rojo/verde con `node:test` y una muestra HTTP verifican `POST /orders` y `GET /orders/status/:key`; strict request/address/items/currency, extras rechazados, quantity 1–99, UUIDv4, RFC3339 y retry entero; `VALIDATION_ERROR.fields` sin values; cálculo MXN/tasa18/threshold800/shipping99/half-up por línea; canonicalización/fingerprint; reserva atómica, pending/commit/liberación; `OUT_OF_STOCK` frente a `IDEMPOTENCY_KEY_REUSED`; 200/202 y envelopes 404/410; fronteras activo 0–24 h, tombstone 24–48 h y olvido posterior con reloj inyectable; estado/logs no contienen dirección ni request reversible. Si requiere más de 30 minutos, se pausa dentro de T4 tras un ciclo rojo/verde estable y no se inicia T5.
- [x] **T5. Crear i18n y el design system mínimo.** RF-26, RF-27, RNF-3, RNF-4
- Hecho cuando: tokens, texto, superficie y botón funcionan en claro/oscuro, es/en, font scaling y reduced motion; parar y confirmar visualmente en Android e iOS.
- [x] **T6. Construir la demo de componentes, hooks y Flexbox.** RF-1, RF-2, RF-3, RF-4, RF-5, RF-6
- Hecho cuando: la ruta delgada muestra props inmutables, estado, ref, efecto con cleanup y layout flexible, y el material previo explica analogías y trade-offs.
- [x] **T7. Cerrar y validar el Día 1.** RF-28, RF-29, RF-30, RNF-1, RNF-2, RNF-3, RNF-4
- Hecho cuando: pruebas Node, lint, tipos, compatibilidad y diagnóstico pasan; tema/idioma/accesibilidad se validan en Android e iOS; `LEARNING.md`, ejercicio, 8–10 respuestas, checklist y commit inglés quedan completos; detenerse.
