# Plan 001 — Día 1: fundamentos y preparación del entorno

## Precondiciones y límite del incremento
- La spec 001 está aprobada. El proyecto, Hermes, New Architecture y Development Builds ya fueron validados en Android físico e iOS simulado; se conservará esa evidencia y no se repetirá el setup. RF-2, RF-3, RF-28.
- T1–T3 ya están completadas y T4 permanece pendiente. El contrato de órdenes aprobado amplía T4; seguirá siendo un único checkpoint funcional, pero puede requerir más de un ciclo rojo/verde de 20–30 minutos. Si supera el timebox, se detiene con pruebas en un estado conocido y se retoma T4 sin iniciar T5 ni omitir RF.
- Antes de instalar `i18next`, `react-i18next` y `expo-localization`, se comprobarán sus versiones compatibles con SDK 57 y se usarán mediante `npx expo install`. Express y Faker se instalarán únicamente en el paquete Node de `mock-server`. No se incorpora Jest/RNTL/Maestro todavía. RF-27, RNF-2.

## Archivos y responsabilidades
- `mock-server/package.json`: scripts y dependencias aisladas del servidor.
- `mock-server/src/server.js`: composición HTTP, latencia artificial y arranque; no contiene reglas de catálogo.
- `mock-server/src/catalog/generate-catalog.js`: seed fija y generación exacta de 300 productos. RF-7, RF-8.
- `mock-server/src/catalog/normalize-text.js`: normalización pura para búsqueda. RF-11.
- `mock-server/src/catalog/query-products.js`: validación, facets, sort y paginación puras. RF-10–RF-16.
- `mock-server/src/catalog/home-data.js`: banners, categorías y secciones que reutilizan el catálogo. RF-9.
- `mock-server/src/orders/order-contract.js`: validación strict de request/items/dirección/moneda, errores por field path y normalización previa al fingerprint. RF-18, RF-19, RF-21.
- `mock-server/src/orders/order-totals.js`: cálculo puro canónico MXN, conversión, half-up por línea, envío y resumen sanitizado. RF-20.
- `mock-server/src/orders/order-store.js`: pending configurable, reloj inyectable, reserva atómica, commit/liberación, registro activo y tombstone. RF-22–RF-24.
- `mock-server/src/routes/orders.js`: adaptación HTTP de `POST /orders` y `GET /orders/status/:key`, incluidos envelopes y links no sensibles. RF-18–RF-24.
- `mock-server/test/orders.test.js`, `mock-server/test/server.test.js`: pruebas Node de lógica pura y muestras HTTP exhaustivas; no añaden dependencias ni infraestructura de test a la app.
- `src/core/i18n/index.ts`, `src/core/i18n/resources/{es,en}.ts`: inicialización y recursos visibles del día. RF-27.
- `src/design-system/tokens.ts`, `src/design-system/theme.ts`, `src/design-system/components/{AppText,AppSurface,AppButton}.tsx`: tokens y primitivas accesibles claro/oscuro. RF-26, RNF-3, RNF-4.
- `src/features/foundations/FoundationScreen.tsx`, `src/features/foundations/components/HookLifecycleDemo.tsx`: demostración de JSX, props, estado, referencia, efecto con cleanup y Flexbox. RF-4, RF-5.
- `src/app/_layout.tsx`, `src/app/index.tsx`: proveedores mínimos y ruta delgada que delega en la feature; sustituyen la presentación del template sin añadir navegación del Día 2.
- `LEARNING.md`: teoría, decisiones, ejercicio, preguntas y checklist acumulados. RF-1–RF-3, RF-6, RF-29, RF-30.

## Contratos y lógica pura
- `Product` se documentará mediante JSDoc y validadores del servidor con todos los campos de RF-8; ids y EAN-13 dependen solo de la seed y del índice.
- `ProductQuery` acepta `page`, `limit`, `category`, CSV de `brand`/`subcategory`, `minRating`, booleanos estrictos, `q`, `sort` y `fail`. La secuencia pura será validar → normalizar → filtrar AND/OR → ordenar → calcular metadatos → paginar. RF-10–RF-17.
- `ProductPage` tiene `{ items, page, totalPages, total }`; una página posterior conserva metadatos y devuelve `items: []`.
- `OrderRequest` acepta exactamente `{ items, shippingAddress, currency }`; items únicos tienen `productId` y quantity entera 1–99, dirección aplica los campos/minimos MX aprobados y cualquier propiedad adicional anidada o raíz produce `VALIDATION_ERROR` con paths/códigos sin values. RF-18, RF-19.
- `OrderSummary` usa UUIDv4, RFC 3339 UTC, currency MXN/USD e items `{ productId, quantity, unitPrice, lineTotal }`; nunca contiene dirección. `retryAfterSeconds` es entero ≥1. RF-20, RF-23.
- Totales puros: precio origen → MXN a precisión completa para `canonicalSubtotalMXN` y threshold 800; para respuesta, unitPrice convertido/half-up 2, lineTotal desde unitPrice redondeado × quantity, subtotal suma líneas, shipping 0 o conversión de 99 MXN, total suma final. RF-20.
- Canonicalización pura: validar y trim → ordenar keys recursivamente → ordenar items por productId → serializar → hash no reversible. Orden/whitespace exterior son equivalentes; case, acentos, quantity, currency o contenido cambian fingerprint. RF-21.
- `OrderStore` conserva activo 0–24 h key, fingerprint, timestamps, estado, reserva y resumen sanitizado; de 24–48 h solo tombstone no personal; desde 48 h olvida la key. RF-22–RF-24, RNF-1.

## Flujo de órdenes T4
1. `POST /orders` valida strict. 400 `VALIDATION_ERROR` incluye `fields`; no crea intento/reserva. RF-18, RF-19.
2. Calcula fingerprint y compara key activa. Fingerprint distinto responde 409 `IDEMPOTENCY_KEY_REUSED` con estado/link; el intento original continúa. RF-21.
3. Revalida y reserva stock atómicamente. Insuficiente responde 409 `OUT_OF_STOCK` sin intento/key activa; concurrentes no sobrevendrán. RF-22.
4. Crea UUID/createdAt una vez y responde pending 202. Misma key/fingerprint reutiliza intento/reserva; reloj inyectable confirma tras intervalo y compromete stock. RF-22, RF-23.
5. Si pending alcanza 24 h, expira antes de confirmar y libera reserva. GET/POST durante tombstone responden 410; desde 48 h GET da 404 y POST puede crear otro intento. RF-22, RF-24.
6. `GET /orders/status/:key`: 200 confirmed, 202 pending, 404 `not_created` + `ORDER_NOT_CREATED`, 410 `expired` + `IDEMPOTENCY_KEY_EXPIRED`. Toda respuesta no 2xx conserva error envelope y no expone datos personales. RF-23, RF-24.

## Flujo de datos e interfaz
- El servidor genera una vez el catálogo determinista y todas las respuestas derivan de esa colección, evitando fixtures divergentes.
- La app del Día 1 no consume aún el catálogo: presenta la demo de fundamentos y tema; el acceso por plataforma queda documentado para Días 2–5. RF-25.
- El tema toma la preferencia del sistema y resuelve tokens semánticos; los componentes consumen tokens, no colores literales. El cambio de esquema vuelve a renderizar la pantalla sin reinicio. RF-26.
- Los recursos es/en existen desde la primera pantalla. El selector temporal de la demo permite revisar ambos idiomas; la preferencia global definitiva se completa en Día 6. RF-27.

## Android, iOS, CNG y conexión
- No se editarán `android/` ni `ios/`. Las dependencias se verifican antes de instalarlas; al cambiar localización/configuración se ejecutarán compatibilidad y Expo Doctor y se recompilará solo si la documentación confirma cambio nativo.
- URLs previstas: Android emulator `http://10.0.2.2:<port>`, iOS simulator `http://localhost:<port>`, físico `http://<LAN_IP>:<port>`. Para Android físico USB, `adb reverse tcp:<port> tcp:<port>` queda como alternativa de desarrollo, no como contrato de producción. RF-25.
- Confirmación manual obligatoria en Android e iOS tras la demo de tema/hooks y al cerrar el día. RF-28.

## Accesibilidad, i18n y rendimiento
- `AppButton` ofrece hit target 48 dp/44 pt, rol y estado; `AppText` permite font scaling; tema y estados no dependen solo del color. RNF-3.
- Reduced motion elimina movimiento decorativo de la demo y conserva el resultado estático. RNF-4.
- No se memoiza la demo: se observarán renders y cleanup con logs de desarrollo sin trabajo pesado ni datos personales. RF-4, RNF-1.

## Decisiones y alternativas
- **Elegida:** servidor Node independiente con Express/Faker y funciones puras. **Trade-off:** dos procesos locales. **Descartada:** json-server, porque no expresa validación, idempotencia ni latencia controlada.
- **Elegida:** tests del mock con runner integrado de Node. **Trade-off:** API de assertions más básica. **Descartada:** adelantar Jest, reservado para Día 6.
- **Elegida:** reloj y periodo de procesamiento inyectables con pruebas sin espera real. **Trade-off:** el store recibe tiempo como dependencia. **Descartada:** timers reales lentos/no deterministas.
- **Elegida:** reserva atómica al crear pending. **Trade-off:** stock reservado hasta confirmar/expirar. **Descartada:** recheck al confirmar, que permitiría sobreventa o invalidaría un pending aceptado.
- **Elegida:** registro activo 24 h + tombstone 24 h. **Trade-off:** se conserva una key no personal hasta 48 h. **Descartada:** olvidar al minuto 24, que impediría distinguir expiración de key inexistente.
- **Elegida:** tokens semánticos y tres primitivas, no una librería extensa. **Trade-off:** pocos componentes iniciales. **Descartada:** migrar todo el template antes de necesitarlo.
- **Elegida:** i18n desde Día 1. **Trade-off:** trabajo inicial adicional. **Descartada:** textos hardcoded y deuda hasta Día 6, incompatible con la constitución.

## Verificación
- Sin nuevas herramientas: pruebas Node del mock, arranque repetido con seed, matriz manual de HTTP, `npx expo lint`, `npx tsc --noEmit`, `npx expo install --check`, `npx expo-doctor@latest` y revisión Android/iOS.
- T4 se ejecuta test-first con `node:test`: primero falla cada caso por ausencia del contrato y luego queda verde sin dependencias nuevas. La matriz cubre strict/extras/fields, quantity 1–99, UUID/RFC3339/retry entero, half-up y umbral/envío, fingerprint semántico, concurrencia/reserva, 400, ambos 409, pending/confirmed, 404/410 y fronteras 24/48 h con reloj inyectable.
- La muestra HTTP verifica `POST /orders` y `GET /orders/status/:key`, envelopes estables sin values/PII y que estado/logs nunca contienen dirección ni request reversible.
- Jest/RNTL/Maestro no se instalan ni ejecutan este día; el Día 6 añadirá regresión acumulada.

## Bloque pedagógico
- Antes de cada checkpoint: teoría ≤10 min de hilos, Metro/Hermes, New Architecture/Bridge, Expo/CNG, JSX/hooks/render y estilos. RF-1–RF-4.
- Analogías: JS/UI threads ↔ Main/Dispatch queues; hooks ↔ estado/efectos de Compose y SwiftUI; reconciliación ↔ recomposición/diffing; props ↔ parámetros inmutables.
- `LEARNING.md` registra elección, trade-off y descartada; ejercicio sin solución sobre hook con cleanup; 8–10 preguntas con respuestas modelo; checklist oral; validación dual y commit inglés. RF-6, RF-29, RF-30.
