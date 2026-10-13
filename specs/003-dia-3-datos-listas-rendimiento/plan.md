# Plan 003 — Día 3: datos, listas y rendimiento

Ajustado al código real tras el Día 2 (commit `dd8120c`). La spec (`aprobada`) no cambia. Las cinco decisiones pendientes (P1–P5) ya las resolvió el usuario; están integradas en el plan y resumidas en "Decisiones del usuario (resueltas)". Estado del plan: aprobado y ejecutado (T1–T16).

## Precondiciones y límite del incremento
- Parte de Home, la navegación y los placeholders del Día 2, y del contrato del mock del Día 1. La migración conserva las secciones, los destinos y los estados observables de Home. RF-4.
- Antes de usar una API (RTK Query, FlashList v2, Gorhom, Expo Router), consultar su documentación para la versión instalada y comprobar los tipos en `node_modules`; no fiarse de APIs recordadas (AGENTS.md).
- 16 tareas de 20–30 min (≈6–7 h) en una sola spec y dos sesiones (P5, decisión del usuario). No se recorta ningún RF.
  - **Sesión 1: T1–T7.** Dependencias y recompilación, núcleo de red, Home migrada y endpoints de catálogo. Al terminar T7 la app se comporta como el Día 2, pero sobre RTK Query, y todo está validado en Android e iOS: es el punto de corte natural.
  - **Sesión 2: T8–T16.** Cuadrícula, paginación, filtros, búsqueda, orden, fallback, medición y cierre.
  - El progreso se apunta en `MEMORY.md` al cerrar cada tarea (última tarea validada y la siguiente). Si una sesión termina antes de T7, se para en la última tarea validada y se retoma desde ahí. No hay commit intermedio: el commit del día solo llega en T16 (AGENTS.md).
- Orden: dependencias → núcleo de red → Home → lógica del listado → cuadrícula → filtros → búsqueda → orden e invalidación → fallback → medición → cierre.

## Dependencias nuevas (exactamente 5)
Se instalan juntas con `npx expo install @reduxjs/toolkit react-redux @shopify/flash-list @gorhom/bottom-sheet expo-network` y después se ejecutan `npx expo install --check` y `npx expo-doctor@latest`. Nunca `--force`, `--legacy-peer-deps` ni `npm audit fix --force`.

| Paquete | Versión | Fuente de la versión | Código nativo | Recompilar |
| --- | --- | --- | --- | --- |
| `@shopify/flash-list` | `2.0.2` exacta | `node_modules/expo/bundledNativeModules.json` (SDK 57) | v2: solo New Architecture; se espera que sea solo JS (comprobar) | Cubierto por la recompilación de `expo-network` |
| `@reduxjs/toolkit` | la última que resuelva `expo install` (no está fijada por el SDK); se necesita ≥ 2.6 por `build.infiniteQuery` | npm | No (JS) | No |
| `react-redux` | la última que resuelva `expo install` (se espera 9.x; peer `react` ^18 \|\| ^19, compatible con 19.2.3) | npm | No (JS) | No |
| `@gorhom/bottom-sheet` | la última que resuelva `expo install` (se espera 5.x) | npm | No (JS); usa los nativos que ya existen | No por sí mismo |
| `expo-network` | `~57.0.2` (verificado en `bundledNativeModules.json`, línea `"expo-network": "~57.0.2"`) | SDK 57 | **Sí** (módulo Expo con código Kotlin/Swift) | **Sí, en Android e iOS** |

- **`expo-network` es la 5.ª dependencia y la aprobó el usuario** al resolver P1 (constitución, punto 1: necesidad demostrable = la "reconexión" de RF-5; compatible porque la fija el SDK 57). Antes de usarla, leer la documentación de `expo-network` para SDK 57 y los tipos de `node_modules/expo-network`; no inventar API. Se espera un listener de cambios de estado (`addNetworkStateListener`, que devuelve una suscripción con `remove()`), una lectura inicial (`getNetworkStateAsync`) y un estado con `isConnected`/`isInternetReachable`; si los nombres o la forma difieren, manda la versión instalada. Si la doc exigiera permisos o plugin en `app.json`, se añaden por app config/config plugin (nunca editando `android/` ni `ios/`) y se anotan; si exige algo más que eso, parar y preguntar.
- Peers de Gorhom: Reanimated `4.5.1` (con Worklets `0.10.1`) y Gesture Handler `~2.32.0` ya están instalados y compilados en el Development Build. Tras instalar, leer `peerDependencies` en `node_modules/@gorhom/bottom-sheet/package.json`. Si no admite Reanimated 4, parar y preguntar; no forzar nada.
- Las versiones de RTK, React Redux y Gorhom no se pudieron consultar en el registro durante la planificación (Bash solo lectura). Se anotan en `LEARNING.md` y en `MEMORY.md` en T1, junto con la de `expo-network`.
- **Recompilación obligatoria en T1.** `expo-network` trae código nativo, así que el Development Build se regenera y reinstala en las dos plataformas: `npx expo run:android --device` y `npx expo run:ios --device`. Fast Refresh o reiniciar Metro no bastan (AGENTS.md). La misma recompilación incluye cualquier código nativo que trajeran los otros 4 paquetes (se comprueba igualmente y se anota). T1 termina con una parada de validación del Development Build nuevo en Android e iOS. No se editan `android/` ni `ios/`.
- Fuera de estas 5 no se añade ninguna (constitución, punto 1). Zod y `expo-crypto` llegan en el Día 4 con su plan.

## Punto de partida: qué se conserva, adapta, retira o sustituye
- **Se conserva sin cambios:** `core/network/resolve-api-origin`, `api-origin`, `resolve-asset-url`, `core/format/*`, `core/lifecycle/use-app-active`, `core/accessibility/*`, `design-system/*`, carrusel de Home (`carousel/*`, `BannerCarousel`, `use-banner-row-visibility`), `build-home-rows`, `banner-copy`, `HomeScreen.tsx` (sigue usando `useHome()` con el mismo `HomeViewModel`), `HomeSkeleton`, `HomeStatusRow`, `HomeNoticeRow`, `home-fixtures.ts`, `home-fixture-env.ts` y sus tests, `parse-product-id`, `parse-category-id`, `category-labels`, `product-card-layout`, `CartDevControls` (H-4 se retira en el Día 4) y `linking.ts`.
- **Se amplía:** `core/network/http.ts` (`fetchJson`) acepta `method`, `body` JSON y `headers` (Idempotency-Key) sin cambiar la taxonomía `ok | http | network | invalid | timeout | aborted` ni el timeout de 8 s. Sigue siendo la única primitiva HTTP, así que el seguimiento M-5 del Día 6 (timeout durante la lectura del cuerpo) se aplica tal cual. Sus tests añaden los casos de POST.
- **Se adapta:**
  - `home/logic/classify-home-result.ts`: su entrada pasa de `FetchJsonOutcome` a la instantánea de RTK Query (`{ data, error: ApiError, isFetching }`). Conserva las reglas y los tests del Día 2: colecciones vacías, `empty`, aviso sobre datos previos, `offline` solo con `network` y `error` para 5xx/timeout/inválido.
  - `home/hooks/use-home.ts`: queda como adaptador fino sobre `useGetHomeQuery`, con la misma firma.
  - `home/contracts/home.ts` y `parse-home.ts`: el producto pasa a un contrato compartido (ver abajo).
  - `product/logic/product-card.ts`: importa el tipo compartido en vez de `HomeProduct`.
- **Se retira y se sustituye por RTK Query:**
  - `home/data/home-client.ts` y su test. Lo sustituyen `home-api.ts` y `home-request.ts` (puro); los casos de fixture y `?fail=true` migran a `home-request.test.ts`.
  - `home/logic/home-request-state.ts` y su test: RTK Query asume la identidad de la petición, la deduplicación, el abort y el descarte de respuestas tardías.
  - `home/logic/refetch-policy.ts` y su test: lo sustituye `core/api/freshness.ts` (RF-5).
  - `product/product-client.ts`, su test y `use-product-exists.ts`: los sustituyen `getProduct` y `product/logic/product-lookup.ts` (puro); el parseo y la clasificación 404/offline/error migran a tests nuevos.
- **Se mueve:** `home/components/ProductCard.tsx` pasa a `product/components/ProductCard.tsx` y se comparte entre la fila de Home y la cuadrícula. Sus textos `home.product.*` pasan a `productCard.*` en es/en.
- **Se sustituyen placeholders:** `categories/screens/CategoryPlaceholderScreen.tsx` → `CategoryProductsScreen.tsx`; `search/screens/SearchPlaceholderScreen.tsx` → `SearchScreen.tsx`. `ProductPlaceholderScreen` se queda (el detalle real llega el Día 4), pero consume `getProduct`.
- **Tab Categorías (P4, decisión del usuario: dejar el placeholder).** No se implementa la lista de categorías; la spec 003 no la pide. Su texto visible (`placeholders.categories.body`: "Aquí aparecerá el listado de categorías del catálogo." / "The catalog category list will appear here.") no promete ningún día, así que no se toca. Solo el comentario de código de `CategoriesPlaceholderScreen.tsx` ("Replaced by the real category list on Day 3.") es inexacto; T8 lo corrige sin cambiar comportamiento ni textos (no es texto visible).
- **Política de refetch:** la del Día 2 (pull siempre; primer plano siempre; foco solo tras fallo) queda sustituida por RF-5/RF-6. Datos frescos durante 60 s. Después, la apertura, el foco, la vuelta a primer plano o la reconexión (detectada con `expo-network`, P1) muestran la caché y revalidan una vez en segundo plano. El pull fuerza siempre. Sin respuesta satisfactoria previa no hay revalidación automática por foco, primer plano ni reconexión: queda el reintento manual (RF-8).
- **Estados observables de Home que se mantienen:** `loading` (skeleton estático), `ready` con aviso `offline` o `update-failed` sobre datos previos, `empty`, `offline` y `error`. Offline significa que `fetch` falló sin respuesta: `expo/fetch` lanza `FetchError extends Error`, que `fetchJson` ya clasifica por estructura y no por `instanceof`. Un 5xx, un timeout o un payload inválido son `error`. Las fixtures `EXPO_PUBLIC_HOME_FIXTURE` (solo `__DEV__`) siguen funcionando a través de `home-request.ts`.

## Archivos y responsabilidades
Regla de tests: todo módulo puro termina en `.ts`, usa imports relativos con extensión y no importa RN, `@/` ni valores de RTK (solo `import type`, que se borra con *type stripping*). Lleva `/// <reference types="node" />` en su test. Lo que use `__DEV__` o `Platform` va en un `*-env.ts` aparte.

### Núcleo (`src/core`)
- `network/http.ts` (+test): `fetchJson` con `method`/`body`/`headers`; `Content-Type: application/json` solo si hay body. RF-7, RF-8.
- `api/api-error.ts` (puro): `ApiError = network | http(status) | timeout | invalid | aborted`; `toBaseQueryResult(outcome)`; `isOfflineError`. RF-8, RF-19.
- `api/retry-policy.ts` (+test, puro): `MAX_AUTOMATIC_RETRIES = 2`; `shouldRetryRequest({ error, attempt, method, maxRetries })`. Reintenta solo si el método es `GET` (o no se indica, que equivale a `GET`), el error es `network` o `http` ≥ 500 y `attempt ≤ maxRetries`. Nunca reintenta un método distinto de `GET` (P2: `createOrder` hace 0), ni 4xx, `timeout`, `invalid` o `aborted` (P3). `retryDelayMs(attempt)` determinista y creciente: 500 ms y 1000 ms. RF-8.
- `api/fetch-json-base-query.ts` (+test, puro): `createFetchJsonBaseQuery({ origin, fetchImpl, onSettled })` devuelve el base query de RTK sobre `fetchJson` con `api.signal`. Sus argumentos son `{ path, method?, body?, headers?, parse }`. El log de desarrollo se inyecta con `onSettled` y no lee `__DEV__`. RF-8.
- `api/freshness.ts` (+test, puro): `FRESH_MS = 60_000`; `shouldRevalidate({ fulfilledTimeStamp, now, isFetching })`. RF-5.
- `api/base-api.ts`: `createApi` con `reducerPath: 'api'`, `baseQuery: retry(fetchJsonBaseQuery, { retryCondition, backoff })` (la `retryCondition` adapta la firma de la versión instalada —error, args del base query e intento— a `shouldRetryRequest`, tomando `method` de los args) y `tagTypes: ['Home', 'ProductList', 'Product']`. Fija `keepUnusedDataFor: 300`, `refetchOnMountOrArgChange: 60`, `refetchOnFocus: false`, `refetchOnReconnect: false` y `endpoints: () => ({})`; las features usan `injectEndpoints`. Log `__DEV__` por intento: endpoint, número de intento y `kind`, sin cuerpos ni datos de usuario. RF-5–RF-8.
- `network/connectivity.ts` (+test, puro): tipo propio `ConnectivitySnapshot { isConnected?: boolean | null; isInternetReachable?: boolean | null }` (no importa `expo-network`). `isOnline(snapshot)` = `isConnected === true` y `isInternetReachable !== false` (un `null`/`undefined` cuenta como desconocido, no como offline). `isReconnection(previous, next)` = `previous` conocido y offline, y `next` online. Sin `previous` (primer evento) nunca es reconexión. RF-5.
- `network/reconnection.ts`: **punto único de suscripción a `expo-network`** (P1). Crea una sola suscripción nativa al primer oyente y la retira cuando no queda ninguno; siembra el estado previo con la lectura inicial de la versión instalada; en cada evento aplica `isReconnection` y avisa a los oyentes. Expone `onReconnect(listener) → unsubscribe`. Sin lógica de caché. RF-5.
- `api/use-revalidate-when-stale.ts`: hook que, con foco de navegación, `AppState` `active` y `onReconnect`, aplica `shouldRevalidate` y llama una vez a `refetch` (de todas las páginas cacheadas en listas). La reconexión sigue la misma regla de 60 s que el foco. RF-5.
- `api/use-pull-to-refresh.ts`: bandera local `isPullRefreshing` que se activa al tirar y se apaga al resolver el `refetch`. Así la revalidación en segundo plano no enciende el spinner. RF-5, RF-6.
- `store/store.ts`, `store/hooks.ts`: `configureStore` con `api.reducer`, `api.middleware` y `searchHistory` (T12); `useAppDispatch`/`useAppSelector` con `.withTypes`. RF-4, RF-18.

### Rutas (`src/app`)
- `_layout.tsx`: `GestureHandlerRootView` → Redux `Provider` → `I18nextProvider` → `AppThemeProvider` → `BottomSheetModalProvider` (dentro del tema y de i18n, porque el modal se pinta en el portal del provider) → `RootStack`. Exporta `ErrorBoundary` (Expo Router) con el fallback global. Sin reglas de negocio. RF-14, RF-20.
- `(tabs)/(home)/category/[id].tsx` → `CategoryProductsScreen`; `(tabs)/(home)/search.tsx` → `SearchScreen`. Siguen siendo rutas delgadas que pasan el parámetro crudo. RF-9, RF-16.

### Home (`src/features/home`)
- `data/home-api.ts`: `getHome` (`providesTags: ['Home']`) con `query: () => buildHomeRequest(homeFixture)`. RF-4, RF-7.
- `data/home-request.ts` (+test, puro): ruta (`/home` o `/home?fail=true`) y `parse` con la fixture aplicada a un payload ya válido. RF-4.
- `logic/classify-home-result.ts` (+test adaptado): `selectHomeView({ data, error, isFetching })` → `HomeScreenState`. Mientras hay una petición en curso conserva el aviso del fallo anterior si hay datos, para que el indicador offline desaparezca solo tras una respuesta satisfactoria. RF-4, RF-19.
- `hooks/use-home.ts`: `useGetHomeQuery` + `useRevalidateWhenStale` + `usePullToRefresh`; devuelve `{ state, isRefreshing, refetch }` igual que el Día 2. RF-4–RF-6.
- `components/ProductSection.tsx`: importa `ProductCard` desde `product` y le pasa el ancho de fila. RF-4.

### Producto y listado (`src/features/product`)
- `contracts/catalog-product.ts`: tipos `CatalogProduct` (antes `HomeProduct`, que queda como alias en `home/contracts/home.ts`), `CurrencyCode`, `ProductBadge` y `ProductPage` (`{ items, page, totalPages, total }`). RF-9.
- `contracts/parse-catalog-product.ts` (+test): `parseCatalogProduct`, extraído de `parse-home.ts` sin cambiar reglas (`parse-home` lo reutiliza); `parseProductPage` (un elemento malformado o un id repetido dentro de la página invalidan el payload; `page ≥ 1`, `totalPages ≥ 0`, `total ≥ 0`); `parseBrandOptions` (`GET /brands`) y `parseCategoryTree` (`GET /categories`, subcategorías). RF-9, RF-14.
- `logic/product-query.ts` (+test): `normalizeSearchText` (NFD sin diacríticos, minúsculas, `trim`, espacios internos colapsados; equivale a `normalizeText` del mock), `buildProductQueryArgs(input)` con entrada `{ category, search, brands, subcategories, inStock, topRated, ownBrand, subscribeAndSave, sort }` (identidad canónica `ProductQueryArgs`: `q` normalizada, facets `brand` y `subcategory` normalizados, sin repetidos y ordenados, flags solo si están activos, `sort`, `limit: 20`, sin página) y `toProductQueryString(args, page)` (`category`, `q`, `brand` y `subcategory` como CSV con cada valor codificado, `inStock=true`, `minRating=4`, `ownBrand=true`, `subscribeAndSave=true`, `sort`, `page`, `limit`). RF-13–RF-17.
- `logic/product-pages.ts` (+test): `getNextPageParam({ page, totalPages })` (`page < totalPages` → `page + 1`; si no, `undefined`, también con `totalPages = 0`), `flattenUniqueProducts(pages)` → `FlatProductList { items, page, totalPages, total }` (conserva el primer ejemplar de cada id; `page`, `totalPages` y `total` de la respuesta más reciente) y `shouldLoadNextPage({ lastVisibleIndex, itemCount, hasNextPage, isFetching, requestedForCount })` (umbral `LOAD_MORE_THRESHOLD = 4` y guard de una sola petición por longitud de lista, que guarda y reinicia quien llama). RF-10, RF-11.
- `logic/product-list-state.ts` (+test): `classifyProductListState({ currentData, error, isFetching, isFetchingNextPage, isFetchNextPageError })` → `loading | ready{ products, total, footer: idle | loading-more | load-more-failed, notice? } | empty | offline | error` (el refresh no tiene variante propia: conserva `ready`, y el spinner del pull es estado local de `usePullToRefresh`). RF-12, RF-19.
- `logic/list-params.ts` (+test): reductor puro de parámetros de pantalla: `toggleQuickFilter`, `applyAdvancedFilters` (draft → aplicado), `setSort`, `clearFilters`, `clearAll`. RF-13–RF-15, RF-19.
- `logic/product-lookup.ts` (+test): clasifica la respuesta de `getProduct` en `found | not-found (404) | offline (network) | error`. RF-8.
- `data/products-api.ts`:
  - `getProducts`: `build.infiniteQuery` con `initialPageParam: 1`, `getNextPageParam` y `providesTags: [{ type: 'ProductList', id: 'LIST' }]`.
  - `getProduct(id)`: `providesTags: [{ type: 'Product', id }]`.
  - `getBrands` y `getCategories`, sin tags.
  - RF-5–RF-11, RF-14.
- `components/ProductCard.tsx` (movido): ancho opcional (fila de Home: `getProductCardWidth`; celda de cuadrícula: ocupa la columna). Añade disponibilidad en texto ("Agotado" visible si `!inStock` y siempre incluida en la etiqueta hablada), no solo en color. RNF-2.
- `list/use-product-list.ts`:
  - Envuelve `useGetProductsInfiniteQuery(arg)` y usa `currentData`, nunca `data`, para no mostrar resultados de otros parámetros.
  - Integra `useRevalidateWhenStale` (refetch de todas las páginas cacheadas para no perder posición), `usePullToRefresh` y `loadMore` con guard.
  - Antes de un refresh, aborta la carga de la página siguiente en vuelo.
  - RF-6, RF-10–RF-12.
- `list/ProductGrid.tsx`:
  - FlashList v2 con `numColumns={2}` y `keyExtractor` por id.
  - `key` = identidad serializada, para volver arriba al cambiar parámetros.
  - Viewability para "cargar más", `ListFooterComponent`, `RefreshControl`, `onLoad` (métrica de RF-21) y `maintainVisibleContentPosition` por defecto.
  - RF-9–RF-12, RNF-1.
- `list/ProductGridSkeleton.tsx`: celdas estáticas con la forma de la cuadrícula (sin shimmer, que también cubre reduced motion). RF-12, RNF-3.
- `list/ProductListStatus.tsx`: vacío con "limpiar", error/offline con reintento, aviso de desactualización y pie de "cargar más" o de error. RF-19.
- `list/QuickFilters.tsx`, `list/SortSheet.tsx`, `list/AdvancedFiltersSheet.tsx`: chips con `accessibilityState.selected`; hojas Gorhom con título, cerrar visible, Atrás de Android y borrador separado. RF-13–RF-15.
- `list/ProductListView.tsx`: compone contador, filtros, orden, cuadrícula y estados. Lo usan la categoría y la búsqueda, así que no se duplica. RF-9–RF-19.
- `screens/ProductPlaceholderScreen.tsx`: mismos estados del Día 2 sobre `getProduct`; bajo `__DEV__`, muestra `OrderDevControls`. RF-7.

### Categorías, búsqueda y checkout
- `categories/screens/CategoryProductsScreen.tsx`: `parseCategoryId` (inválido → `NotFoundScreen` sin petición), nombre por `categoryLabelKey` con el texto del servidor como respaldo, y `ProductListView` con `category`. Una categoría desconocida con forma válida produce total 0 → vacío (RF-19). RF-9.
- `categories/category-labels.ts` (+test): `subcategoryLabelKey` para las 15 subcategorías conocidas (`subcategories.*` es/en). RF-14, RF-22.
- `search/logic/search-history.ts` (+test): `addSearch`, `removeSearch` y `clearHistory`. La identidad es la forma normalizada; conserva la variante humana más reciente, la mueve al inicio sin duplicar y guarda un máximo de 10 eliminando la más antigua. RF-17, RF-18.
- `search/logic/search-view.ts` (+test): `resolveSearchView({ rawText, debouncedText })` → `history` (forma normalizada vacía o solo espacios, sin consulta) | `pending` | `query{ q }`. RF-16, RF-18.
- `search/store/search-history-slice.ts`: slice en memoria que delega en `search-history.ts`. El Día 4 solo lo añade a la whitelist de persistencia. RF-18.
- `search/hooks/use-debounced-value.ts`: un `setTimeout` de 400 ms reinstalado con cada cambio. RF-16.
- `search/screens/SearchScreen.tsx`, `search/components/SearchHistoryList.tsx`: campo en contenido (`returnKeyType="search"`), historial al enfocar con el campo vacío y resultados con `ProductListView` (`q`). RF-16–RF-19.
- `checkout/data/orders-api.ts`: `createOrder` (`POST /orders`, cabecera `Idempotency-Key` recibida del llamador). `parse` proyecta solo `{ status: 'confirmed', orderId }` o `{ status: 'pending', retryAfterSeconds }`. 0 reintentos automáticos (P2): al ser `POST`, `shouldRetryRequest` nunca lo reintenta, sea cual sea el error. `invalidatesTags` llama a `tagsForOrderResult`. El Día 4 lo amplía (cuerpos de 4xx y `GET /orders/status/:key`). RF-7.
- `checkout/logic/order-invalidation.ts` (+test): `tagsForOrderResult(result, items)`. Con `confirmed` devuelve `Home`, `{ ProductList, LIST }` y `{ Product, id }` por cada producto incluido, sin repetidos; con `pending` o error devuelve `[]`. RF-7.
- `checkout/logic/dev-order.ts` (+test): `createDevIdempotencyKey(now, random)` (única, no criptográfica, solo para desarrollo), una dirección ficticia literal y `buildDevOrderRequest(productId, currency)`. RF-7.
- `checkout/components/OrderDevControls.tsx` (`__DEV__`): crea una key por intento, hace POST y, si responde 202, repite el mismo POST (misma key y mismo body) tras `retryAfterSeconds`, hasta 3 veces, hasta obtener `confirmed`. Muestra estado pendiente, confirmada o error y llama a `reset()` de la mutation al terminar. Textos `orderDev.*` en es/en. RF-7, RF-22.

### Errores, i18n y material
- `navigation/screens/GlobalErrorScreen.tsx`: fallback bilingüe y accesible con sus propios `AppThemeProvider`/`I18nextProvider`, porque sustituye al layout raíz. Ofrece "Reintentar" (`retry()` de Expo Router) y "Ir al inicio" (`router.replace('/')` + `retry()`, que remonta el árbol y reinicia el estado efímero). No hay reintento automático. RF-20.
- `foundations/components/RenderErrorDemo.tsx` (`__DEV__`, en Foundations): botón que provoca un error de render para validar el fallback. RF-20.
- `core/i18n/resources/{es,en}.ts`: `productCard.*`, `productList.*`, `filters.*`, `sort.*`, `search.*`, `subcategories.*`, `orderDev.*`, `errorBoundary.*` y `errorDev.*`; `parity.test.ts` vigila la paridad. RF-22.
- `LEARNING.md`, sección "Día 3": bloques teóricos, comparativas, decisiones, medición, matriz, ejercicio, preguntas y checklist. RF-1–RF-3, RF-21, RF-24, RF-25.

## Estado, flujo de datos y contratos
1. **Fuentes de estado.** RTK Query es la única fuente del estado remoto: Home, listas, detalle, facets y órdenes. Redux guarda solo el historial de búsqueda (en memoria hasta el Día 4). Filtros y orden son estado local de la pantalla (`useReducer(listParamsReducer)`). No se copian respuestas a slices.
2. **Identidad de la consulta.** La ruta valida su parámetro y la pantalla combina `category` o `q` con los parámetros locales en `buildProductQueryArgs`. El serializador por defecto de RTK ordena las claves y el arg ya es canónico, así que dos consultas equivalentes comparten caché y solicitud (RF-4, definición de "consulta equivalente"). La página es el `pageParam` de la infinite query y no forma parte de la identidad.
3. **Páginas.** `getNextPageParam` decide si existe la siguiente. `flattenUniqueProducts` aplana sin duplicados y recalcula en cada render a partir de, como mucho, 300 elementos; solo se memoiza si T15 lo justifica midiendo. Cada combinación de parámetros tiene su propia entrada de caché y la pantalla lee `currentData`. Así, una respuesta tardía de parámetros anteriores escribe en su propia entrada y nunca reemplaza la lista vigente (RF-11, RF-16).
4. **Contratos del mock.**
   - `GET /home`.
   - `GET /products?category&q&brand&subcategory&inStock&minRating&ownBrand&subscribeAndSave&sort&page&limit` → `{ items, page, totalPages, total }`. El servidor filtra con OR dentro de cada facet y AND entre facets, ordena y luego pagina (RF-14).
   - `GET /products/:id`; `GET /brands` → `[{ name, productCount }]`; `GET /categories` → árbol con `subcategories`.
   - `POST /orders` (`Idempotency-Key`) → 202 `pending` o 200 `confirmed`.
   - Errores con envelope `{ error: { code, message } }`. `fetchJson` descarta el cuerpo de los no-2xx; el Día 4 lo necesitará para órdenes.

## Política de red (RF-5, RF-6, RF-8)
- **Fresco 60 s.** `refetchOnMountOrArgChange: 60` cubre la apertura (montar un suscriptor). `useRevalidateWhenStale` cubre el foco de navegación, la vuelta a primer plano y la reconexión: revalida solo si `now - fulfilledTimeStamp ≥ 60 s` y no hay petición en curso. RTK además descarta una segunda petición mientras otra de la misma entrada está en vuelo, así que varios disparadores simultáneos producen una sola.
- **Caché disponible tras 60 s.** `keepUnusedDataFor: 300` hace que al reabrir una pantalla tras 60–300 s se vea la caché mientras revalida (`isFetching` sin `isLoading`).
- **Pull-to-refresh.** Fuerza `refetch()` aunque la caché esté fresca. En listas, si la versión instalada lo permite (`refetchCachedPages: false`, comprobar en los tipos), refresca solo la página 1 y descarta el resto; si no, RTK rehace las páginas en cadena desde la primera nueva y se detiene cuando `getNextPageParam` devuelve `undefined`. En ambos casos el resultado parte de la primera página nueva. Antes, se aborta la página siguiente en vuelo; RTK no inicia otra petición mientras hay una pendiente en la misma entrada. Durante el refresh se conserva la lista (`currentData`).
- **Reintentos (RF-8 en lecturas).** Se usa `retry` de RTK con una `retryCondition` propia. Esa condición sustituye a `maxRetries`, así que el límite vive dentro de `shouldRetryRequest`. Las reglas:
  - **Lecturas (`GET`) ante red o 5xx:** exactamente 2 reintentos con 500 ms y 1000 ms (3 peticiones en total). Ante 4xx, 0.
  - **Timeout (8 s) y payload inválido (P3):** 0 reintentos. El error llega de inmediato (un timeout se ve a los ~8 s, no a los ~25 s) y la pantalla ofrece reintento manual. Un timeout no prueba que el servidor no procesara la petición y un payload inválido no se arregla repitiéndola.
  - **`createOrder` (`POST /orders`, P2):** 0 reintentos automáticos ante cualquier error. Reenviar una orden sin saber si se procesó es justo lo que la spec 004 (RF-18) resuelve consultando el estado de la clave sin reenviar; eso llega el Día 4. El re-POST tras un 202 de `OrderDevControls` no es un reintento por fallo: es el protocolo `pending` con la misma key y el mismo body.
  - Después de los reintentos, el error tipado llega a la pantalla, que ofrece reintento manual.
- **Reconexión (RF-5, P1).** `reconnection.ts` traduce los eventos de `expo-network` en "pasó de offline a online". `useRevalidateWhenStale` lo trata como el foco: con datos de más de 60 s revalida una vez en segundo plano; con datos frescos no hace nada. Sin respuesta satisfactoria previa (pantalla offline sin datos) no hay revalidación automática: la pantalla sigue en offline con su botón de reintento (RF-8, RF-19). Varios eventos seguidos (red que oscila) producen una sola petición por el guard de `isFetching` y la deduplicación de RTK.
  - Caso límite de la spec ("si vuelve la red tras un estado offline"): el aviso `offline` se conserva durante el reintento o la revalidación y solo desaparece con una respuesta satisfactoria; si la revalidación falla, el aviso sigue (`selectHomeView` y `classifyProductListState`).
  - Con `adb reverse` el mock se alcanza por USB aunque el dispositivo no tenga red: `expo-network` mide la conectividad del dispositivo, no la del mock. Por eso la validación combina los dos cortes (ver "Simular fallos").
- **Offline frente a error.** Un `network` (fetch sin respuesta, incluido `FetchError` de `expo/fetch`) se muestra como offline. Un `http`, `timeout` o `invalid` se muestra como error. Con datos previos, el aviso es `offline` o `update-failed` y se mantiene durante el reintento hasta una respuesta satisfactoria. Comprobado en T4: RTK 2.13 NO limpia `error` durante `pending` (solo un `fulfilled` lo borra) y conserva `data` tras un fallo, así que `selectHomeView`/`classifyHomeResult` no necesita recordar el último error: basta con `{ data, error, isFetching }` (con `isFetching` y sin datos, el reintento vuelve al skeleton). El estado offline de la UI sigue derivando del fallo de `fetch` (como en el Día 2), no de `expo-network`: el detector solo dispara la revalidación.

## Mutación de orden e invalidación (RF-7)
- Decisión del usuario: mutation real más un control `__DEV__`.
- `createOrder` vive en `checkout/data/orders-api.ts` para que el checkout del Día 4 la reutilice.
- Solo se invalida con `confirmed`, porque RF-7 dice "cuando se confirma una orden". Un 202 no invalida nada.
- RTK refetch de inmediato las consultas suscritas: Home (el tab sigue montado), la lista de la categoría (montada bajo el producto) y el detalle abierto. Elimina de la caché las que no tienen suscriptores, que vuelven a pedirse al abrirse (RF-7: las inactivas revalidan en su siguiente apertura).
- **Dónde vive el control.** `OrderDevControls` se muestra solo bajo `__DEV__` dentro de `ProductPlaceholderScreen`, porque esa pantalla conoce el id y la moneda del producto. Se descarta `CartDevControls`: no conoce ningún producto y se retira en el Día 4 (H-4).
- **Recorrido de validación:** Home → categoría → producto → "Crear orden de prueba" → logs: un POST 202, un POST 200 y después `getHome`, `getProducts` y `getProduct(id)`. Luego abrir una búsqueda cacheada que no estaba montada: pide de nuevo.
- **Idempotency-Key.** Estable por intento: se crea una vez al pulsar y se reutiliza en el re-POST de confirmación.
- **Sin datos personales.** La dirección es un literal ficticio (constitución). No se registra ni se persiste, y el slice `api` nunca entra en la whitelist del Día 4. Tras confirmar, `reset()` limpia el estado de la mutation.

## Interfaz y estados
- **Categoría.** Encabezado con el nombre y el contador total ("N productos"), chips rápidos, botón de orden con la opción activa, botón de filtros con el número de filtros activos y cuadrícula de 2 columnas. RF-9, RF-13–RF-15.
- **Primera carga y paginación.** Primera carga → skeleton con forma de cuadrícula. Cargar más → los productos se conservan y aparece un pie con progreso. Fallo al cargar más → pie con reintento, sin perder lo cargado. Refresh → se conserva la lista. RF-12, RF-19.
- **Errores y vacío.** Fallo sin datos → pantalla offline o de error con reintento. Fallo con datos → aviso de desactualización. Cero resultados → estado vacío que mantiene visibles las selecciones activas y ofrece "Limpiar filtros" (en búsqueda, también limpia el texto) en una sola acción. RF-19.
- **Cargar más.** Cuando cualquiera de los 4 últimos elementos entra en pantalla (viewability de FlashList; umbral mínimo de visibilidad, comprobar la API en 2.0.2), se pide la siguiente página una sola vez. Con `page = totalPages` no se pide nada. RF-10.
- **Cambio de parámetros.** Al cambiar un filtro, el orden o la búsqueda, la lista vuelve a la página 1 y arriba (`key` de identidad). RF-15.
- **Restauración.** Volver desde un producto restaura resultados, filtros, orden y posición porque la pantalla sigue montada en el `Stack` de `(home)`; no hace falta código de restauración. La revalidación por foco tras 60 s rehace todas las páginas cacheadas y `maintainVisibleContentPosition` conserva la posición. RF-9.
- **Hojas.** La hoja de filtros avanzados trabaja sobre una copia del filtro aplicado. "Cancelar", cerrar con gesto o Atrás de Android descartan el borrador; "Aplicar" reemplaza el filtro aplicado y la lista vuelve a la página 1. La hoja de orden aplica al seleccionar una opción. RF-14, RF-15.
- **Búsqueda.**
  - Con el campo vacío y enfocado se muestra el historial: ejecutar, borrar una entrada o borrar todo, con efecto inmediato (RF-18).
  - Con texto, se consulta tras 400 ms sin cambios. Enviar consulta al momento y añade al historial; tocar un resultado también lo añade (RF-16, RF-17).
  - Teclado: `keyboardShouldPersistTaps="handled"` y `keyboardDismissMode="on-drag"`.
- **Fallback global.** Pantalla completa con título, mensaje y dos botones de al menos 48 dp. Si al reintentar vuelve a fallar, se muestra otra vez sin bucle. RF-20.

## Android, iOS y CNG
- **Recompilación.** `expo-network` es un módulo nativo: en T1 se recompila e instala el Development Build en Android (`npx expo run:android --device`) y en iOS (`npx expo run:ios --device`), con parada de validación en ambas. RTK, React Redux, FlashList y Gorhom son JS salvo que la comprobación de T1 diga lo contrario; si alguno trae nativo, entra en esa misma recompilación. Autolinking y CNG incorporan el módulo; no se editan `android/` ni `ios/`. Después de T1 ninguna tarea cambia nativo: `GestureHandlerRootView` y `BottomSheetModalProvider` son JS y solo necesitan Metro.
- **Qué validar en las dos plataformas.** Gesto de la hoja frente al scroll de la cuadrícula; Atrás de Android cierra la hoja; teclado de búsqueda; pull-to-refresh; scroll de 300 elementos; Atrás que restaura; TalkBack y VoiceOver; fuente grande; reduced motion; tema oscuro.
- **Simular fallos.**
  - Offline en Android: `adb reverse --remove tcp:3001`. En iOS: detener el mock.
  - Reconexión (P1), porque `expo-network` mide la red del dispositivo y no la del mock:
    - Android físico: `adb reverse --remove tcp:3001` + modo avión o Wi-Fi apagado → la pantalla queda en offline. Esperar más de 60 s desde la última respuesta, restaurar `adb reverse tcp:3001 tcp:3001` y después activar la red: el evento de reconexión debe producir una sola revalidación y el aviso desaparece al llegar la respuesta. Metro sigue por `adb reverse tcp:8081`.
    - iOS: detener el mock y cortar la red del Mac (el simulador hereda la del host) o, en dispositivo físico, modo avión; reiniciar el mock antes de devolver la red. Si el simulador no emite el cambio, anotarlo y validar en dispositivo físico o con Network Link Conditioner.
    - Contraprueba: reconectar con datos de menos de 60 s no hace ninguna petición; reconectar sin datos previos no hace petición y la pantalla ofrece reintento manual.
  - Timeout (P3): `MOCK_LATENCY_MS=9000` (mayor que los 8 s del cliente) → una sola petición y error a los ~8 s con reintento manual.
  - Latencia: `MOCK_LATENCY_MS=2000`, para observar skeleton, pie, refresh y carreras.
  - 5xx: fixture `server-fail` de Home.
  - 404/4xx: id de producto con forma válida que no existe.
  - Procesamiento de órdenes: `ORDER_PROCESSING_MS`.

## Accesibilidad, i18n y rendimiento
- **Tarjeta.** Es un único botón cuya etiqueta dice nombre, precio (oferta), rating, disponibilidad e insignia. El ancho se adapta a la celda y el alto crece con la fuente; nada se recorta y nada depende solo del color. RNF-2.
- **Controles.** Los chips y las opciones de orden exponen `selected` (las opciones de orden con rol `radio`). Las hojas tienen título de encabezado, botón Cerrar visible y foco inicial en el título. Los targets miden al menos 48 dp/44 pt. El contador y los avisos usan `accessibilityLiveRegion="polite"`.
- **Reduced motion.** Skeleton estático. La hoja abre sin animación de desplazamiento (comprobar en la versión instalada `overrideReduceMotion`/`animationConfigs` con `ReduceMotion.System`) y la lista no tiene transiciones de entrada. RNF-3.
- **Textos.** Todos los nuevos en es/en, incluidos los anuncios y los controles `__DEV__` visibles. RF-22.
- **Rendimiento.**
  - Páginas de 20 elementos. El servidor filtra y ordena; el cliente nunca transforma de forma síncrona los 300 productos de golpe (RNF-1).
  - React Compiler está activo, así que no hay `memo`/`useMemo`/`useCallback` manuales sin medición (RF-21). `renderItem` y `keyExtractor` se definen a nivel de módulo.
  - FlashList recicla celdas: `RemoteImage` ya usa `recyclingKey` y estado derivado del URI; ningún estado local de celda debe sobrevivir al reciclaje.

## Decisiones y alternativas (RF-3)
- **RTK Query como única fuente remota.** Trade-off: configurar tags e infinite queries. Descartada: copiar respuestas a slices, que duplica la fuente de verdad.
- **Base query propio sobre `fetchJson`.** Trade-off: un adaptador pequeño propio. Descartada: `fetchBaseQuery`, que perdería la taxonomía `network/timeout/invalid`, el `parse` que valida el contrato y la clasificación ya probada de `FetchError`.
- **`retry` de RTK con condición pura y backoff determinista de 500/1000 ms.** Trade-off: la condición debe incluir el límite. Descartada: el backoff por defecto (aleatorio, 5 reintentos), que no garantiza "exactamente dos" ni una espera creciente.
- **Frescura propia: `refetchOnMountOrArgChange: 60` + hook de revalidación.** Trade-off: un hook más. Descartada: `refetchOnFocus`/`refetchOnReconnect` + `setupListeners`, que ignoran los 60 s y dependen de eventos web inexistentes en RN.
- **`keepUnusedDataFor: 300`.** Trade-off: más memoria. Descartado: el valor por defecto de 60 s, que borraría la caché justo cuando RF-5 pide mostrarla.
- **`build.infiniteQuery` (RTK ≥ 2.6).** Trade-off: API reciente y semántica de refetch que hay que comprobar. Descartado: el patrón manual `serializeQueryArgs` + `merge` + `forceRefetch`, que mezcla la página con la identidad y complica el refresh.
- **`currentData` en listas.** Trade-off: muestra el skeleton al cambiar de parámetros. Descartado: `data`, que mostraría resultados de otros filtros.
- **FlashList v2 solo en la cuadrícula; Home sigue con `FlatList`.** Trade-off: dos tipos de lista. Descartado: migrar Home, con pocas filas heterogéneas y un carrusel paginado, sin mejora medida.
- **"Cargar más" por viewability de los 4 últimos.** Trade-off: más lógica que `onEndReached`. Descartado: `onEndReachedThreshold`, que mide fracciones de pantalla y no elementos.
- **Filtros como estado local con reductor puro.** Trade-off: no sobreviven a desmontar la pantalla, cosa que la spec no pide. Descartados: Redux global y parámetros de URL.
- **Historial en un slice en memoria desde hoy.** Trade-off: Redux de cliente adelantado un día. Descartado: un store externo temporal que el Día 4 tiraría.
- **`ErrorBoundary` exportado por el layout raíz (Expo Router, `ErrorBoundaryProps { error, retry }`).** Trade-off: el fallback monta sus propios providers. Descartados: un boundary de clase propio y `react-error-boundary` (dependencia extra).
- **Validación estructural sin Zod.** Trade-off: código manual. Descartado: instalar Zod hoy, que sería una 6.ª dependencia; llega el Día 4.
- **Reconexión con `expo-network` y un punto único de suscripción (P1, decisión del usuario).** Trade-off: dependencia nativa que obliga a recompilar en las dos plataformas, y mide la red del dispositivo y no la alcanzabilidad del mock (con `adb reverse` pueden diferir). Descartadas: `@react-native-community/netinfo` `12.0.1` (también la fija el SDK 57 y también es nativa; es un paquete de la comunidad y no aporta nada que RF-5 necesite frente al módulo mantenido por Expo) y la heurística sin dependencia (tratar como reconexión la primera respuesta satisfactoria tras un fallo `network`), que no detecta la vuelta de la red sin hacer antes una petición y confunde la caída del mock con la del dispositivo.
- **Reconexión con la misma regla de 60 s que el foco.** Trade-off: tras reconectar, una pantalla offline sin datos espera al reintento manual. Descartado: reintentar automáticamente al reconectar toda consulta en error, que añadiría un reintento automático que RF-8 no pide.
- **RF-8 solo en lecturas: 0 reintentos automáticos en `createOrder` (P2, decisión del usuario).** Trade-off: un fallo transitorio de la orden de desarrollo exige pulsar otra vez. Descartado: aplicar los 2 reintentos al `POST`, que reenvía una orden de resultado desconocido y contradice la consulta de estado sin reenvío de la spec 004 (RF-18).
- **0 reintentos ante timeout y payload inválido (P3, decisión del usuario).** Trade-off: un timeout aislado no se recupera solo. Descartado: reintentarlos, que retrasaría el error unos 25 s (3 × 8 s + esperas) y repetiría peticiones cuyo resultado se desconoce o cuyo contenido no va a cambiar.
- **Tab Categorías como placeholder (P4, decisión del usuario).** Trade-off: el tab sigue sin contenido real. Descartado: implementar la lista, que la spec 003 no pide (constitución, punto 2).
- **Una spec de 16 tareas en dos sesiones (P5, decisión del usuario).** Trade-off: supera las 10 tareas que sugiere la skill. Descartado: dividir la spec, que obligaría a reabrir una spec aprobada; el corte entre sesiones queda tras T7.
- **Campo de búsqueda en el contenido.** Trade-off: no es la barra nativa. Descartado: `headerSearchBarOptions`, con foco y vaciado distintos por plataforma y peor control del historial.
- **Hojas con `BottomSheetModal` de Gorhom.** Trade-off: provider y peers nativos. Descartados: `Modal` de RN y una ruta `formSheet` (el stack exige Gorhom; el borrador se pierde entre rutas).
- **Disponibilidad en texto en la tarjeta compartida.** Trade-off: Home gana la línea "Agotado". Descartada: una variante solo para la cuadrícula.
- **Control de orden `__DEV__` en el placeholder de producto con key no criptográfica.** Trade-off: la key solo sirve en desarrollo. Descartados: `CartDevControls` y `expo-crypto` hoy (llega el Día 4).

## Seguimientos del Día 2 y límites
- H-4 (`CartDevControls`) se retira el Día 4 y M-5/M-6, `engines` y el test extra de `http.ts` el Día 6. No se amplían. Como `fetchJson` se mantiene, el test M-5 del Día 6 se aplica tal cual.
- H-1/H-7 (iconos y rótulos con fuente grande) se revisan el Día 6; si la cuadrícula los reproduce, se anota en `LEARNING.md` sin corregirlos hoy.
- Para el plan 004 (no se edita aquí):
  - sus rutas `src/features/products/...` deben pasar a `src/features/product/...`;
  - debe retirar `OrderDevControls` cuando el detalle real sustituya al placeholder;
  - reutiliza y amplía `orders-api.ts`.

## Verificación
- **Siempre:** `npx expo lint`. `npx tsc --noEmit`: con Metro arrancado o, sin Metro, antes `CI=1 npx expo start --dev-client --port <libre>` para regenerar `.expo/types/router.d.ts`. Además, `npm run test:logic`.
- **Si cambian dependencias:** `npx expo install --check` y `npx expo-doctor@latest`.
- **Tests `node:test` dentro de cada tarea, escritos primero:**
  - T2: retry (incluidos `POST` con red/5xx → 0, `timeout` → 0 e `invalid` → 0) y base query.
  - T3: frescura y conectividad (`isOnline`, `isReconnection`).
  - T4: Home.
  - T5: normalización, identidad y CSV.
  - T6: páginas, deduplicación, "cargar más" y estado de lista.
  - T7: lookup de producto y parsers.
  - T10/T11: `list-params` y etiquetas de subcategoría.
  - T12: historial y vista de búsqueda.
  - T13: invalidación y key de desarrollo.
- **Recuento de tests.** El total puede bajar al retirar `home-request-state`, `refetch-policy`, `home-client` y `product-client`; ninguna regla que se conserve se queda sin test.
- **Matriz manual con contadores de los logs `__DEV__`:**
  - caché de 60 s (sin red < 60 s; una revalidación ≥ 60 s);
  - pull forzado;
  - 3 peticiones ante 5xx/red y 1 ante 404, timeout o `POST /orders` fallido;
  - reconexión: una revalidación con datos de más de 60 s, ninguna con datos frescos y el aviso offline retirado solo tras una respuesta satisfactoria;
  - una sola petición con disparadores simultáneos;
  - última página sin petición extra;
  - deduplicación;
  - carrera entre refresh y "cargar más";
  - filtros, orden y debounce;
  - offline → online;
  - invalidación por orden;
  - fallback.
- **Herramientas.** React Native DevTools (Profiler y, si está disponible, Network). Sin plugin de Redux DevTools, que sería una dependencia extra.
- **Día 6 (no se instala nada hoy):**
  - Jest con `fetch` controlado para endpoints RTK Query: éxito, vacío, 4xx, 5xx, timeout, latencia, deduplicación e invalidación.
  - RNTL para `ProductGrid`, `QuickFilters`, las hojas, `SearchScreen` y el fallback.
  - Maestro: categoría → filtro → producto → Atrás con restauración, y búsqueda con historial.

## Bloque pedagógico (RF-1, RF-2)
- Cada tarea con construcción empieza con teoría de 10 min como máximo en `LEARNING.md`:
  - estado de servidor frente a estado de cliente;
  - base query y reintentos;
  - caché, frescura, suscripciones y tags;
  - migrar sin cambiar la UI;
  - identidad y normalización;
  - paginación offset e infinite queries;
  - virtualización y reciclaje;
  - estados de lista;
  - draft frente a estado aplicado y hojas;
  - debounce;
  - mutations e invalidación;
  - error boundaries;
  - profiling.
- **Analogías:**
  - RTK Query ↔ Repository + caché + `Flow`/`StateFlow` en Android ↔ `async/await` + `@Observable`/Combine en iOS;
  - tags ↔ invalidar la caché del repositorio;
  - `expo-network` ↔ `ConnectivityManager.NetworkCallback` en Android ↔ `NWPathMonitor` en iOS (un módulo Expo que expone esas APIs nativas a JS);
  - infinite query ↔ Paging 3 (`PagingSource`) ↔ paginación manual con `onAppear`;
  - FlashList ↔ FlatList ↔ `LazyVerticalGrid` ↔ `LazyVGrid` (reciclaje frente a composición perezosa);
  - debounce ↔ `Flow.debounce` ↔ `Combine.debounce`;
  - error boundary ↔ contención de pantalla y `UncaughtExceptionHandler`;
  - Profiler ↔ Android Studio Profiler/Layout Inspector ↔ Instruments.
- **Material de cierre:** decisiones, baseline y comparación, ejercicio de filtro y página, 8–10 preguntas, checklist, validación en las dos plataformas y commit. RF-3, RF-21, RF-24, RF-25.

## Decisiones del usuario (resueltas)
Ninguna cambia la spec 003 ni la 004.
- **P1 (RF-5, reconexión): `expo-network` `~57.0.2`.** 5.ª dependencia, aprobada por el usuario; se instala en T1 con recompilación en Android e iOS y se conecta en T3 a través de `core/network/reconnection.ts`. Descartadas: `@react-native-community/netinfo` y la heurística sin dependencia.
- **P2 (RF-8 frente a la spec 004, RF-18): 0 reintentos en `createOrder`.** RF-8 se aplica solo a las lecturas (`GET`). El Día 4 consultará el estado de la orden según RF-18 de la spec 004.
- **P3 (RF-8, timeout e inválido): 0 en ambos.** Error inmediato y reintento manual.
- **P4 (tab Categorías): dejar el placeholder.** Su texto visible no promete ningún día y no se toca; solo se corrige el comentario de código inexacto en T8.
- **P5 (tamaño): 16 tareas, una spec.** Dos sesiones con corte tras T7; el progreso se apunta en `MEMORY.md`.
