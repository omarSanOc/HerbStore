# Plan 002 — Día 2: navegación y Home

## Cambios tras revisión
Corrección del plan tras el informe de @reviewer y las decisiones del usuario (sin tocar `spec.md`):
- **Timebox** (H-12): 5–6 h totales en 10 tareas; se elimina la contradicción de "siete checkpoints / 3 horas". RF-1/2/3 dejan de ser código: son "Teoría" por tarea y `LEARNING.md`.
- **Estructura** (H-1): un `Stack` por tab (grupos `(home)`, `(cart)`, `(account)`); producto, categoría y búsqueda viven en el stack de Home, que es quien los origina; escáner como modal en el stack raíz.
- **Cambio aprobado de navegación:** se elimina la pestaña y el placeholder de Categorías. La barra ofrece exactamente Inicio, Carrito y Cuenta; las categorías siguen accesibles desde Home mediante `/category/[id]` (RF-4, RF-11, RF-20). La implementación ya existe; este plan queda alineado documentalmente.
- **Deep links** (H-2, H-15): `+native-intent`, `+not-found`, `anchor`, regla "un destino por tipo" con `dangerouslySingular` y prueba de multitoque.
- **Producto inexistente** (H-3): cliente mínimo `GET /products/:id` con loading/404/error-offline.
- **Imágenes** (H-4): el mock sirve PNG ficticios generados; `resolveAssetUrl` y `RemoteImage` con dimensiones reservadas y alternativa etiquetada.
- **Badge** (H-5, H-9): fuente inyectable, control `__DEV__`, `undefined` en cero, tope "99+", etiqueta accesible con plural.
- **Contrato real de `/home`** (H-6) y tarjeta de producto con campos reales; textos i18n por id.
- **Carrusel** (H-8): visibilidad = foco + `AppState` + viewport + reduced motion, regla pura probada.
- **Estados de Home** (H-10): clasificador puro, timeout, refetch definido, offline ≠ error HTTP.
- **Origen del servidor** (H-11): regla por plataforma + override `.env.local`.
- **Template** (decisión del usuario): se retira todo en T1; `FoundationScreen` queda en `/foundations`, enlazada desde Cuenta.
- **Pruebas de lógica pura** con `node:test` (sin dependencias nuevas).

## Precondiciones y límite del incremento
- Requiere servidor, i18n y design system del Día 1 validados. No recrea contratos ni tokens. RF-10, RF-16.
- **Excepción explícita al "Día 1 cerrado":** T4 reabre `mock-server/` solo para servir imágenes ficticias (`/images/*`), con sus propios tests y nota en su README. No cambia ningún contrato JSON existente. Requiere aprobación del usuario al aprobar este plan.
- Sin dependencias nuevas: `expo-image`, `expo-symbols`, `expo-device` y `expo-router` ya están instalados (SDK 57.0.27, `expo-router` 57.0.25). Sin FlashList (Día 3), sin librería de carrusel, sin Jest/RNTL/Maestro (Día 6). `app.json` no cambia.
- **Timebox: 5–6 h totales** = 10 tareas de ~30 min de construcción + teoría ≤10 min + parada Android/iOS por cada tarea con UI (RF-17). T1, T2 y T4 son las más cargadas (pueden rozar 35–40 min); si una pasa de 40 min se detiene y se informa en lugar de recortar RF.
- Dispositivos de referencia (Día 1): Android físico (USB, `adb reverse`) y simulador iOS. Con Metro: `npx expo start --dev-client`; Metro regenera `.expo/types/router.d.ts` al arrancar, por eso **Metro debe haber arrancado al menos una vez tras añadir/mover rutas antes de ejecutar `npx tsc --noEmit`**.
- Antes de cada API de Expo Router se comprueba su `.d.ts` en `node_modules/expo-router/build` (ya verificadas para este plan: ver "Decisiones").

## Árbol de rutas
```
src/app/
  _layout.tsx                  Stack raíz; unstable_settings.anchor = '(tabs)'; scanner con presentation 'modal'
  +native-intent.ts            delega en src/core/navigation/linking.ts
  +not-found.tsx               adaptador de NotFoundScreen
  scanner.tsx                  modal placeholder (cámara real: Día 5)
  (tabs)/
    _layout.tsx                Tabs (Inicio, Carrito, Cuenta) ; unstable_settings.anchor = '(home)'
    (home)/_layout.tsx         Stack ; anchor = 'index'
    (home)/index.tsx           Home
    (home)/product/[id].tsx    existencia del producto (detalle: Día 4)
    (home)/category/[id].tsx   categoría desde Home (listado: Día 3)
    (home)/search.tsx          placeholder (búsqueda: Día 3)
    (cart)/_layout.tsx         Stack ; cart.tsx         placeholder + control __DEV__ del badge
    (account)/_layout.tsx      Stack ; account.tsx      placeholder + enlace a /foundations ; foundations.tsx
```
Cada tab con `index` propio colisionaría en la URL `/`; por eso solo Home usa `index` y el resto usa un nombre (`cart`, `account`). En Día 2 solo Home origina producto, categoría y búsqueda; no existe un grupo ni placeholder de Categorías. La ruta `/category/[id]` permanece dentro del stack de Home.

## Archivos y responsabilidades
**Rutas (`src/app/`)**, delgadas: solo adaptan parámetros y montan pantallas.
- `_layout.tsx`: i18n, tema, `StatusBar`, `Stack` raíz con modal del escáner. RF-7.
- `(tabs)/_layout.tsx`: tres `Tabs.Screen` en orden Inicio/Carrito/Cuenta, iconos `SymbolView`, `tabBarLabel`/`title`/`tabBarAccessibilityLabel` localizados, `tabBarBadge` derivado; no registra una pantalla Categorías. RF-4, RF-16, RNF-1.
- Grupos `(home)`, `(cart)`, `(account)`: `Stack` con títulos localizados; producto, categoría y búsqueda son destinos del stack de Home con `dangerouslySingular`. RF-5, RF-6, RF-11, RF-20.

**Features**
- `src/features/navigation/screens/{PlaceholderScreen,NotFoundScreen}.tsx`: destinos explícitos y estado "no encontrado" (volver + ir a Inicio). RF-8, RF-9.
- `src/features/cart/{cart-count-source.ts,use-cart-count.ts,format-cart-badge.ts}`: `CartCountSource` (store externo + `useSyncExternalStore`, mismo patrón que `use-reduced-motion`), hook y función pura `getCartBadge`. RF-4.
- `src/features/product/{parse-product-id.ts,product-client.ts,use-product-exists.ts,screens/ProductPlaceholderScreen.tsx}`: validación de id, `GET /products/:id`, estados loading/found/404/error-offline. Solo existencia (nombre e id), sin detalle. RF-8.
- `src/features/home/contracts/home.ts`: tipos del contrato real (abajo).
- `src/features/home/data/{home-client.ts,home-fixtures.ts}`: cliente fetch aislado (migra a RTK Query en Día 3) y fixtures **solo `__DEV__`**.
- `src/features/home/logic/classify-home-result.ts`: lógica pura que convierte resultado + datos previos en estado de pantalla. RF-14, RF-15.
- `src/features/home/hooks/use-home.ts`: orquesta petición, timeout, refetch y reintento; la UI solo consume el estado. RF-14.
- `src/features/home/carousel/carousel-autoplay.ts`: regla pura de autoplay. RF-12, RF-13.
- `src/features/home/screens/HomeScreen.tsx` y `components/{HomeHeader,BannerCarousel,CategoryRow,ProductSection,ProductCard}.tsx`. RF-10, RF-11.
- `src/features/foundations/FoundationScreen.tsx` se conserva sin cambios funcionales y se monta en `/foundations`.

**Infraestructura**
- `src/core/network/resolve-api-origin.ts` (pura) y `api-origin.ts` (lee `Platform.OS`, `Device.isDevice`, `EXPO_PUBLIC_API_ORIGIN`).
- `src/core/network/http.ts`: `fetchJson` con `AbortController` + timeout que devuelve un resultado discriminado (`ok | http | network | timeout | invalid`); lo usan los dos clientes.
- `src/core/network/resolve-asset-url.ts`: `resolveAssetUrl(origin, path)` pura.
- `src/core/navigation/linking.ts`: `redirectSystemPath` (normaliza o descarta) y `normalizeIncomingUrl` pura.
- `src/core/lifecycle/use-app-active.ts`: `AppState` vía `useSyncExternalStore`.
- `src/design-system/components/RemoteImage.tsx`: `expo-image` con dimensiones reservadas, placeholder y alternativa etiquetada.
- i18n es/en: tabs, estados, acciones, etiquetas accesibles, nombres de sección/categoría/banner por id.
- `mock-server/src/routes/images.js` + `src/catalog/placeholder-png.js` + `test/images.test.js` (T4).

**Retirada total del template (T1):** `src/app/explore.tsx`, `src/components/**` (incluidos `app-tabs*.tsx`), `src/constants/theme.ts`, `src/global.css`, `src/hooks/**`, `scripts/reset-project.js` y su script `reset-project` en `package.json`, y los assets que solo usaba el template (`assets/images/{tabIcons,react-logo*,expo-badge*,expo-logo,logo-glow,tutorial-web}`). Se conservan los iconos/splash/favicon referenciados por `app.json` y `assets/expo.icon`. Antes de borrar cada archivo se comprueba con `grep` que nada de `src/features`, `src/design-system` ni `src/core` lo importa (en la revisión solo lo importan los propios archivos del template).

## Contrato real de `/home` (de `mock-server/src/catalog/home-data.js`)
- `banners[] {id, title, subtitle, imageUrl, categoryId}`: siempre 2 (`daily-wellness` → `vitamins`, `plant-powered` → `botanicals`).
- `categories[] {id, name, productCount, imageUrl}`: 5 (`vitamins`, `minerals`, `protein`, `botanicals`, `wellness`).
- `sections[] {id: 'best_sellers' | 'new' | 'offers', title, items[]}`: máx. 10 `Product` por sección.
- `Product` (campos reales, `product-contract.js`): `id, brand, name, categoryId, subcategoryId, price, listPrice?, currency ('MXN'|'USD'), rating, reviewCount, soldLast30Days, badges ('BEST_SELLER'|'QUALITY_PICK'|'NEW'|'OWN_BRAND'), couponText?, inStock, images[], …`. Ids de producto: `product-261009-001` … `-300`.
- Imágenes: rutas relativas `/images/banners/<id>.png`, `/images/categories/<id>.png`, `/images/products/product-NNN-{front,detail}.png`.
- Los textos del servidor están en inglés: la app usa claves i18n por `section.id`, por id de categoría y por id de banner conocidos; el texto del servidor solo es *fallback* para ids desconocidos. Nombre y marca de producto son datos de catálogo, no texto de interfaz, y se muestran tal cual.

## Flujo de navegación y datos
1. El layout raíz monta un `Stack` con `(tabs)` y el modal `scanner`; `(tabs)` mantiene un `Stack` por tab. Todos los destinos nuevos se **empujan en el stack del tab que los origina**; Atrás vuelve al anterior sin cambiar de tab. RF-5, RF-6.
2. Cada ruta delega en una pantalla de feature. `product/[id]` valida con `parseProductId`; si es válido consulta `GET /products/:id` (loading → found | 404 | error/offline con reintento); si falta o es inválido muestra `NotFoundScreen` sin petición. RF-8.
3. Un enlace entrante pasa por `redirectSystemPath({ path, initial })`, que recibe la **URL completa** (`herbstore://product/<id>`; en un arranque normal recibe la URL raíz `herbstore:///`). `linking.ts`: raíz → `/`; `herbstore://product/<id>` → `/product/<id>` normalizado (sin query/fragmento/barra final); esquema ajeno → `null` (se ignora); cualquier otro host del esquema propio → se deja pasar y lo atrapa `+not-found`; nunca lanza (la doc advierte que un error puede cerrar la app). RF-9.
 4. Home: `useHome` → `home-client` → `fetchJson` → `classifyHomeResult(previous, outcome)` → `HomeScreen` solo presenta. Acciones producen rutas tipadas: banner → `/category/<categoryId>`, categoría → `/category/<id>`, producto → `/product/<id>`, buscador → `/search`, escáner → `/scanner`; no hay navegación a un tab de categorías. RF-10, RF-11, RF-20.
5. El Día 3 sustituye únicamente `home-client`/`use-home` por RTK Query y conserva `HomeScreen`, componentes y estados.

## Estado e interfaz
- **Badge (RF-4).** `Tabs.Screen` de Carrito recibe `tabBarBadge={getCartBadge(count)}`; `getCartBadge` devuelve `undefined` si `count <= 0` (verificado en `TabBarIcon.js`: el badge se muestra con `badge != null`, por lo que `0` mostraría "0"), el número hasta 99 y `'99+'` desde 100. `tabBarAccessibilityLabel` usa i18n con plural (`Carrito, 3 artículos`) y el conteo real (100 → "100 artículos"). En iOS React Navigation añade por defecto una etiqueta en inglés (`"<label>, tab, n of N"`, `BottomTabBar.js:283-287`); definir `tabBarAccessibilityLabel` en **los tres tabs** evita ese texto sin localizar. El Día 4 conecta el store real sin reescribir tabs. El control de apoyo **solo `__DEV__`** del placeholder de Carrito (+1, +10, restablecer) se retira en el Día 4.
- **Iconos de tab.** `SymbolView` de `expo-symbols` 57.0.3 con `name={{ ios, android, web }}`; en Android renderiza un glifo Material Symbols (carga una fuente con `expo-font`, vacío mientras carga, y `fallback` si falta el nombre de plataforma); los nombres de Android están tipados (`AndroidSymbol`). Se verifica visualmente en T1. Si el glifo no aparece en Android no se añade `@expo/vector-icons` sin aprobación: se informa.
- **Persistencia de pila y scroll por tab (RF-5).** El tab permanece montado (`lazy` y `popToTopOnBlur` por defecto; `popToTopOnBlur` defecto `false`, verificado en `bottom-tabs/types.d.ts`), así que **no se guarda la posición a mano**. Se verifica en Android e iOS y se documenta como lección; tocar el tab activo hace *pop to top* de su stack, no duplica rutas.
- **Home.** `FlatList` vertical con filas heterogéneas (banners, categorías, una fila por sección visible), `RefreshControl` para pull-to-refresh y filas con `key` estable. Estados vía `classifyHomeResult`:
  - sin datos previos y pendiente → `loading` (esqueleto con dimensiones reservadas);
  - fallo sin datos previos → `offline` si `fetch` rechaza con `TypeError` (sin red), `error` si hay respuesta HTTP no 2xx (p. ej. 5xx), payload inválido o *timeout*; ambos con reintento;
  - datos previos + fallo → se mantienen y aparece aviso (`offline`, o "no se pudo actualizar" si fue error HTTP/timeout);
  - colecciones vacías se omiten individualmente (`banners`, `categories`, cada sección); todas vacías → `empty` con reintento.
- **Refetch.** Pull-to-refresh; al volver la app a primer plano; y al recuperar el foco **solo si el último resultado fue fallo**. No se refetch en cada foco para no repetir peticiones al volver de un producto (RTK Query asumirá `refetchOnFocus`/`refetchOnReconnect` en Día 3). `use-home` ignora respuestas obsoletas (contador de petición) y aborta al desmontar. **Timeout 8 s** con `AbortController`.
- **Carrusel.** `FlatList` horizontal con `pagingEnabled`, ancho medido con `onLayout`, índice por `onMomentumScrollEnd`, indicadores, botones anterior/siguiente de 48 dp y acciones de accesibilidad `increment`/`decrement`. Cero banners: no se renderiza; uno: sin indicadores ni autoplay. El texto del banner va **debajo** de la imagen (no superpuesto) para contraste y texto ampliado.
- **Autoplay (RF-12, RF-13).** `shouldAutoplay({ bannerCount, isFocused, isAppActive, isRowVisible, reducedMotion, isInteracting })` es pura. El hook arma **un `setTimeout` de 5 s** que se reinstala en cada cambio de sus dependencias (índice, `shouldAutoplay`, época de interacción): así cada reanudación (fin de toque/arrastre, vuelta a primer plano, volver visible) empieza una espera completa y no hay deriva de `setInterval`. Cleanup al cambiar dependencias y al desmontar. Entradas: `useIsFocused` (cubre cambio de tab, producto apilado y modal), `useIsAppActive` (`AppState === 'active'`), viewport (ver decisión) y `useReducedMotionPreference` (existente). Toque/arrastre: `onTouchStart`/`onTouchEnd`/`onTouchCancel` y `onScrollBeginDrag`. Con reduced motion no hay autoplay y el desplazamiento programático de los botones no se anima.

## Android, iOS y CNG
- Se mantiene `scheme: herbstore`; no se editan `ios/` ni `android/`; `app.json` no cambia, por lo que no hace falta recompilar el binario por este plan (solo Metro). Si T3 revela que el arranque en frío exige cambio de configuración, se hace por app config y se avisa antes.
- **Origen del servidor (`resolve-api-origin`)**, solo desarrollo; en producción se exigiría HTTPS y un origen configurado (fuera de alcance). Reglas por defecto, puerto 3001:

  | Entorno | Origen |
  |---|---|
  | `EXPO_PUBLIC_API_ORIGIN` definido (`.env.local`, ya ignorado por Git) | ese valor (sin barra final, solo `http(s)`) |
  | Android emulador (`Platform.OS==='android'`, `!Device.isDevice`) | `http://10.0.2.2:3001` |
  | Android físico por USB | `http://localhost:3001` con `adb reverse tcp:3001 tcp:3001` |
  | iOS simulador | `http://localhost:3001` |
  | iOS físico | requiere override con IP de LAN; sin override, aviso `__DEV__` |

  Cleartext HTTP en Android debug lo cubre CNG; se comprueba con una petición real. En iOS se comprueba en el simulador (`NSAllowsLocalNetworking`); **limitación documentada:** en iOS físico por LAN pueden intervenir ATS y el permiso de red local, y no está en los criterios de cierre (Día 1 validó iOS en simulador). Metro necesita reiniciarse (`-c`) tras cambiar variables `EXPO_PUBLIC_*`.
- Back de Android (hardware) y gesto/back de iOS; modal en ambos sistemas (en Android `presentation: 'modal'` es una pantalla de stack con animación vertical: por eso el botón cerrar de 48 dp es obligatorio en ambos).
- **Deep links en Development Build:** `expo-dev-client` puede interceptar un arranque en frío con su launcher. Se prueba con `adb shell am start -a android.intent.action.VIEW -d "herbstore://product/<id>" com.herbstore.mobile` y `xcrun simctl openurl booted "herbstore://product/<id>"` tras cerrar la app a la fuerza. Si el launcher impide observar el arranque en frío, la validación se hace con una compilación Release local (`npx expo run:android --variant release`, `npx expo run:ios --configuration Release`) o se documenta la limitación y se cierra en el Día 5 (validación nativa de enlaces); esta decisión la toma el usuario en ese momento.

## Accesibilidad, i18n y rendimiento
- Tabs: rol `tab`, selección, nombre localizado y badge en la etiqueta. Carrusel: contenedor `adjustable` con valor "Banner n de N", sin *live region* (no anunciar cada avance automático), botones ≥48 dp y dots decorativos. Imágenes con etiqueta; tarjetas y categorías con `accessibilityRole="button"` y etiqueta completa (nombre, precio, calificación). Targets 48 dp Android / 44 pt iOS (el token `minimumTouchTarget` ya es 48). Texto con `allowFontScaling`, `numberOfLines` solo donde el contenedor crece; sin alturas fijas en texto. RNF-1.
- Todo texto visible sale de recursos es/en, incluidos estados, avisos, control `__DEV__` y fallback de imagen. RF-16.
- Precio con `Intl.NumberFormat(locale, { style: 'currency', currency: product.currency })`; `locale` derivado del idioma activo de i18n. Calificación como `★ 4.5 (1234)` con etiqueta hablada localizada.
- **Insignia de la tarjeta (una sola, por prioridad):** Oferta si hay `listPrice` (se muestra tachado), si no Nuevo si `badges` incluye `NEW`, si no Más vendido si incluye `BEST_SELLER`. `couponText` (inglés de servidor) no se muestra.
- Imágenes (`RemoteImage`): contenedor con `aspectRatio` fijo (banner 16:9, categoría 1:1, producto 1:1) y color de superficie de fondo como placeholder; `transition` 0 si reduced motion; `onError` → alternativa con el texto "Imagen no disponible" (en categorías solo la inicial) y etiqueta accesible con el nombre. RNF-2, RNF-3.
- Rendimiento: sin memoización sin medición; props inmutables y *keys* estables; secciones de ≤10 elementos en `FlatList` horizontal (la migración a FlashList es del Día 3). Si se mide algo con Profiler/DevTools se documenta (ver React Compiler en "Decisiones abiertas").

## Decisiones y alternativas
- **Stack por tab (H-1).** Elegida: grupos `(home)/(cart)/(account)` con `Stack` propio; producto, categoría y búsqueda pertenecen al stack de Home, que es quien los origina. Trade-off: más archivos de layout y los destinos siguen ligados al origen; si otro tab los origina en un día posterior, habrá que revisar la agrupación. Descartada: conservar una pestaña/grupo de navegación separado para Categorías (ofrecería un destino sin comportamiento propio y rompería la decisión aprobada de exactamente tres tabs) o colocar producto/categoría/búsqueda en el stack raíz (más simple, pero Atrás/estado dejan de pertenecer al tab y rompe RF-6).
- **Tabs estables vs nativos.** Elegida: `Tabs` de Expo Router (`Tabs`/`Stack`). Trade-off: apariencia menos nativa. Descartada: conservar `unstable-native-tabs` del template, por riesgo didáctico/API inestable.
- **Anchors.** Elegida: `unstable_settings.anchor` en el layout raíz (`'(tabs)'`), en `(tabs)` (`'(home)'`) y en el stack de Home (`'index'`), verificado en `getRoutesCore.js` (`anchor ?? initialRouteName`; error si el anchor no es hijo). Garantiza que un enlace a `/product/<id>` o `/scanner` tenga Home debajo y Atrás funcione. Trade-off: configuración implícita que hay que probar con enlaces. Descartada: confiar en el anchor por defecto (solo busca un hijo con el nombre del grupo, que `index` no cumple).
- **Un destino por tipo (H-2, H-15).** Elegida: `dangerouslySingular={(name) => name}` en `product/[id]`, `category/[id]`, `search` y `scanner`: el identificador es el nombre de la ruta, así que A seguido de B deja **una sola pantalla de producto (B)**, un doble toque o un toque simultáneo en dos tarjetas no abre dos instancias, y un enlace con la app activa reemplaza al anterior. Verificado en 57.0.25: `getId` está **deprecado** (`useScreens.js:93` avisa y exige renombrar) y `Stack.Screen` expone `dangerouslySingular`. Trade-off: no se puede apilar producto sobre producto (no existe ese flujo en Día 2; si el Día 4 lo necesita se pasa a `dangerouslySingular` por parámetro `id` con `true`, que usa `product/<id>` como identidad, o se aplica la opción solo por navegación imperativa). Descartada: `getId` (deprecado) y desactivar toques con estado manual en cada `Pressable` (duplica lógica por pantalla).
- **Imágenes del mock (H-4).** Elegida: handler dinámico `GET /images/:kind/:name` que genera **PNG** reales (color determinista por ruta con hash, degradado vertical simple; banners 640×360, categorías 128×128, productos 256×256) con `zlib.deflateSync`, CRC32 propio de ~10 líneas y `Content-Type: image/png`. Las rutas `.png` del contrato de Día 1 se conservan sin cambio. Rutas desconocidas → 404 JSON `NOT_FOUND` (sirve también para probar el fallback). Trade-off: un pequeño codificador PNG que mantener, imágenes sin texto. Descartadas: **SVG** (obligaría a cambiar extensión/contrato o a servir `image/svg+xml` bajo `.png`, incorrecto, y `expo-image` trata SVG de forma distinta por plataforma), ficheros estáticos versionados (más de 600 binarios), servicios externos de placeholders (dependencia de red y de terceros) y `sharp`/`canvas` (dependencias nuevas).
- **`resolveAssetUrl`.** Elegida: función pura `resolveAssetUrl(origin, path)` (une origen y ruta sin barras duplicadas, deja pasar `http(s)://` absolutas y devuelve `undefined` para vacío, `//host` o esquemas no HTTP). Descartada: concatenar en los componentes (se repetiría en banners, categorías y productos).
- **Cliente de producto mínimo (H-3).** Elegida: `GET /products/:id` solo para existencia, con estados loading/404/error-offline y reintento. Trade-off: una petición extra que el Día 4 reemplaza con el detalle real. Descartada: aceptar cualquier id con formato válido (RF-8 exige "no existe → no encontrado").
- **Cliente fetch aislado.** Elegida: `fetchJson` + clientes por feature + clasificador puro. Trade-off: se migra a RTK Query en Día 3. Descartada: adelantar RTK Query antes de su bloque formativo o acoplar `fetch` a la pantalla.
- **Offline vs error.** Elegida: offline = `TypeError` de `fetch` (sin respuesta); error = respuesta HTTP no 2xx, payload inválido o timeout. Trade-off: un timeout en red degradada se muestra como error, no como offline. Descartada: tratar todo fallo como offline (oculta fallos del servidor) o usar `NetInfo` (dependencia nueva).
- **Visibilidad del carrusel (H-8).** Elegida: Home como `FlatList` de filas con `onViewableItemsChanged` (`itemVisiblePercentThreshold: 50`, callback y config estables) sobre la fila del banner, combinado con foco, `AppState` y reduced motion. Trade-off: la fila puede desmontarse con ventanas de virtualización (con ≤5 filas el riesgo es bajo y se verifica); la misma API existe en FlashList (Día 3). Descartadas: solo foco (no detecta carrusel desplazado fuera de pantalla), y `onScroll`+`onLayout` con matemática manual (más código y más re-renders).
- **Scroll por tab.** Elegida: no guardar posición; el tab queda montado. Trade-off: memoria de pantallas inactivas. Descartada: `freezeOnBlur` (existe en `bottom-tabs/types.d.ts`, solo iOS/Android con `react-native-screens`; añade riesgo sin una necesidad medida) y persistir offsets a mano.
- **Carrusel con primitivas RN.** Elegida: `FlatList` horizontal + `setTimeout`. Trade-off: se implementa temporizador e índice. Descartada: dependencia adicional para una conducta acotada.
- **Escáner modal placeholder.** Elegida: modal real de navegación sin cámara. Trade-off: aún no escanea. Descartada: simular escaneo antes del Día 5.
- **Pruebas de lógica pura con `node:test`.** Elegida: tests junto a los módulos puros (`*.test.ts`) con el runner integrado de Node, ya usado en `mock-server`, ejecutados con un script `test:logic` (`node --test "src/**/*.test.ts"`). Requiere Node con *type stripping* activado por defecto (22.18+ o 23.6+, a confirmar con `node --version` al empezar T1) y que los módulos puros no importen React Native ni el alias `@/`; solo `import type` y rutas relativas con extensión `.ts`, lo que pide `allowImportingTsExtensions` en `tsconfig.json` (permitido porque `noEmit` ya es `true`). Trade-off: restricciones de estilo en esos archivos. Descartadas: Jest/RNTL antes del Día 6 (constitución, art. 4) y diferir toda prueba (la lógica se escribe test-first). Si `node --version` no cumple, se difiere a Día 6 con los casos ya listados abajo y se informa.
- **Dev fixtures.** Elegida: `EXPO_PUBLIC_HOME_FIXTURE` (`zero-banners`, `one-banner`, `empty-section`, `all-empty`, `broken-image`, `server-fail`), leída solo bajo `__DEV__`, para cubrir lo que el servidor nunca devuelve (siempre 2 banners). Descartada: un menú de depuración en UI (más texto visible y código de producto).

## Estrategia de pruebas
- `node:test` en `mock-server/test/images.test.js` (PNG válido: firma, `Content-Type`, dimensiones por tipo, determinismo, 404) y, para la app, en `src/**/*.test.ts`:
  - `getCartBadge`: 0 → `undefined`, 5 → 5, 99 → 99, 100 → `'99+'`, negativos.
  - `parseProductId`: string válido, vacío, array, `undefined`, espacios, caracteres no permitidos, longitud excesiva.
  - `resolveApiOrigin`: override, cada combinación plataforma/dispositivo, barra final, protocolo inválido.
  - `resolveAssetUrl`: **banners, categories y products**, origen con barra final, URL absoluta, `//host`, esquema no HTTP, vacío.
  - `normalizeIncomingUrl`: producto válido/inválido, query/fragmento, raíz, esquema ajeno, host desconocido, mayúsculas.
  - `classifyHomeResult`: loading, éxito, empty total, colección vacía omitida, `TypeError` → offline, 5xx → error, timeout, payload inválido, con y sin datos previos.
  - `shouldAutoplay`/`nextBannerIndex`: 0/1/N banners y cada condición de pausa.
- Lo que depende de UI se valida manualmente en Android/iOS con la matriz (T9). Jest, RNTL y Maestro se difieren al Día 6; el material lista los casos de la matriz como candidatos a automatizar.
- Cada tarea con lógica sigue test-first: el test falla por la razón esperada antes de implementar.

## Verificación
Cada tarea: `npx expo lint`, `npx tsc --noEmit` (tras arrancar Metro al menos una vez, para `.expo/types/router.d.ts`), `npm run test:logic` y, si se toca el mock, `npm --prefix mock-server test`. Sin dependencias ni `app.json` nuevos, por lo que `expo install --check` y Expo Doctor solo se repiten en T9 como comprobación de regresión.

Matriz de T9 (Android físico + simulador iOS × tema claro/oscuro × texto ampliado × reduced motion):
- **Tabs y pilas:** aparecen exactamente Inicio, Carrito y Cuenta; no aparece Categorías; cambio y reselección del tab activo (en raíz y con producto apilado), posición de scroll de Home conservada, Atrás de Android y gesto de iOS, Foundations desde Cuenta; una categoría abierta desde Home usa `/category/[id]` y vuelve a Home.
- **Modal:** abrir/cerrar escáner (botón, gesto iOS, Atrás Android) y Home con su posición previa.
- **Producto:** id válido, ausente, inválido, inexistente (404), servidor detenido (offline). El 5xx de producto comparte `fetchJson` con Home y queda cubierto por la clasificación probada en T4.
- **Deep links:** `herbstore://product/<id>` en frío, con app activa, A luego B, id inválido, host desconocido; multitoque (dos dedos / toque doble rápido) sin segunda instancia.
- **Home:** `MOCK_LATENCY_MS=3000` (loading), fixture `server-fail`, servidor detenido en primera carga (offline), servidor detenido o modo avión con datos previos + pull-to-refresh (aviso), `all-empty`, `empty-section`, `zero-banners`, `one-banner`, N banners, `broken-image`.
- **Carrusel:** 5 s medidos con cronómetro, pausa al tocar/arrastrar y reanudación a los 5 s, segundo plano/primer plano, cambio de tab, producto apilado, modal, fila fuera de pantalla, reduced motion activado a mitad de ejecución.
- **Accesibilidad:** TalkBack y VoiceOver leen cada tab (nombre, selección, "Carrito, N artículos"), tarjetas y carrusel; texto ampliado al máximo del sistema sin recortes; targets 48/44.
- Reduced motion se comprueba con la pantalla Foundations (muestra "Movimiento reducido: activado/desactivado" desde el Día 1).

## Bloque pedagógico
- Teoría ≤10 min antes de cada construcción (RF-1): layouts/grupos/tabs; rutas dinámicas y parámetros; modal y deep links; capa de datos aislada; estado de pantalla y listas; imágenes y listas horizontales; paginación; temporizadores y ciclo de vida.
- Analogías: Expo Router ↔ Navigation Compose/NavHost y SwiftUI NavigationStack/TabView; grupos de rutas ↔ nested nav graphs; modal ↔ Dialog/sheet/`fullScreenCover`; params ↔ typed arguments/path values; `redirectSystemPath` ↔ `intent-filter`+deep link handler y `onOpenURL`; `dangerouslySingular` ↔ `launchSingleTop`; estado de pantalla ↔ `UiState` sealed class / enum con valores asociados; `useIsFocused`+`AppState` ↔ `Lifecycle.repeatOnLifecycle` / `scenePhase`.
- `LEARNING.md` registra decisiones, trade-offs y alternativa descartada; ejercicio de ruta parametrizada; 8–10 preguntas con respuestas; checklist oral; validación dual y commit. RF-2, RF-3, RF-18, RF-19.
- Errores típicos al venir de nativo a señalar: asumir que Atrás es el SO y no el stack, olvidar `cleanup` de temporizadores, tratar el tab como "activity recreada" (aquí queda montado), `useEffect` con dependencias mal declaradas, y confiar en el compilador o en `memo` sin medir.

## Mapa RF/RNF → tareas
| Requisito | Tareas |
|---|---|
| RF-1 (teoría ≤10 min) | "Teoría" al inicio de T1–T8; compendio en T10 |
| RF-2, RF-3 | Teoría T1–T8 y decisiones citadas; documento final en T10 |
| RF-4 | T1 (tres tabs y badge); T9 |
| RF-5 | T1 (pilas por tab, reselección); T5 (scroll de Home); T9 |
| RF-6 | T1 (stacks), T2 (producto apilado), T3 (anchor) |
| RF-7 | T3 (modal); T9 |
| RF-8 | T2 (id válido/inválido/inexistente), T3 (+not-found) |
| RF-9 | T3 |
| RF-10 | T5 (buscador, escáner, estructura), T6 (categorías, secciones), T7 (banners) |
| RF-11 | T5 (buscador, escáner), T6 (categoría, producto), T7 (banner) |
| RF-20 | T1 (sin tab ni placeholder de Categorías), T6 (categoría desde Home en `/category/[id]`), T9 (ausencia del tab y ruta de detalle) |
| RF-12 | T7 (manual y paginación), T8 (autoplay) |
| RF-13 | T8 |
| RF-14 | T4 (clasificador), T5 (UI, refetch) |
| RF-15 | T4 (clasificador), T5 (vacío total), T6/T7 (omitir colección) |
| RF-16 | T1, T2, T3, T5–T8 (cada texto nuevo); revisión en T9 |
| RF-17 | parada Android+iOS en T1, T2, T3, T5, T6, T7, T8; T4 con humo; T9 |
| RF-18, RF-19 | T10 |
| RNF-1 | T1, T5–T8; T9 (TalkBack/VoiceOver, texto ampliado) |
| RNF-2 | T7 (transiciones), T8 (autoplay) |
| RNF-3 | T4 (servidor y `resolveAssetUrl`), T6 (`RemoteImage`), T7 (banners) |
| RNF-4 | lint/typecheck en cada tarea; T9 (temas, texto ampliado, ambas plataformas) |

## Decisiones abiertas
- **React Compiler (`experiments.reactCompiler: true` en `app.json`, heredado del template): decisión del usuario: activo; ver LEARNING.md Bloque H. Este plan no cambia `app.json`.** Impacto: (1) memoiza automáticamente y **enmascara los renders innecesarios** que el material quiere enseñar a detectar; (2) **omite en silencio** los componentes que incumplen las reglas de React (p. ej. temporizadores o *callbacks* de `FlatList` guardados en `ref`, como el carrusel), sin fallar el build. Recomendación: medir con Profiler/DevTools y, para demostrar el render "sin ayuda", marcar el componente didáctico con la directiva `"use no memo"`; revisar en DevTools qué componentes aparecen optimizados antes de dar por cerrado T8.
- Arranque en frío con `expo-dev-client` (T3): si el launcher lo impide, el usuario decide entre compilación Release local o cerrar la validación en el Día 5.
