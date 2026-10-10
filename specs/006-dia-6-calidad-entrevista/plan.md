# Plan 006 — Día 6: calidad y preparación de entrevista

## Precondiciones y límite del incremento
- Requiere los cinco días funcionales y validados. Este día añade infraestructura de test aprobada y corrige hallazgos; no introduce pantallas comerciales nuevas.
- Antes de instalar Jest, `jest-expo`, React Native Testing Library y dependencias requeridas, comprobar compatibilidad SDK 57 y usar `npx expo install`. Maestro se valida como herramienta E2E externa, no como dependencia runtime.
- El alcance (suite + auditorías + live coding + 30 preguntas) puede superar 3 horas. Se divide en 8 checkpoints ejecutables: pruebas críticas y preferencias primero, auditorías después, entrevista al final. Si se agota el timebox, no se elimina ningún RF ni se cierra el programa; se continúa desde el checkpoint pendiente.

## Archivos y responsabilidades
- `package.json`, `jest.config.js`, `jest.setup.ts`: entorno Jest/Expo, scripts y mocks base sin red real.
- `src/features/cart/**/*.test.ts`, `src/features/preferences/**/*.test.ts`: reducers/selectors, conversión y umbral. RF-3.
- `src/features/checkout/**/*.test.ts`: schema, fingerprint observable y máquina 4xx/200/202/404/410/offline. RF-3–RF-5, RF-17.
- `src/features/products/**/*.test.ts`, `src/features/search/**/*.test.ts`: query identity, merge, filtros, debounce e historial.
- `src/test/render-with-providers.tsx`, `src/test/fixtures.ts`, `src/test/mock-fetch.ts`: harness determinista para Redux/i18n/RTK Query sin internet. RF-4, RF-5.
- Tests RNTL colocados junto a `ProductListScreen`, `CartScreen`, `CheckoutScreen`, `OrderStatusScreen` y fallbacks globales: conducta visible, roles y acciones.
- `.maestro/checkout.yaml`, `.maestro/reset-state.yaml`: flujo buscar→agregar→dirección→doble toque→una confirmación. RF-6.
- `src/features/account/screens/AccountScreen.tsx`, `components/{PreferenceControls,OrderHistory}.tsx`: idioma, moneda, tema y Mis pedidos. RF-8–RF-12.
- `src/features/preferences/store/preferences-slice.ts`: preferencias no sensibles persistidas; integra i18n/tema/moneda ya existentes.
- Recursos `es`/`en`: auditoría completa de claves visibles/accesibles. RF-7, RF-8.
- `docs/evidence/day-6-accessibility.md`: contraste, texto, targets, TalkBack/VoiceOver y foco. RF-13–RF-15.
- `docs/evidence/day-6-performance.md`: baseline y comparación Home/listado/carrito. RF-16.
- `docs/interview/live-coding.md`: brief exacto de 45 min y rúbrica. RF-18, RF-19.
- `docs/interview/question-bank.md`: exactamente 30 preguntas, respuesta modelo y conexión individual banca/Clean Architecture. RF-20.
- `LEARNING.md`: repaso diario separado del banco final y cierre. RF-1, RF-2, RF-21–RF-23.

## Estrategia de pruebas
- **Jest, lógica pura:** cart reducers/selectors, currency, query normalization/merge, history, address schema e idempotency machine. Tablas de casos, sin snapshots frágiles. RF-3.
- **RNTL, componentes:** assertions por texto/rol/state; loading/error/offline/empty, form errors, lock/unresolved/retry, reduced motion y foco observable. RF-4.
- **RTK Query:** `global.fetch` controlado con colas de respuestas para success/empty/4xx/5xx/timeout/latency; no MSW ni dependencia extra. RF-5.
- **Maestro:** reset determinista, servidor con seed, teclado cerrado explícitamente, identificadores accesibles estables y assertion de una confirmación. RF-6, RNF-1.
- Capacidades nativas físicas del Día 5 conservan evidencia manual Android/iOS; Jest no sustituye cámara/módulo/permiso real.

## Preferencias, Cuenta e i18n
- `preferences-slice` guarda locale (`es|en`), currency (`MXN|USD`) y theme (`system|light|dark`). Adaptadores aplican cambio inmediato sin duplicar fuentes. RF-8–RF-10.
- Mis pedidos lee resúmenes locales confirmados; nunca dirección. Vacío incluye CTA a Inicio. RF-11, RF-12.
- Auditoría compara las claves es/en y recorre pantallas/errores/labels; una ausencia falla el cierre. RF-7.

## Accesibilidad y rendimiento
- Contraste se calcula con una función pura y se registra: 4.5:1 texto normal, 3:1 texto grande/UI. RF-13.
- Matriz TalkBack/VoiceOver: orden, nombre/rol/estado, errores, modal, bottom sheet, retorno de foco y flujo crítico. Cada evidencia incluye plataforma/condición/pasos/resultado. RF-14, RNF-4.
- Texto ampliado, targets y reduced motion se revisan en ambos SO; las acciones gestuales tienen alternativa. RF-15.
- Profiler: misma seed, dispositivo, interacción y configuración para baseline/after; registrar renders y duración JS/UI. Descartar cambio que empeore otra medida o accesibilidad. RF-16.

## Android, iOS y CNG
- Instalar herramientas compatibles, ejecutar check/Doctor; si solo cambia test JS no recompilar, si la auditoría corrige config/dependencia nativa sí regenerar/recompilar por CNG.
- Maestro se ejecuta al menos en una plataforma disponible y el flujo crítico se confirma manualmente en la otra; accesibilidad exige TalkBack Android y VoiceOver iOS reales/simulados compatibles. RF-6, RF-14, RNF-2.

## Decisiones y alternativas
- **Elegida:** tests por riesgo, no porcentaje. **Trade-off:** cobertura numérica no maximizada. **Descartada:** snapshots masivos y metas arbitrarias.
- **Elegida:** mock de fetch local para RTK Query. **Trade-off:** helper propio pequeño. **Descartada:** añadir MSW fuera del stack aprobado.
- **Elegida:** assertions accesibles en RNTL/Maestro. **Trade-off:** exige labels estables. **Descartada:** seleccionar por estructura interna.
- **Elegida:** historial de pedidos local por instalación. **Trade-off:** no sincroniza. **Descartada:** inventar endpoint/autenticación.
- **Elegida:** comparación de perfil relativa al baseline. **Trade-off:** no fija FPS universal. **Descartada:** umbral artificial no aprobado.

## Live coding y banco final
- Brief de 45 min: consumir endpoint dado, lista paginada, debounce y error/retry; detener cronómetro exactamente al minuto 45. RF-18.
- Rúbrica separa funcionalidad, páginas, búsqueda, error, tipos, estado/efectos, a11y, tests, analogías y tiempo; registra incompleto sin extensión. RF-19.
- Banco: 30 preguntas exactas en los temas aprobados; cada entrada contiene respuesta modelo y frase de conexión con banca o Clean Architecture. RF-20.
- Repaso diario de 8–10 preguntas es otro bloque y no reutiliza el conteo del banco. RF-22.

## Verificación
- `npx expo lint`, `npx tsc --noEmit`, Jest/RNTL sin internet, Maestro, Android/iOS, traducciones, contraste, TalkBack/VoiceOver y Profiler.
- Matriz offline checkout confirma que unresolved nunca se presenta como confirmado ni habilita otra orden.
- Evidencias y tests son deterministas desde estado limpio y no contienen PII/secretos. RNF-1–RNF-4.

## Bloque pedagógico
- Teoría ≤10 min antes de cada bloque: pirámide/riesgo, mocks, accesibilidad, i18n y profiling. RF-1.
- Analogías: Jest ↔ JUnit/XCTest; RNTL ↔ Compose UI/XCUITest semantics; Maestro ↔ E2E black-box; i18n/formatter ↔ Android resources/Locale y String Catalog/FormatStyle.
- `LEARNING.md` registra decisiones, trade-offs, ejercicio adicional, 8–10 respuestas y checklist; cierre exige validación dual y commit final. RF-2, RF-21–RF-23.
