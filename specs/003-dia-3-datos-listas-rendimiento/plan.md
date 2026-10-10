# Plan 003 — Día 3: datos, listas y rendimiento

## Precondiciones y límite del incremento
- Requiere Home/navegación del Día 2 y contrato remoto del Día 1. La migración conserva componentes, rutas y estados observables de Home. RF-4.
- Antes de instalar Redux Toolkit, React Redux, FlashList y Gorhom Bottom Sheet, comprobar documentación/versiones para SDK 57 y usar `npx expo install`; validar que Reanimated/Gesture Handler existentes satisfacen sus peers.
- Ocho checkpoints de 20–30 minutos. Se prioriza store/API → listado → filtros/búsqueda → resiliencia/perfilado. Si excede 3 horas, no se recorta ningún RF: se detiene en el último checkpoint ejecutable y se retoma antes de cerrar el día.

## Archivos y responsabilidades
- `package.json`: dependencias y scripts existentes, sin framework de test todavía.
- `src/core/store/store.ts`, `src/core/store/hooks.ts`: configuración única del store y hooks tipados.
- `src/core/api/base-api.ts`: base URL, RTK Query, retry exacto y listeners de focus/reconnect. RF-5–RF-8.
- `src/core/errors/GlobalErrorBoundary.tsx`, `src/core/errors/GlobalErrorFallback.tsx`: contención de render global y recuperación. RF-20.
- `src/app/_layout.tsx`: providers de store, bottom sheet y boundary; no contiene reglas.
- `src/features/home/data/home-api.ts`: endpoint RTK Query que reemplaza `home-client` y conserva `HomeScreen`. RF-4.
- `src/features/products/domain/product.ts`, `product-query.ts`, `normalize-search.ts`, `merge-pages.ts`: contratos y lógica pura de identidad, facets y dedupe. RF-9–RF-18.
- `src/features/products/data/products-api.ts`: endpoints, tags, serialización CSV, páginas y detalles. RF-5–RF-15.
- `src/features/products/screens/ProductListScreen.tsx`: coordinación de query, refresh, filtros, sort y restauración.
- `src/features/products/components/{ProductGrid,ProductCard,ListSkeleton,ListState,QuickFilters,AdvancedFiltersSheet,SortControl}.tsx`: UI enfocada y accesible.
- `src/features/search/domain/search-history.ts`, `src/features/search/hooks/useDebouncedSearch.ts`, `src/features/search/screens/SearchScreen.tsx`: identidad normalizada, debounce 400 ms e historial en memoria. RF-16–RF-18.
- Recursos i18n: textos de lista, búsqueda, errores, offline y boundary. RF-22.
- `LEARNING.md`: teoría, medición, decisiones y cierre. RF-1–RF-3, RF-21, RF-24, RF-25.

## Estado, flujo de datos y contratos
1. La ruta entrega parámetros a una feature; `product-query.ts` normaliza texto/facets y produce una key determinista.
2. RTK Query serializa la identidad sin página para una lista acumulada, solicita páginas y `merge-pages` conserva primer id, ignora respuestas incompatibles y actualiza metadatos.
3. Datos fresh durante 60 s no hacen red. En apertura/foco/reconexión después de 60 s se presenta cache y revalida una vez; pull-to-refresh fuerza página 1. RF-5, RF-6.
4. Wrapper de base query: red/5xx → exactamente dos retries con backoff; 4xx → cero; luego error tipado para reintento manual. RF-8.
5. Confirmación de orden invalida Home, listas y detalles afectados; queries activas refetch y las inactivas en siguiente uso. RF-7.
6. `ProductQuery` expresa quick filters, CSV ordenado de marcas/subcategorías y sort; el servidor calcula `total/totalPages`. RF-13–RF-15.
7. Historial mantiene `{ normalizedKey, displayText }`, máximo 10; alta/movimiento/borrado son funciones puras. Persistencia se conecta en Día 4. RF-16–RF-18.

## Interfaz y estados
- FlashList presenta dos columnas y `estimatedItemSize` se definirá tras medir una tarjeta real, no por intuición. RF-9, RNF-1.
- Cargar primera página → skeleton; cargar más → footer; refresh → lista conservada; stale/offline → datos + aviso; error sin datos → retry; cero resultados → limpiar filtros. RF-12, RF-19.
- El umbral de infinito son los últimos cuatro elementos; un guard por página impide doble solicitud. RF-10.
- Bottom sheet mantiene draft separado del filtro aplicado; Cancelar descarta draft, Aplicar reinicia página y usa respuesta remota. RF-14.
- Volver desde detalle restaura query, filtros, sort y offset con estado de ruta/feature, no duplicando catálogo en Redux. RF-9.

## Android, iOS y CNG
- Bottom Sheet, FlashList y store se verifican contra SDK 57; si una instalación modifica código nativo, ejecutar check/Doctor y recompilar Development Build. Nunca editar `android/`/`ios/`.
- Validar gestos del sheet frente a scroll en ambas plataformas, teclado de búsqueda, pull-to-refresh, reconexión y back/restauración. RF-14, RF-16, RF-23.

## Accesibilidad, i18n y rendimiento
- Tarjetas anuncian nombre, precio, rating, stock y acción; chips exponen selected; sheet tiene título/foco/cierre; estados no dependen solo de color. RNF-2.
- Reduced motion reemplaza skeleton animado/transición del sheet por estado estático. RNF-3.
- Profiler registra renders y duración para el mismo scroll/filtro antes y después; solo se agrega memoización con mejora observada. RF-21.
- Strings visibles y announcements se añaden en es/en. RF-22.

## Decisiones y alternativas
- **Elegida:** RTK Query como única fuente de estado remoto. **Trade-off:** configuración de merge/tags. **Descartada:** copiar respuestas a slices, que duplica fuente de verdad.
- **Elegida:** Redux solo para infraestructura remota este día; filtros locales a la pantalla/URL. **Trade-off:** restauración explícita. **Descartada:** globalizar cada control.
- **Elegida:** FlashList para catálogo. **Trade-off:** exige estimación y keys estables. **Descartada:** FlatList, cubierta solo como comparación pedagógica.
- **Elegida:** boundary global propio; por requisito técnico puede ser clase mínima envuelta por fallback funcional. **Trade-off:** excepción puntual a componentes funcionales. **Descartada:** dependencia extra o confundir errores HTTP con errores de render.
- **Elegida:** historia pura + memoria hasta Día 4. **Trade-off:** no sobrevive aún al reinicio. **Descartada:** introducir MMKV antes del bloque de persistencia.

## Verificación
- Sin nueva infraestructura: lint, typecheck, matriz manual con `fail=true`/latencia/offline, Redux DevTools/Network inspector, Profiler y Android/iOS.
- Comprobar con contadores de requests: cache 60 s, evento stale, refresh, dos retries exactos, 4xx sin retry, tags tras orden, última página y dedupe.
- Las pruebas Jest/RNTL de normalización, merge, UI y mocks RTK Query se enumeran para Día 6, no se instalan ahora.

## Bloque pedagógico
- Teoría antes de cada práctica: server/client state, cache/tags, paginación, virtualización, debounce y profiling. RF-1.
- Analogías: RTK Query ↔ Repository/cache + Flow; Redux selectors ↔ derived StateFlow; FlashList ↔ LazyVerticalGrid/LazyVGrid; boundary ↔ contención de pantalla.
- `LEARNING.md` incluye elección/trade-off/descartada, baseline, ejercicio de filtro+página, 8–10 respuestas, checklist, validación dual y commit. RF-2, RF-3, RF-21, RF-24, RF-25.
