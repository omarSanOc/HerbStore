# Plan 007 — Integración con API persistente

Estado del plan: aprobado.

## Precondiciones y límite del incremento
- Parte de `spec.md` en `Estado: aprobada`, de las specs 001–006 implementadas y del comportamiento actual sobre RTK Query, carrito persistido e idempotencia. No reabre ni reescribe esos incrementos históricos.
- La API objetivo se identifica con `http://localhost:3001/openapi.json` (OpenAPI 3.1, `HerbStore API` 0.1.0), pero su OpenAPI no describe hoy todos los query params ni los cuerpos de órdenes/errores. Los parsers runtime y RF-8–RF-20 siguen siendo el borde de confianza; no se introduce codegen como fuente contractual única.
- No se añaden dependencias. La verificación viva se implementa con Node y `fetch` disponibles; los tests conservan `node:test`, Jest y RNTL 14.1.0. No se añade MSW ni un cliente HTTP paralelo.
- No se prevén cambios en dependencias nativas, `app.json`, config plugins, `ios/` ni `android/`; por tanto no se recompila el Development Build. Si durante la implementación aparece una necesidad nativa o de app config, se para y se solicita aprobación antes de ampliar el alcance.
- La API no ofrece reset de stock u órdenes. La suite normal nunca la necesita; el smoke vivo no muta; solo Maestro crea una orden bajo la precondición de exclusividad.
- Diez tareas de 20–30 minutos, en dependencia estricta. Cada tarea empieza por sus pruebas o comprobaciones fallidas y se cierra completa antes de iniciar la siguiente. T10 combina la implementación acotada del scanner QR con la validación manual posterior; no se marca si falta una plataforma.
- `MEMORY.md` no se modifica al crear ni ejecutar este plan salvo encargo posterior del coordinador para registrar un hito SDD o una tarea ya validada.

## Punto de partida comprobado
- `src/core/network/http.ts` valida JSON pero no observa `Content-Language`; `fetch-json-base-query.ts` admite headers por endpoint.
- Home conserva `EXPO_PUBLIC_HOME_FIXTURE`, `home-fixtures*` y `/home?fail=true`; la app todavía sustituye copy de banners, categorías, secciones y subcategorías mediante ids conocidos.
- Las queries localizadas no incluyen idioma en su argumento: Home/categorías/marcas son `void`, detalle/barcode usan solo id/código y producto no incluye idioma en `ProductQueryArgs`.
- Home y listas ya distinguen loading/empty/offline/error/stale; detalle ya usa `currentData` y aviso stale. El panel de facets no diferencia offline/error/stale ni muestra «sin marcas»; Order Status conserva `unresolved`, pero no distingue visualmente offline de error.
- Los parsers actuales ya proyectan Home, productos, categorías, marcas, detalle y órdenes, y rechazan cuerpos incompatibles. Los pares 400/409/404/410 de checkout ya están tipados.
- El scanner actual recibe callbacks de cámara como texto, configura únicamente la simbología EAN-13 y valida el texto bruto con checksum antes de consultar; QR todavía no está habilitado y la integración QR no se considera realizada.
- `src/test/mock-fetch.ts` no modela headers de respuesta. `product-query.test.ts` importa de forma opcional implementación de `mock-server`; los fixtures controlados de `src/test/` y `src/features/home/testing/` sí son exclusivos de tests y deben permanecer.
- CI, Dependabot, AGENTS, README, Maestro y MEMORY contienen instrucciones activas del mock. Los documentos históricos y evidencias también lo mencionan, pero deben conservarse.
- Maestro exige stock fijo 99, reinicia el mock y usa `ORDER_POST_DELAY_MS=1500`; esto es incompatible con una API persistente sin reset.

## Archivos y responsabilidades

### Red, idioma y caché
| Archivo | Cambio y responsabilidad | Cobertura |
|---|---|---|
| `src/core/network/http.ts` + `http.test.ts` | Añadir una opción localizada opt-in: enviar `Accept-Language: es|en` y, solo en respuestas 2xx localizadas, exigir `Content-Language` exacto y coincidente antes de aceptar el JSON. Ausente, inválido o distinto produce `invalid`. Health, imágenes y órdenes no activan esta validación. | RF-22, RF-23, RF-27, RNF-3, RNF-7 |
| `src/core/api/fetch-json-base-query.ts` + test | Transportar el idioma esperado desde el argumento del endpoint a `fetchJson`, sin leer un singleton global; mantener logs sin query, headers, body ni clave completa. | RF-22, RF-23, RF-34, RF-38 |
| `src/core/i18n/languages.ts` + test; nuevo `src/core/i18n/use-current-language.ts` | Resolver estrictamente el idioma efectivo soportado para hooks. El helper no guarda otra fuente de verdad: observa i18n y produce solo `es|en`. Para código no React, la preferencia persistida o el idioma inicial del dispositivo resuelven el mismo valor. | RF-22–RF-24, RNF-3 |
| `src/test/mock-fetch.ts` + test | Permitir headers de respuesta y añadir un builder localizado explícito. No asignar `Content-Language` por defecto: los casos de header ausente deben poder fallar. | RF-22, RF-23, RF-41 |
| `src/core/api/base-api.ts` + `base-api.test.tsx` | Conservar frescura, retry y deduplicación; ampliar pruebas de una petición por identidad y dos cachés distintas para `es` y `en`. No persistir la caché. | RF-24, RF-26, RF-27, RNF-5 |

### Endpoints y contratos por feature
| Archivo | Cambio y responsabilidad | Cobertura |
|---|---|---|
| `src/features/home/data/home-api.ts`, `home-request.ts`, tests | `getHome(language)` pasa idioma como identidad; request fijo `/home`, parser runtime existente y validación estricta de idioma. Eliminar toda rama de fixture y `?fail=true`. | RF-1, RF-8, RF-21–RF-24, RF-28 |
| `src/features/home/hooks/use-home.ts` + tests de Home | Usar `currentData` de la query actual; al cambiar idioma, nunca dibujar el payload anterior bajo el idioma nuevo. Mantener loading/empty/offline/error/stale y reintentos. | RF-24, RF-26–RF-28 |
| `src/features/product/logic/product-query.ts`, `list-params.ts`, tests | Hacer `language` obligatorio en `ProductQueryArgs`, pero no serializarlo como query param. Mantener filtros, CSV, sort, page/limit y normalización actuales. | RF-10–RF-12, RF-22, RF-24–RF-26 |
| `src/features/product/data/products-api.ts` + tests | Argumentos localizados: lista incluye idioma; detalle `{ id, language }`; barcode `{ code, language }`; categorías y marcas reciben idioma. Todos envían/validan idioma, mantienen parsers y tags; órdenes quedan no localizadas. | RF-9–RF-14, RF-21–RF-27 |
| `src/features/product/list/use-product-list.ts`, `ProductListView.tsx` | Construir la identidad con idioma y seguir usando `currentData`; cambio de idioma inicia/lee la entrada correcta y una respuesta `es` tardía no sustituye `en`. | RF-24–RF-29, RNF-5 |
| `src/features/product/screens/ProductDetailScreen.tsx`, `src/features/scanner/screens/ScannerScreen.tsx`, `src/features/scanner/hooks/use-scanner-controller.ts`, `src/features/scanner/logic/*` + tests | Pasar idioma en detalle/barcode y reintentos; conservar validación local de id/EAN-13, 404 de dominio, 422/error seguro, stale y cancelación. Ampliar el lector para EAN-13 y QR, normalizar el payload QR con trim externo, validar localmente el EAN-13 y reutilizar exclusivamente `GET /products/barcode/{ean13}`; rechazar localmente URLs, ids, deep links y payloads arbitrarios. | RF-14, RF-22–RF-24, RF-31, RF-34, RF-40, RF-50–RF-53, RNF-10–RNF-11 |
| `src/features/checkout/store/checkout-thunks.ts` + tests | En refresh de stock posterior a `OUT_OF_STOCK`, consultar detalle con el idioma efectivo sin alterar máquina, carrito ni request personal. Un producto 404 conserva snapshot local y deja el error contractual visible. | RF-4, RF-20, RF-33, RF-37–RF-40 |
| `src/features/checkout/data/orders-api.ts`, `contracts/*`, `logic/order-outcome.ts` + tests | Mantener órdenes sin `Accept-Language`; reforzar 200/202, 400/409, 404/410, 422 e incoherencias con el contrato de la spec y sin eco/log de entradas. | RF-16–RF-20, RF-33, RF-34, RF-36–RF-38 |

### Copy remoto, estados y accesibilidad
| Archivo | Cambio y responsabilidad | Cobertura |
|---|---|---|
| `src/features/home/components/BannerCarousel.tsx`, `CategoryRow.tsx`, `ProductSection.tsx` + tests | Mostrar directamente título/subtítulo/nombre/título de sección de la respuesta localizada. i18n conserva solo chrome, acciones, estados y fallback. | RF-8, RF-22–RF-24, RNF-3, RNF-4 |
| `src/features/home/logic/banner-copy.ts` + test | Eliminar: duplicaba copy del catálogo. | RF-1, RF-5, RF-22 |
| `src/features/categories/category-labels.ts` + test, `CategoryProductsScreen.tsx` | Retirar tablas de nombres de categorías/subcategorías; conservar únicamente la función segura de inicial de fallback. El título usa el árbol remoto localizado y un chrome genérico mientras no hay nombre. | RF-9, RF-22–RF-24, RF-35 |
| `src/features/product/list/AdvancedFiltersSheet.tsx`; nuevo `logic/facet-query-state.ts` + tests RNTL/Node | Clasificar marcas/categorías con loading, sin opciones, offline, error y stale/update-failed; mostrar retry accesible y nombres de subcategorías de API sin traducción duplicada. | RF-9, RF-23, RF-27, RF-30, RF-34, RNF-4 |
| `src/design-system/components/RemoteImage.tsx` + test; tarjetas/galería/Home tests | Verificar placeholder durante carga y fallback localizado o inicial/nombre accesible ante path vacío/error, sin acción fantasma y sin perder nombre, precio o destino. `expo-image` sigue validando bytes/MIME al cargar. | RF-15, RF-32, RF-35, RNF-4 |
| `src/features/checkout/logic/order-status-view-state.ts` (nuevo) + test; `OrderStatusScreen.tsx` + RNTL | Mantener `unresolved` persistido, pero presentar de forma efímera loading/pending/offline/error tras cada consulta; 422/incompatible nunca libera ni confirma. | RF-20, RF-33, RF-34, RF-37, RNF-4, RNF-7 |
| `src/core/i18n/resources/{es,en}.ts`, `parity.test.ts`, `source-audit.test.ts` | Retirar copy duplicado de banners/categorías/secciones/subcategorías y añadir solo chrome/estados nuevos en ambos idiomas. | RF-22–RF-24, RF-28–RF-35, RNF-3, RNF-4 |

### Tests aislados, smoke vivo y artefactos
| Archivo | Cambio y responsabilidad | Cobertura |
|---|---|---|
| `src/test/fixtures.ts`, `src/features/home/testing/home-test-data.ts` | Conservar datos sintéticos exclusivamente de tests, con variantes `es/en` distinguibles y headers explícitos. Nunca importados por producto. | RF-17, RF-18, RF-41, RNF-2 |
| `src/features/product/logic/product-query.test.ts` y cualquier test que referencie `mock-server` | Sustituir imports dinámicos/paridad con backend por tablas locales del contrato. La compatibilidad real pasa al smoke opt-in. | RF-11, RF-12, RF-41 |
| `src/test/production-bundle-audit.test.ts` | Dejar de auditar excepciones `__DEV__` de fixtures que ya no existirán; prohibir desde fuentes de producto imports de `test/testing`, la variable de fixture y activadores/backend de runtime. | RF-5, RF-17, RF-49 |
| Nuevo `scripts/verify-live-api.ts`; `package.json` | Comando opt-in, sin dependencias y no mutante. Requiere origen explícito; verifica OpenAPI/health, es/en y `Content-Language`, Home, facets, filtros/sorts/paginación, detalle, barcode, imagen y errores GET, incluido order status con una key nueva que debe quedar `not_created`. Nunca hace `POST /orders`. | RF-7–RF-23, RF-27, RF-34, RF-40–RF-42 |
| Exportaciones temporales de producción iOS/Android | Buscar ausencia de fixtures, `EXPO_PUBLIC_HOME_FIXTURE`, `ORDER_POST_DELAY_MS`, rutas de test y backend runtime. No se versionan. | RF-17, RF-49 |

### Maestro, backend y documentación activa
| Archivo | Cambio y responsabilidad | Cobertura |
|---|---|---|
| `.maestro/checkout.yaml`, flujo de preparación y `scripts/read-stock.js` | Quitar stock fijo/reset/latencia artificial. Preflight: health, producto parametrizado, stock >0 y declaración de exclusividad; capturar initial, limpiar solo estado local, doble toque, confirmar una vez, una fila local, final = initial−1. Abortos previos o concurrencia declarada se rotulan `INCONCLUSA`. | RF-36, RF-37, RF-43–RF-48 |
| `.maestro/cart-swipe-delete.yaml`, `product-404.yaml`, `deep-link-a-b.yaml`, `.maestro/README.md` | Sustituir referencias/nombres del mock por API persistente, mantener extras no mutantes y parametrizar productos. | RF-40, RF-47, RF-48 |
| `mock-server/` | Eliminar completamente después de desacoplar tests y Maestro. | RF-1, RF-5 |
| `.github/workflows/ci.yml`, `.github/dependabot.yml` | Quitar lockfile, instalación, tests y actualizaciones del backend eliminado. CI queda con app offline: lint, tipos y `npm test`; no llama a API viva. | RF-5, RF-41 |
| `AGENTS.md` | Sustituir obligación/comando del mock por API persistente configurable; dejar claros origen, suite aislada, smoke opt-in y E2E sin reset. | RF-5, RF-6 |
| `README.md`, `.env.example`, `.maestro/README.md` | Documentar arranque sin backend incluido; iOS Simulator localhost, Samsung USB con reverse 3001/8081, Android Emulator 10.0.2.2 no bloqueante e iPhone LAN no bloqueante; API persistente y sin reset. | RF-5, RF-42–RF-48 |
| `LEARNING.md` | Añadir una nota de transición de la spec 007; no editar narración, cifras ni evidencia histórica de los Días 1–6. | RF-6 |
| `eas.json` | **Sin cambio:** conserva `https://api.example.test` porque no existe backend desplegado aprobado. README aclara que EAS solo demuestra compilación y esos builds no cargan catálogo hasta proporcionar un origen real alcanzable. | RF-6, fuera de alcance de despliegue |
| Nuevo `docs/evidence/spec-007-api-persistente.md` | Matriz reproducible de smoke, artefactos, tráfico/caché, Samsung e iOS; incluye casos QR y la limitación de cámara del simulador cuando aplique; nunca seriales, keys completas ni PII. | RF-42–RF-53, RNF-5, RNF-8–RNF-11 |

## Flujo de datos y contratos
1. `PublicConfigGate` valida el origen antes de montar navegación y consumidores. Missing/invalid muestra el alert bilingüe y no monta queries; no se inventa un host por plataforma dentro de la app.
2. Cada consumidor obtiene un `SupportedLanguage` efectivo. Ese idioma forma parte del argumento de cada query localizada y, por tanto, de la identidad RTK Query.
3. El endpoint construye path, parser y `language`. El base query añade `Accept-Language`; `fetchJson` exige `Content-Language` solo si la request fue marcada localizada.
4. Una respuesta 2xx pasa primero coherencia de idioma y después el parser estructural de Home/producto/facets. Cualquiera de los dos fallos produce `invalid`; no se proyectan datos parciales.
5. RTK Query guarda respuestas por endpoint+argumento: `getHome('es')` y `getHome('en')`, o `{ id, language }`, son entradas distintas. La UI lee `currentData`; una respuesta tardía escribe únicamente su entrada anterior.
6. Filtros, orden y paginación siguen siendo remotos. El cliente solo normaliza argumentos, aplana páginas ya recibidas y deduplica ids; no filtra ni ordena los 300 productos en JS.
7. Órdenes no son contenido localizado: no envían ni exigen `Content-Language`. Conservan parsers de status/código, key criptográfica por intento y estado local `preliminary/unresolved`.
8. Carrito, preferencias, historial de búsqueda y `orderHistory` no se copian a la API. El carrito conserva snapshots aunque el producto desaparezca; la API decide el POST y la app muestra 400/409 de forma segura.
9. El scanner conserva el camino EAN-13 directo. Para QR, la lectura se trata como entrada no confiable: se recorta el texto externo, se valida localmente el EAN-13 resultante y solo entonces se consulta `GET /products/barcode/{ean13}`; URLs, ids, deep links y payloads arbitrarios terminan localmente sin request. La deduplicación y los estados existentes rodean ambos caminos.

### Contrato comprobable pese al OpenAPI parcial
- **OpenAPI:** el smoke confirma título/versión y presencia de las diez operaciones en nueve rutas. Sirve para detectar que la API objetivo es la correcta, no para generar o reemplazar parsers.
- **Runtime:** `parseHomePayload`, `parseProductPage`, `parseCategoryTree`, `parseBrandOptions`, `parseProductDetail`, `parseOrderResult` y `parseOrderError` siguen validando las formas RF-8–RF-20.
- **Compatibilidad viva:** el script prueba también query params, OR/AND de facets, sorts, paginación, headers de idioma, MIME de imágenes y errores que OpenAPI omite. Si OpenAPI y comportamiento difieren, manda la spec aprobada; no se relaja el parser para “hacerlo pasar”.
- **Órdenes:** la prueba viva ordinaria solo consulta una key nueva y verifica 404 coherente, sin crear intento. Los cuerpos 200/202/400/409/410 se cubren de forma aislada; la única mutación real es el E2E exclusivo.

## Estrategia de idioma y transición de caché

### Pseudocódigo de solicitud localizada
```text
type LocalizedArg<T> = T + { language: 'es' | 'en' }

query(arg):
  return {
    path: buildPath(arg without language),
    language: arg.language,
    parse: runtimeParser
  }

fetchJson(request):
  headers.Accept-Language = request.language         // solo si está presente
  response = fetch(...)
  if response is 2xx and request.language exists:
    received = response.headers['Content-Language']
    if received not exactly es|en or received != request.language:
      return invalid
  return parseJsonAndValidate(response)
```

### Pseudocódigo al cambiar idioma
```text
visible query = getHome({ language: 'es' })
cache['es'] = SpanishData

user selects 'en'
i18n changes -> hook argument becomes { language: 'en' }
currentData('en') is undefined -> loading (never SpanishData under English chrome)
request sends Accept-Language: en

if an old es response arrives:
  validate Content-Language: es
  write only cache['es']; current screen still reads cache['en']

if en response says Content-Language: en:
  cache['en'] = EnglishData -> render
else:
  invalid -> error; do not borrow cache['es']
```

### Elección y alternativa descartada
- **Elegida:** idioma en los argumentos + `currentData` + header/validación opt-in. Trade-off: cambian firmas y tests de todos los endpoints localizados; a cambio, identidad, deduplicación y carrera quedan explícitas y medibles.
- **Descartada:** leer `i18n.language` mutable dentro del base query y resetear toda la caché al cambiar idioma. Esa opción deja la key sin idioma, puede aceptar una respuesta iniciada en el idioma anterior, borra caché útil y obliga a invalidar dominios no localizados como órdenes.

## Copy de catálogo
- La API es propietaria de nombres/títulos/descripciones de banners, categorías, secciones, subcategorías, productos, porciones y cupones. La app no los reemplaza por ids conocidos.
- i18n sigue siendo propietaria del chrome: tabs, botones, hints, loading/error/offline/empty/stale, unidades, formato, acciones del carrusel, filtros y fallbacks.
- Se eliminan `banner-copy` y las tablas estáticas de categoría/subcategoría, junto con sus claves de recursos sin uso. `categoryInitial` permanece como transformación segura del nombre remoto para el fallback visual.
- No se introduce un fallback inglés “conocido” para copy remoto. Si el contrato localizado es inválido, aparece error/stale; si una imagen falla, el texto/nombre remoto válido permanece utilizable.

## Matriz de estados y presentación
| Dominio | Primera carga / vacío | Transporte | HTTP/invalid | Con datos previos |
|---|---|---|---|---|
| Home | skeleton; las tres colecciones vacías → empty | sin respuesta → offline | 4xx/5xx/idioma/cuerpo incompatible → error tras política de retry | conserva Home + aviso offline/update-failed |
| Productos | skeleton; página inicial total 0 → empty | offline | 4xx incluido 422, 5xx o invalid → error | lista + aviso; next-page usa footer propio |
| Categorías/marcas | loading en panel; array vacío → «sin opciones» | offline + retry | error + retry | conserva opciones + aviso de actualización fallida |
| Detalle/barcode/scanner | loading; no existe empty; QR rechazado localmente | offline | 404 → not-found; otro 4xx/5xx/invalid → error; QR inválido no genera request | detalle + aviso; 404 nuevo gana a caché; QR válido conserva el flujo EAN-13 |
| Imágenes | frame reservado; no hay empty de colección | fallback | fallback ante 4xx/5xx/bytes inválidos/path inseguro | imagen cacheada puede seguir; si no, fallback sin acción |
| Order status | loading/pending; no hay empty | offline, conserva unresolved | error seguro ante 5xx/422/inconsistente; pares válidos siguen spec 004 | no usa stale remoto: conserva metadatos locales y bloqueo |

- RNTL 14 usa siempre `await render`, `await fireEvent`/`userEvent`, queries por rol/nombre y matchers accesibles; no snapshots ni detalles de implementación.
- Los mensajes nuevos son alert/live region cuando cambian; targets mantienen 48 dp Android/44 pt iOS, texto ampliado y reduced motion.

## Maestro sin reset y doble toque
1. El flujo exige `E2E_EXCLUSIVE=true` como declaración operativa; sin ella se aborta antes de abrir checkout con marcador `INCONCLUSA`.
2. El preflight del host hace `GET /health`, consulta `PRODUCT_ID`, verifica que coincide con el producto parametrizado y captura `stock.initial > 0`. No compara con 99 ni reinicia nada.
3. `clearState` limpia solo la instalación para obtener carrito e historial de pedidos locales vacíos; no toca la API.
4. El flujo busca/agrega una unidad, completa dirección ficticia y pulsa dos veces con 50 ms. Ya no depende de `ORDER_POST_DELAY_MS`, que desaparece.
5. Maestro observa una sola confirmación y, en Mis pedidos, exactamente una fila local. El script obtiene `stock.final` y exige `initial - 1`.
6. Si antes del POST no hay stock/exclusividad, aborta `INCONCLUSA` sin mutar. Si se sabe que otro cliente actuó durante la prueba, el delta no se usa y se registra `INCONCLUSA`. Con exclusividad sostenida, un delta distinto o más de una fila es fallo real.
7. La carrera rápida del doble toque queda determinista en Jest/RNTL con fetch demorado y aserción de un solo POST/key; Maestro cubre únicamente el resultado observable de la API real.

## Accesibilidad, i18n, seguridad y rendimiento
- **Accesibilidad:** estados del panel, detail, imagen, scanner y orden tienen nombre/rol/alert y reintento; fallback de imagen no crea botón; un QR inválido conserva el estado localizado y accesible de código inválido con acción para escanear de nuevo; copy remoto se incluye en labels sin duplicarlo; escala y movimiento reducido conservan comportamiento previo.
- **i18n:** paridad de chrome es/en; copy de API no entra en recursos. `Content-Language` faltante/mismatch se trata como `invalid`, nunca como inglés por defecto.
- **Privacidad:** logs conservan método/path redactado/resultado; no query, body, headers, dirección, valor rechazado ni key completa. El texto bruto de QR, URLs, ids, deep links, payloads arbitrarios y códigos rechazados no se persisten ni registran. El smoke usa datos de catálogo y una key aleatoria solo para GET status, sin imprimirla.
- **Rendimiento bloqueante:** (a) test de una solicitud en vuelo por consulta equivalente, (b) entradas de caché separadas por idioma, (c) filtros/sort/paginación remotos y ninguna transformación nueva de los 300 productos en una interacción. Se registra tráfico/conducta; no se repite Profiler del Día 6 y no se añade memoización sin medición.
- **Persistencia:** `api` sigue fuera de redux-persist. Carrito, búsqueda, preferencias, intento y pedidos locales conservan política y saneado actuales.

## Android, iOS y CNG
- **Bloqueante Android:** Samsung físico por USB; `adb reverse tcp:3001 tcp:3001` y `adb reverse tcp:8081 tcp:8081`; origen de la app `http://localhost:3001`; se exige prueba de cámara para los casos QR de RF-48.
- **Bloqueante iOS:** iOS Simulator; origen `http://localhost:3001`; si no ofrece una cámara utilizable, se documenta la limitación y se valida el contrato QR mediante pruebas aplicables sin declarar superada la comprobación manual de cámara.
- **No bloqueante:** Android Emulator documentado con `http://10.0.2.2:3001`. iPhone físico queda fuera y necesita un origen LAN alcanzable.
- Samsung valida RF-48 completa, incluidos EAN-13 directo, QR válido existente, QR válido inexistente, QR inválido y payloads no interpretables sin request. iOS Simulator valida la parte aplicable, registra la limitación de cámara cuando corresponda, y ambos destinos cubren gate missing/invalid, dominios remotos, es/en, 404/barcode/imagen, offline/stale/recovery, checkout/status, accesibilidad y E2E o clasificación inconclusa.
- No cambia CNG, dependencias ni app config; Fast Refresh/Metro basta. Solo si ese supuesto deja de cumplirse se ejecutan `npx expo install --check`, Doctor y recompilación dual.

## Estrategia de pruebas por RF
| Capa | Alcance | RF |
|---|---|---|
| `node:test` | header/Content-Language; parsers; query params; idioma en identidad; facets; ids/EAN; normalización QR (trim externo, checksum, caracteres, URLs/ids/deep links); órdenes y pares incoherentes; carrito/historial ante producto desaparecido | RF-7–RF-27, RF-34, RF-36–RF-41, RF-50–RF-53, RNF-10 |
| Jest + RNTL | cambio es→en con respuesta tardía; deduplicación; matriz Home/lista/facets/detail/barcode/order status; gate sin requests; fallback imagen; doble toque con un POST; callbacks de EAN-13/QR, cero requests para payloads rechazados, 404 y producto existente, estados y acción accesible de nuevo escaneo | RF-2, RF-22–RF-41, RF-50–RF-53, RNF-3–RNF-5, RNF-10–RNF-11 |
| Auditoría de fuentes/export | ausencia de imports de tests, fixtures runtime, backend y activadores en producto Android/iOS | RF-5, RF-17, RF-49 |
| Smoke opt-in | OpenAPI+health, lecturas es/en, filtros/sorts/páginas, imagen y errores GET; cero POST | RF-7–RF-23, RF-27, RF-34, RF-40–RF-42 |
| Maestro | una compra exclusiva, doble toque observable, una fila local y stock−1; sin reset | RF-36, RF-37, RF-43, RF-44, RF-48 |
| Maestro / manual dual | Maestro conserva la compra sin reset; Samsung físico prueba EAN-13 directo, QR existente, QR inexistente, QR inválido y doble lectura; iOS Simulator cubre lo aplicable y documenta la limitación de cámara si existe; conectividad, gate, estados/stale, copy remoto, accesibilidad, tráfico/cache y app instalada sin activadores | RF-45–RF-49, RF-50–RF-53, RNF-4, RNF-5, RNF-8–RNF-11 |

### Comandos exactos
Durante cada tarea se ejecutan sus tests dirigidos y, antes de cerrarla, lint/tipos más el runner afectado. Cierre automático global:
```bash
npx expo lint
npx tsc --noEmit
npm test
git diff --check
```

Smoke vivo, siempre explícito y fuera de `npm test`:
```bash
HERBSTORE_LIVE_API_ORIGIN=http://localhost:3001 npm run verify:live-api
```

Auditoría de exportaciones de producción, sin cambiar app config:
```bash
EXPO_PUBLIC_API_ORIGIN=https://api.example.test npx expo export --platform android --no-minify --output-dir /private/var/folders/l9/wp_bjx010qq48h_88wvmq4dm0000gn/T/opencode/herbstore-spec-007-android
EXPO_PUBLIC_API_ORIGIN=https://api.example.test npx expo export --platform ios --no-minify --output-dir /private/var/folders/l9/wp_bjx010qq48h_88wvmq4dm0000gn/T/opencode/herbstore-spec-007-ios
! grep -R -E "EXPO_PUBLIC_HOME_FIXTURE|home-fixture-env|home-fixtures|ORDER_POST_DELAY_MS|mock-server" /private/var/folders/l9/wp_bjx010qq48h_88wvmq4dm0000gn/T/opencode/herbstore-spec-007-android
! grep -R -E "EXPO_PUBLIC_HOME_FIXTURE|home-fixture-env|home-fixtures|ORDER_POST_DELAY_MS|mock-server" /private/var/folders/l9/wp_bjx010qq48h_88wvmq4dm0000gn/T/opencode/herbstore-spec-007-ios
```

Dispositivos bloqueantes:
```bash
adb reverse tcp:3001 tcp:3001
adb reverse tcp:8081 tcp:8081
EXPO_PUBLIC_API_ORIGIN=http://localhost:3001 npx expo start --dev-client -c
maestro --device <android-serial> test -e API_ORIGIN=http://localhost:3001 -e METRO_URL=http://localhost:8081 -e PRODUCT_ID=<product-id> -e PRODUCT_QUERY="<query>" -e E2E_EXCLUSIVE=true .maestro/checkout.yaml
maestro --device <ios-simulator-udid> test -e API_ORIGIN=http://localhost:3001 -e METRO_URL=http://localhost:8081 -e PRODUCT_ID=<product-id> -e PRODUCT_QUERY="<query>" -e E2E_EXCLUSIVE=true .maestro/checkout.yaml
```

`npx expo install --check` y `npx expo-doctor@latest` se añaden únicamente si cambia una dependencia o configuración Expo; `npx expo run:*` únicamente si además cambia huella nativa/app config.

## Decisiones y alternativas descartadas
- **Validación runtime conservada, sin codegen OpenAPI.** Trade-off: parsers manuales. Descartado codegen como oráculo: faltan params y schemas terminales.
- **Idioma en cada identidad localizada.** Trade-off: firmas más verbosas. Descartado singleton mutable + reset global por carreras y pérdida de caché útil.
- **Validación `Content-Language` central y opt-in.** Trade-off: la capa HTTP conoce este metadato. Descartado duplicarla en seis parsers o aplicarla a health/images/orders, donde no corresponde.
- **API propietaria del copy de catálogo.** Trade-off: una API con idioma roto produce error en vez de fallback traducido local. Descartadas tablas por ids, que mezclan versiones y ocultan el contrato.
- **Tests locales + smoke separado.** Trade-off: dos niveles que mantener. Descartado usar API viva en `npm test`, que haría CI dependiente de red/stock.
- **Smoke vivo no mutante.** Trade-off: 200/202/409 reales de orden no se prueban allí. Descartado crear órdenes desde smoke; esa mutación pertenece al E2E exclusivo.
- **E2E con estado observado y exclusividad.** Trade-off: puede quedar inconcluso. Descartado reset/stock fijo, no soportado por la API.
- **Doble toque determinista en RNTL y observable en Maestro.** Trade-off: Maestro no controla latencia. Descartado conservar `ORDER_POST_DELAY_MS`, propio del backend eliminado.
- **QR como envoltorio estrictamente permitido de EAN-13.** Trade-off: no se admiten usos generales del lector QR, pero se conserva el contrato existente, la validación local y la privacidad. Descartados URLs, ids, deep links y payloads arbitrarios para evitar navegación o interpretación fuera del alcance y mantener cero requests para entradas inválidas.
- **API sin cambios y reutilización de `/products/barcode/{ean13}`.** Trade-off: QR solo aporta otra simbología de entrada; no requiere endpoint, esquema ni smoke vivo nuevos. Descartado crear una ruta QR o enviar el payload original.
- **Eliminar backend/fixtures runtime y preservar históricos.** Trade-off: se pierden simuladores manuales de fallo; los cubren dobles de test. Descartado reescribir specs/evidencia o conservar un backend ejecutable “por si acaso”.
- **EAS placeholder sin cambio.** Trade-off: los builds remotos no cargan catálogo. Descartado apuntarlos a localhost o inventar despliegue.
- **Rendimiento por tráfico/caché/borde de trabajo.** Trade-off: no hay nuevas cifras de Profiler. Descartado repetir la auditoría completa del Día 6, expresamente fuera de alcance.

## Conceptos RN y equivalentes nativos
- **Argumento de query como identidad de caché:** RTK Query ↔ key de Repository/Paging `Flow` con `flatMapLatest(locale)` en Kotlin/Compose ↔ `.task(id: locale)` y caché de requests por key en SwiftUI.
- **`currentData` frente a datos previos:** evita pintar otra key durante transición ↔ `StateFlow` del `flatMapLatest` actual ↔ estado asociado al id de `Task`, no al último resultado global.
- **Header y validación de respuesta:** request interceptor/serializer de OkHttp + Kotlin Serialization ↔ `URLRequest`/`HTTPURLResponse` + `Decodable` en Swift.
- **Estado remoto frente a local:** RTK Query y redux-persist ↔ Repository/Paging frente a DataStore/ViewModel ↔ URLSession/cache frente a `@AppStorage`/modelo observable.
- **Dobles de red:** `mock-fetch` ↔ MockWebServer en Android ↔ `URLProtocol` stub en iOS; Maestro ↔ caja negra UI Automator/XCUITest.
- **Fallback de imagen:** `expo-image` y semántica RN ↔ Coil `AsyncImage` con `contentDescription` ↔ `AsyncImage` con accessibility label.
- **Callback de cámara y transformación pura de entrada:** CameraView entrega simbología/payload y una función pura decide EAN-13 directo, QR normalizado o rechazo ↔ analyzer de CameraX + `sealed class`/validator en Kotlin/Compose ↔ delegado de `AVCaptureMetadataOutput` + enum/validator en Swift/SwiftUI.

## Riesgos y bloqueos
- La API puede no estar ejecutándose durante la implementación: no bloquea T1–T5 ni `npm test`, pero T6 y T10 quedan pendientes.
- Una regresión o ausencia de `Content-Language` bloqueará todas las lecturas localizadas por diseño; no se añadirá fallback silencioso.
- El catálogo persistente puede agotar el producto configurado. Maestro debe recibir otro `PRODUCT_ID/PRODUCT_QUERY`; nunca se restaura stock.
- La exclusividad es una precondición humana, no demostrable por la app. Sin declaración o con interferencia, el E2E es inconcluso y no evidencia RF-43.
- El Samsung es el único destino obligatorio para comprobar físicamente QR; iOS Simulator puede no ofrecer cámara. Una limitación de cámara en iOS debe quedar registrada, no convertirse en una aprobación implícita.
- La API persistente puede no contener un EAN-13 de prueba o puede devolver 404; T10 debe seleccionar un valor existente y otro localmente válido inexistente sin mutar ni restaurar el catálogo.
- El callback QR puede entregar lecturas duplicadas o payloads no confiables; los tests deben demostrar el bloqueo síncrono y cero requests antes de la validación remota.
- La eliminación del backend deja referencias históricas válidas. Las búsquedas de cierre deben distinguir documentos activos de specs/evidencia/LEARNING previos.
- El placeholder de EAS no alcanza una API real. Validar carga de catálogo en un build remoto queda bloqueado hasta que exista un backend desplegado, fuera de esta spec.
- El smoke debe tolerar datos variables sin asumir ids, nombres, conteos o stock iniciales; deriva ejemplos de Home/catálogo y no imprime entradas sensibles.

## Preguntas abiertas
- Ninguna.
