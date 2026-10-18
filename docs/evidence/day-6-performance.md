# Día 6 — T6d: perfilar Home, listado y carrito (RF-16, RNF-4)

Fecha: 2026-10-17. Estado: **COMPLETA. Development Build medido en Android (Samsung) e iOS (Simulator), Release de iOS (Simulator) medido con baseline/after del único cambio conservado (C-1), «Tools» comprobado ausente en el Release (F-4) y salidas Release borradas.** Los datos en bruto (JSON por repetición, volcados de `dumpsys gfxinfo`, el recolector y los scripts) viven en el directorio temporal de la sesión (subcarpeta `t6d/`), no en el repositorio; aquí están las cifras y el método para repetirlas.

## Identificadores (de dónde sale cada definición)

| ID | Definición (fuente) | Acción en T6d |
|---|---|---|
| S-12 | «Reabrir búsqueda larga > 60 s refresca las 15 páginas» (`docs/evidence/day-5-platform.md`, línea final «Auditoría Día 6»; `plan.md`, inventario: «Reabrir búsqueda larga >60 s revalida 15 páginas»). No tiene descripción propia en `LEARNING.md` | **V** (medido) + **D** (se conserva el comportamiento) |
| G-7 | «La hoja de filtros tardó ≈2 s en abrir una vez; no reproducido» (`LEARNING.md`, Día 3, «Hallazgos de T16», «Descripción de seguimientos que solo tenían identificador») | **V** (perfilado) + **D** |
| F-4 | Foco de TalkBack salta a «Tools» en dev; confirmar sin dev client (`day-5-platform.md`; cerrado con decisión en T6a) | **V**: ausencia de «Tools» comprobada en el Release iOS (sección 5.3) |
| — release medible | Perfil en Release bloqueado por HTTP cleartext en Android (T15 del Día 3; `day-5-platform.md`, «Binarios Release») | Opción (b) del usuario: Development Build + Release iOS; Release Android = decisión escrita (`plan.md`, «Decisiones de T6d») |

## 1. Plan de medición

Condiciones comunes (idénticas en baseline y after, comprobadas antes de cada serie):

| Condición | Valor |
|---|---|
| Mock | `MOCK_LATENCY_MS=150`, `ORDER_POST_DELAY_MS=1500`, seed fija de Faker (300 productos, 60 por categoría); Metro 8081 con `EXPO_PUBLIC_API_ORIGIN=http://localhost:3001` |
| Android | Samsung SM-A037M, Development Build (Debug, Hermes), USB con `adb reverse` 8081/3001, `font_scale` 1.0, idioma inglés, MXN, tema claro, sin otras apps en primer plano |
| iOS | Simulator iPhone 17 Pro (iOS 26.5), Development Build, `content_size` `large`, español, MXN, tema claro |
| Repeticiones | 5 por superficie y plataforma, **proceso reiniciado en cada una** (`am force-stop` / `simctl terminate`); se informa mediana y [mín–máx]; una repetición con una llamada `adb`/`axe` colgada (ver «Limitaciones») se descarta y se repite |
| Datos | Caché fría (proceso nuevo); Home y listado vienen del mock; el carrito parte de las mismas 3 líneas persistidas |

Una interacción repetible por superficie:

| Superficie | Interacción | Ventanas medidas |
|---|---|---|
| Home | Carga en frío (arranque hasta `home-ready` + 6 s de reposo); después 4 deslizamientos hacia abajo de ~800 px y 4 hacia arriba, 1 s entre ellos (el último tramo hacia arriba termina en el «tirar para refrescar» de la lista) | `cold`, `scroll` |
| Listado | Con Home listo, abrir `herbstore://category/vitamins` y desplazar con swipes de ~900 px (14 en Android, 18 en iOS) hasta la página 3 (60 productos con «cargar más») | `open`, `scroll` |
| Carrito | Con Home listo, abrir la pestaña Carrito (3 líneas) y pulsar en cada línea «+», «+», «−», «−» (12 toques) | `open`, `interact` |
| G-7 | En la categoría Vitaminas, abrir 4 veces «Filtros» (3,5 s de espera) y cerrar con el fondo | tiempos por apertura |
| S-12 | Búsqueda `daily` (300 resultados, 15 páginas) cargada entera, app a segundo plano 68 s, volver a primer plano y esperar 14 s | revalidación |

Qué se mide y con qué herramienta (justificación y límites):

| Medida | Herramienta | Por qué | Límite |
|---|---|---|---|
| **Renders** | Contador temporal `t6dCount` dentro del cuerpo de cada componente (`HomeScreen`, `HomeRowItem`, `ProductSection`, `ProductCard`, `ProductListView`, `ProductGrid`, `CartScreen`, `SwipeToDelete`, `CartLine`, `ShippingProgress`, `AdvancedFiltersForm`) y peticiones `api …` | Cuenta ejecuciones de la función del componente por ventana, sin depender de la UI de DevTools | Cuenta ejecuciones, no commits; React puede descartar un render sin commit |
| **Trabajo JS de React** | `<Profiler>` de React (`onRender`: nº de commits, suma de `actualDuration`, máximo por commit) alrededor de Home, listado, carrito y el formulario de filtros | Es lo que mide React DevTools «Profiler», con salida automatizable | El Debug añade el coste de las comprobaciones de desarrollo: solo se comparan baseline y after entre sí |
| **JS thread bloqueado** | Sonda temporal: un `setInterval` de 50 ms registra cuánto se retrasa (≥ 100 ms, ≥ 250 ms, máximo) | Mide estancamientos del hilo JS sin herramientas externas | Es un indicador de bloqueo, no un perfil de CPU |
| **Cadencia de fotogramas del hilo JS** | Sonda temporal con `requestAnimationFrame`: huecos > 34 ms, > 100 ms, máximo y nº de fotogramas | Equivalente al «JS FPS» del monitor de rendimiento | Un recuento absoluto depende de la duración de la ventana: se compara también la proporción |
| **Hilo de UI (Android)** | `adb shell dumpsys gfxinfo com.herbstore.mobile reset` antes y volcado después: fotogramas, % lentos, percentiles 50/90/95/99, Missed Vsync, Slow UI thread | Medida del sistema, sin instrumentar la app; ↔ Android Studio Profiler / Layout Inspector (renderizado) | Incluye todo el proceso; el Debug es más lento que un Release |
| **Hilo de UI (iOS)** | No hay equivalente de `gfxinfo` en el Simulator. Se usa el hueco de `requestAnimationFrame` (el reloj de pantalla del Simulator corre en el Mac) y se **justifica no usar Instruments**: `xctrace` con Time Profiler sobre el Simulator mide la CPU del Mac, no la de un iPhone, y habría consumido disco (trazas de cientos de MB con 2,2 GiB libres) | ↔ Instruments «Time Profiler» / «Hitches» en un dispositivo real | **Limitación:** no hay cifra de hilo de UI en iOS; el Simulator comparte CPU con el Mac, y su carga varió entre series (ver limitaciones) |
| Tiempos de hoja (G-7) | Eventos temporales en `AppBottomSheet` (`sheet-animate-*`, `sheet-settled-*`) y en el botón (`sheet-press`) | Distingue «JS tarda en montar» de «animación» | — |

Instrumentación: todo marcado `TEMP-T6D` (`src/core/profiling/t6d-probe.tsx` y líneas sueltas en 15 archivos) y un recolector HTTP en el Mac (puerto 3099, `adb reverse` en Android) que recibe una instantánea cada 500 ms y las marcas que el script del anfitrión pone entre fases. **Está retirada** (`grep -rn TEMP-T6D src` = 0). Una copia íntegra de los archivos instrumentados queda en el directorio temporal (`t6d/instrumented/`) por si hay que repetir una medida (por ejemplo el Release de iOS).

## 2. Baseline en Development Build

### 2.1 Android (Samsung SM-A037M) — mediana [mín–máx] de 5 repeticiones

| Superficie / ventana | Renders | Trabajo JS (Profiler) | JS bloqueado | Hilo de UI (`gfxinfo`) |
|---|---|---|---|---|
| Home `cold` | `HomeScreen` 5, `HomeRowItem` 12, `ProductSection` 3, `ProductCard` 30 | 13 commits, 2 448 ms [2 422–2 967], máx. 1 818 ms | ≥ 100 ms: 9; ≥ 250 ms: 6; máx. 4 171 ms | — |
| Home `scroll` | `HomeScreen` 8, `HomeRowItem` 40 | 62 commits, 369 ms, máx. 45 ms | ≥ 100 ms: 1; máx. 107 ms; huecos rAF > 100 ms: 4 | 442 fotogramas, 60,3 % lentos, p50 32 / p90 38 / p99 61 ms |
| Listado `open` | `ProductListView` 4, `ProductGrid` 1, `ProductCard` 8 | 9 commits, 1 043 ms, máx. 343 ms | ≥ 250 ms: 3; máx. 1 341 ms | — |
| Listado `scroll` (a pág. 3) | `ProductCard` 52, `ProductListView` 4, `ProductGrid` 4 | 62 commits, 3 210 ms, máx. 170 ms | ≥ 100 ms: 27; ≥ 250 ms: 9; máx. 395 ms | 732 fotogramas, 34,0 % lentos, p50 26 / p90 48 / p99 121 ms, Missed Vsync 49 |
| Carrito `open` | `CartScreen` 1, `SwipeToDelete` 3, `CartLine` 3 | 3 commits, 575 ms, máx. 547 ms | ≥ 250 ms: 2; máx. 1 782 ms | — |
| Carrito `interact` (12 toques) | `CartScreen` 12, **`SwipeToDelete` 36, `CartLine` 36** | 36 commits, **1 770 ms**, máx. 144 ms | ≥ 100 ms: 12; ≥ 250 ms: 12; máx. 463 ms; huecos rAF > 34 ms: 42 de 213 fotogramas | 35 fotogramas, 100 % lentos, p50 53 / p90 77 / p99 97 ms |

### 2.2 iOS (Simulator iPhone 17 Pro) — mediana [mín–máx] de 5 repeticiones

| Superficie / ventana | Renders | Trabajo JS (Profiler) | JS bloqueado |
|---|---|---|---|
| Home `cold` | `HomeScreen` 6, `HomeRowItem` 12, `ProductSection` 3, `ProductCard` 30 | 15 commits, 134 ms [131–139], máx. 97 ms | ≥ 250 ms: 1; máx. 396 ms |
| Home `scroll` | `HomeScreen` 10, `HomeRowItem` 40 | 154 commits, 26 ms, máx. 3 ms | máx. 19 ms; 0 huecos > 34 ms |
| Listado `open` | `ProductListView` 3, `ProductGrid` 1, `ProductCard` 8 | 8 commits, 47 ms, máx. 20 ms | máx. 59 ms |
| Listado `scroll` | `ProductCard` 52, `ProductListView` 4, `ProductGrid` 4 | 94 commits, 198 ms, máx. 10 ms | máx. 33 ms; 2 huecos > 34 ms |
| Carrito `open` | `CartScreen` 1, `SwipeToDelete` 4, `CartLine` 4 | 3 commits, 43 ms, máx. 41 ms | máx. 91 ms |
| Carrito `interact` | `CartScreen` 12, **`SwipeToDelete` 48, `CartLine` 48** | 24 commits, **130 ms**, máx. 12 ms | máx. 34 ms; 5 huecos > 34 ms (1 713 fotogramas) |

Las cifras de Android son entre 10 y 20 veces peores que las de iOS en JS (CPU de gama baja + Debug); la **lectura útil es comparativa** (baseline contra after de la misma plataforma), nunca una cifra absoluta ni entre sistemas.

### 2.3 Observaciones que salen del baseline (sin cambio de producto)

- **Home, 8–10 renders de `HomeScreen` en el scroll** (y 40 de `HomeRowItem`): se sospechó de `useBannerRowVisibility` (un `setState` con el mismo valor por cada cambio del conjunto visible). Se probó el candidato C-3 (más abajo) y no cambió nada: la causa es que el último tramo del recorrido (deslizar hacia abajo desde el inicio) dispara el «tirar para refrescar» de Home (`GET /home` 3 veces en la ventana, `isRefreshing` cambia). Son renders legítimos.
- **Listado, `ProductCard` 52 renders para 60 tarjetas**: es 1 render por celda enlazada por FlashList al desplazar; no hay renders repetidos que quitar (coherente con T15 del Día 3: «no se conserva `memo(ProductCard)`»). El coste por commit (3 210 ms en 62 commits en Android) es del dispositivo y del Debug.
- **Carrito: cambiar la cantidad de UNA línea renderizaba las 3** (36 renders de `CartLine` para 12 toques; 12 era lo esperable). Es el único defecto con una causa clara y medible; ver C-1.

## 3. Candidatos, medidas y decisión

Regla (RF-16, `AGENTS.md`): un cambio se conserva solo si mejora al menos una medida sin empeorar otra ni romper conducta o accesibilidad. React Compiler está ACTIVO: no se añade `memo`/`useMemo`/`useCallback` sin razón medida.

### C-1 — Carrito: una fila por línea con `memo` — **CONSERVADO**

**Causa.** `selectDisplayCartLines` crea un objeto `item` nuevo por línea con cada cambio, y los callbacks `onIncrement`/`onDecrement`/`onDelete` se crean dentro de `lines.map(...)`, donde el compilador de React no puede cachearlos. Resultado: al tocar «+» en una línea se renderizaban las 3 (`SwipeToDelete` + `CartLine`).

**Cambio** (`src/features/cart/screens/CartScreen.tsx`): componente `CartLineRow = memo(...)` que recibe las piezas del item (`line` conserva su identidad en las líneas que no cambiaron; el resto son primitivos), `language` y `locked`, y despacha por sí mismo (`useAppDispatch`), de modo que **no recibe ninguna función por props**. La comprobación del bloqueo del carrito (`locked`) sigue antes de cada `dispatch`. `CartLine`, `SwipeToDelete` y los selectores no cambian.

**Test** (rojo antes, verde después): `CartScreen.rerender.test.tsx` — con 3 líneas, pulsar «Aumentar» en la segunda renderiza solo `product-261009-002`. La primera implementación (con `changeLine` como prop) falló este test: el compilador no estabilizaba el callback bajo Jest, y se descartó esa variante por la de «sin funciones por props».

| Medida (carrito `interact`, 12 toques) | Android antes → después | iOS antes → después |
|---|---|---|
| Renders `CartLine` / `SwipeToDelete` | 36 → **12** | 48 → **12** |
| Trabajo JS de React (suma `actualDuration`) | 1 770 ms [1 738–1 810] → **811 ms** [808–835] (−54 %) | 130 ms [127–131] → **101 ms** [69–106] (−22 %) |
| Máximo de un commit | 144 ms → **63 ms** | 12 ms → **10 ms** |
| JS bloqueado ≥ 250 ms | 12 → 10 | 0 → 0 |
| JS bloqueado, máximo | 463 ms → **368 ms** | 34 ms → 68 ms (ver nota) |
| Fotogramas JS entregados en la ventana | 209–218 → **284–315** | 1 710–1 716 → 869–1 178 (ventana más corta: 17,5–20 s frente a 28,4 s) |
| Proporción de huecos > 34 ms | 42/213 (19,7 %) → 47/302 (**15,6 %**) | 5/1 713 (0,3 %) → 5–12/870–1 180 (0,6–1,0 %) (ver nota) |
| Huecos > 100 ms | 12 → 12 | 0 → 0 |
| Hilo de UI (`gfxinfo`): p50 / p90 / p99 / Missed Vsync | 53 / 77 / 97 ms / 12 → 57 / 73 / 97 ms / 11 (rangos solapados) | — |
| Carrito `open` (código sin cambio de lógica) | 575 ms → 573 ms; máx. 547 → 547 ms | 43 ms → 46 ms |

**Nota iOS (honestidad sobre las condiciones).** La serie *after* de iOS se midió con el Mac bajo una carga mayor que la del baseline (promedio de carga 18 en el momento, procesos de mantenimiento del sistema y poca memoria libre); el Simulator ejecuta el JS en la CPU del Mac. Dos señales lo confirman: (a) la ventana `open`, cuyo código no cambió, empeoró en el mismo orden (mediana del bloqueo máximo 91 → 156 ms) y (b) la ventana de `interact` duró 17,5–20 s en vez de 28,4 s (los toques de `axe` se resolvieron antes). Por tanto el aumento del bloqueo máximo (34 → 68 ms) y de la proporción de huecos no se atribuye al cambio; **las cifras deterministas (renders 48 → 12, trabajo de React −22 %, commit máximo 12 → 10 ms) sí son comparables**. **Repetición con el Mac en reposo (misma sesión, `uptime` 1,5 al empezar, 5 repeticiones, Development Build, mismas condiciones salvo que los toques se hicieron con `axe touch --down --up --delay 0.1` porque `axe tap` dejó de registrarse; la ventana dura 33,3 s en vez de 28,4 s y por eso hay más fotogramas):**

| iOS Development, carrito `interact` | Baseline (`axe tap`) | After, Mac cargado (serie original) | After, Mac en reposo (repetición) |
|---|---|---|---|
| Renders `CartLine` / `SwipeToDelete` | 48 | 12 | **12** |
| Trabajo JS de React (`actualDuration`) | 130 ms [127–131] | 101 ms [69–106] | **71 ms** [70–71] (−45 % frente al baseline) |
| Máximo de un commit | 12 ms [11–13] | 10 ms [8–13] | **7 ms** [6–8] |
| JS bloqueado, máximo | 34 ms [31–46] | 68 ms [51–108] | **37 ms** [33–40] (dentro del rango del baseline) |
| Huecos > 34 ms / fotogramas | 5 / 1 713 (0,17–0,41 %) | 10 / ≈ 1 000 | 8 / ≈ 1 990 (0,30–0,56 %) |

Con el Mac en reposo la «regresión» de bloqueo máximo desaparece (37 ms frente a 34 ms: mismo orden, rangos solapados); la proporción de huecos > 34 ms queda en 0,3–0,56 % frente a 0,17–0,41 %, una diferencia pequeña que se explica por la mayor duración de la ventana y por la pulsación de `axe touch` (0,1 s pulsado), no por el código. La salvedad queda cerrada: el cambio no empeora iOS Development.

**Decisión: C (corregido).** Mejora renders, trabajo JS y bloqueo en Android; en iOS mejora renders y trabajo JS; sin regresión atribuible. Accesibilidad y conducta: los 540 tests Jest (incluidos `CartScreen`, `CartLine` y el flujo de checkout) y los 1 444 de lógica siguen en verde; las etiquetas, `accessibilityActions` y el bloqueo no se tocaron.
**Trade-off:** un componente más y un `memo` explícito que el compilador no habría añadido; una fila que despacha por sí misma (en vez de recibir `onChange`). **Descartadas:** `memo(CartLine)` a secas (no sirve: el `item` y los callbacks cambian siempre); memoizar el selector por línea (cambiaría un contrato probado y es más invasivo); pasar `changeLine` como prop (el test falló: el callback no era estable).

### C-2 — S-12: revalidar solo la primera página — **DESCARTADO** (medido y revertido)

**Qué ocurre hoy.** Reabrir la búsqueda `daily` con las 15 páginas cargadas tras > 60 s dispara `refetch()` y RTK Query vuelve a pedir las 15 páginas en secuencia, sin spinner.

| Medida (Android, 5 repeticiones, mediana [mín–máx]) | Baseline (15 páginas) | Candidato `refetch({ refetchCachedPages: false })` (2 repeticiones) |
|---|---|---|
| Peticiones `GET /products` | **15** [15–15] | 2 |
| Duración de la revalidación | 3 609 ms [3 580–3 629] | 1 177–1 218 ms |
| Elementos en la lista al terminar | **300** | **40 (la lista se encoge y se pierde el sitio del usuario)** |
| Commits del listado / trabajo JS | 8 / 175 ms [168–181] | 12 / 547–564 ms |
| JS bloqueado, máximo / ≥ 250 ms | 193 ms [175–268] / 0–1 | 427–450 ms / 1–2 |
| Huecos rAF > 100 ms | 3 | 5–6 |

**Decisión: D.** El candidato reduce las peticiones pero **rompe la conducta** (descarta las páginas 3–15 que el usuario ya había recorrido, igual que el «tirar para refrescar», que sí es una acción explícita) y **empeora** el trabajo JS y el bloqueo. Se conserva `refetch()` completo. La revalidación del baseline no bloquea la interfaz (máx. 193 ms, 3 huecos > 100 ms en 14 s) y no muestra indicador: el coste es de red (15 × (150 ms de latencia del mock + ≈ 90 ms de proceso)), no de render. **Trade-off:** más peticiones tras una ausencia larga. **Descartada también** una revalidación escalonada «las 3 primeras páginas y el resto bajo demanda» (cambia el contrato de la lista infinita de RTK Query y no hay requisito que lo pida).

### C-3 — Home: no repetir `setState` en `useBannerRowVisibility` — **DESCARTADO** (medido y revertido)

Candidato: llamar a `setIsBannerRowVisible` solo cuando el valor cambia (un `ref` con la última respuesta). Una repetición en Android (misma serie): `HomeScreen` 9 (baseline 8), `HomeRowItem` 40 (40), trabajo JS 357 ms (369): **sin mejora**. Es coherente con la causa real (el «tirar para refrescar» del final del recorrido, ver 2.3) y con que React ya descarta un `setState` con el mismo valor. Test escrito para el candidato retirado junto con el cambio (pasaba también sin el cambio: el hook ya se comportaba así). **Decisión: D (sin cambio).**

### C-4 — Listado: sin candidato

`ProductCard` se renderiza una vez por celda enlazada y `ProductListView`/`ProductGrid` una vez por página cargada: no hay renders repetidos. T15 (Día 3) ya descartó `memo(ProductCard)` sin mejora. **Decisión: D** (sin cambio).

## 4. G-7 — la hoja de filtros tardó ≈ 2 s en abrir una vez (**V + D**)

Tiempos medidos con las marcas de `AppBottomSheet` (mediana [mín–máx], 5 repeticiones × 4 aperturas):

| | Android (Samsung, Debug) | iOS (Simulator, Debug) |
|---|---|---|
| 1.ª apertura: pulsar → inicio de la animación | **1 471 ms** [1 455–1 523] | 126 ms [113–130] |
| 1.ª apertura: pulsar → hoja asentada | **1 850 ms** [1 832–1 902] | 798 ms [784–801] |
| 1.ª apertura: opciones (marcas y subcategorías) listas | 1 490 ms [1 470–1 541] | 280 ms [263–282] |
| Aperturas 2–4: pulsar → asentada | 1 110 ms [1 086–1 177] | 768 ms [753–785] |
| Render del formulario (`actualDuration`), 1.ª / 2.ª–4.ª | 434 ms [402–446] / 295 ms [279–332] | 22 ms [21–25] / 15 ms [11–19] |
| JS bloqueado en la 1.ª apertura, máx. | 509–724 ms | 46–73 ms |

**Lectura.** El «≈ 2 s una vez» **se reproduce en el Samsung en Debug**: la primera apertura tarda 1,85 s (≈ 2 s) y las siguientes 1,1 s. La causa es el trabajo del hilo JS al montar el formulario (≈ 0,3–0,4 s de render de ≈ 30 filas) y recibir las dos peticiones de opciones (`/brands`, `/categories`, 150 ms de latencia del mock cada una) antes de que la animación pueda arrancar (el JS está ocupado: 5–7 bloqueos ≥ 100 ms en la 1.ª apertura). En iOS no se aprecia (0,8 s, que es la propia animación). No es un defecto del código sino de CPU del dispositivo y del Debug; no se reproduce con el iPhone.
**Decisión: V + D, sin cambio de producto.** Candidato analizado y descartado por diseño: precargar `/brands` y `/categories` al abrir el listado reduciría la 1.ª apertura (las opciones estarían listas), pero **empeora otra medida** (2 peticiones más para quien nunca abre la hoja, contra el contrato documentado en `AdvancedFiltersSheet`: «un usuario que nunca abre la hoja no paga las dos peticiones»). Trade-off: la primera apertura en un dispositivo de gama baja en Debug es lenta. **Confirmado en Release iOS** (sección 5.2: 48 ms hasta el inicio de la animación y 0,72 s asentada, sin retraso de ≈ 2 s) y sin cifra Release en Android (decisión escrita).

## 5. Release de iOS (Simulator): REALIZADO

**Método.** Espacio: tras borrar `~/Library/Developer/Xcode/iOS DeviceSupport` (autorizado por el usuario, 5,5 GiB) el disco pasó de 2,4 a 7,9 GiB libres (≥ 4 GiB exigidos). `xcodebuild -workspace ios/HerbStore.xcworkspace -configuration Release -scheme HerbStore -destination id=<iPhone 17 Pro, iOS 26.5> COCOAPODS_PARALLEL_CODE_SIGN=true COMPILER_INDEX_STORE_ENABLE=NO ONLY_ACTIVE_ARCH=YES` con `EXPO_PUBLIC_API_ORIGIN=http://localhost:3001` (un Release inlinea la variable al empaquetar el *bundle*): solo arm64, sin tocar `ios/`, `app.json` ni `app.config.ts`. **BUILD SUCCEEDED** (el `.app` pesa 59 MB, `main.jsbundle` con Hermes, `NSAllowsLocalNetworking=true`). Para el baseline se sustituyó `CartScreen` por la versión anterior a C-1 (con la misma instrumentación) y se relanzó `xcodebuild`, que solo rehízo el *bundle*; después se restauró `CartScreen` y `git diff --stat` quedó idéntico al inicial (78 archivos, +10 352 −4 805; `grep -rn TEMP-T6D src` = 0).

**Datos.** El Release de iOS **sí carga el catálogo**: el Simulator comparte la red del Mac, ATS permite `localhost` (`NSAllowsLocalNetworking`) y Inicio llegó a `home-ready` a los 220–255 ms del arranque del JS (verificado por comportamiento: Inicio con productos, listado hasta la página 3, carrito con precios del mock). No hubo que registrar limitación de cleartext en iOS (sí en Android, decisión de `plan.md`).

**Qué cambia respecto al Development Build.** Un Release no tiene `<Profiler>` de React (en producción `onRender` no se invoca: no existe `actualDuration`), ni Dev Launcher, ni «Tools», ni comprobaciones de desarrollo. Por eso en Release se informan **renders** (contadores, deterministas), **bloqueo del hilo JS** (`setInterval` de 50 ms) y **cadencia de fotogramas JS** (`requestAnimationFrame`), pero **no** trabajo de React en ms. ↔ Android: build type `release` de Gradle (R8, Hermes optimizado, sin `debuggable`) frente a `debug`; iOS: configuración *Release* de Xcode (`-O`, bundle embebido) frente a *Debug* (bundle servido por Metro).

Condiciones: Simulator iPhone 17 Pro (iOS 26.5), `content_size` large, español, MXN, tema claro, mock con `MOCK_LATENCY_MS=150` y `ORDER_POST_DELAY_MS=1500`, stock 99, carrito de 3 líneas de 1 unidad, 5 repeticiones con el proceso reiniciado, `uptime` 1,7–2,8 durante las series. Toques con `axe touch --down --up --delay 0.1` (mismo método en baseline y after; `axe tap` no registraba).

### 5.1 Carrito (C-1): baseline contra after en Release (12 toques, mediana [mín–máx])

| Medida | Baseline (`CartScreen` anterior) | After (`CartLineRow` con `memo`) |
|---|---|---|
| Renders `CartLine` / `SwipeToDelete` | **36** [36–36] | **12** [12–12] |
| Renders `CartScreen` / `ShippingProgress` | 12 / 12 | 12 / 12 |
| JS bloqueado ≥ 100 ms / ≥ 250 ms | 0 / 0 | 0 / 0 |
| JS bloqueado, máximo | 18 ms [18–19] | 18 ms [18–20] |
| Huecos de fotograma JS > 34 ms / > 100 ms | 0 / 0 | 0 / 0 |
| Hueco máximo de fotograma JS | 19 ms [18–20] | 21 ms [18–26] |
| Retraso acumulado del temporizador (indicador grueso de CPU del hilo JS) | 6 717 ms [6 583–6 767] en 33,2 s | 5 983 ms [5 550–6 086] en 32,3 s (−11 %) |
| Carrito `open` (3 renders de línea en ambos) | bloqueo máx. 18 ms [17–32] | bloqueo máx. 31 ms [17–37] (rangos solapados; el código de `open` no cambia y es otro binario) |

Lectura: en Release no hay bloqueo ni huecos con 3 líneas ni antes ni después (el Release es ≈ 10× más barato que el Debug), así que **la única mejora medible es la de renders (36 → 12, la misma que en Debug) y un retraso acumulado algo menor**; no hay ninguna regresión atribuible. **Decisión final de C-1: CONSERVADO** (mejora renders en Debug y Release de iOS, trabajo JS en Debug de ambos sistemas y bloqueo en Android).

### 5.2 Home, listado y hoja de filtros en Release (solo after; el código no cambió)

| Superficie | Renders | JS bloqueado, máx. | Hueco máx. fotograma JS |
|---|---|---|---|
| Home `cold` (hasta `home-ready` + 6 s) | `HomeScreen` 5, `HomeRowItem` 12, `ProductSection` 3, `ProductCard` 30 (igual que en Debug) | 25 ms [24–27]; 0 bloqueos ≥ 100 ms | 34 ms [33–58] |
| Home `scroll` (4 abajo + 4 arriba) | `HomeScreen` 3, `HomeRowItem` 10 (Debug: 10 y 40) | 17 ms [17–18] | 18 ms |
| Listado `open` | `ProductListView` 3, `ProductGrid` 1, `ProductCard` 8 (igual que Debug) | 18 ms [17–37] | 36 ms [26–38] |
| Listado `scroll` (a la página 3, 60 productos) | `ProductCard` 52, `ProductListView` 4, `ProductGrid` 4 (igual que Debug) | 25 ms [17–25] | 26 ms [18–26] |
| Hoja de filtros (G-7), 1.ª apertura | pulsar → inicio de animación **48 ms** [40–65]; → asentada **717 ms** [715–749]; opciones listas 199 ms [184–200]. Aperturas 2–4: 34 ms [32–49] y 716 ms [715–732] | — | — |

Lectura: en Release iOS los renders de Home y listado coinciden con los de Debug (no hay renders repetidos que quitar), el hilo JS no se bloquea más de 37 ms en ninguna superficie y la hoja de filtros arranca en 48 ms (los 0,72 s hasta asentarse son la propia animación). **G-7 confirmado en Release iOS: no hay retraso de ≈ 2 s**; el de Android Debug sigue siendo CPU del dispositivo + Debug (sin cifra Release en Android por la decisión de cleartext). Los 10 renders de `HomeRowItem` frente a 40 de Debug se atribuyen a que en Release no hay doble render de desarrollo (no se aisló otra causa).

### 5.3 F-4: ausencia del botón «Tools» en el Release (comprobada)

Con `AccessibilityEnabled` y `ApplicationAccessibilityEnabled` a `true` en el Simulator (valor original 0, **restaurado a 0**) y la app Release relanzada, `axe describe-ui` devuelve el árbol real (168 nodos en Inicio) y **no contiene ningún nodo con «Tools»** (0 coincidencias de `tools`, sin distinguir mayúsculas, en Inicio ni en Carrito); las etiquetas de la barra de pestañas son «Inicio», «Categorías», «Carrito, 3 artículos» y «Cuenta». La captura del Release no muestra el engranaje que sí aparece arriba a la derecha en el Development Build. Se usó `axe describe-ui` (árbol de accesibilidad de iOS, la misma fuente que Accessibility Inspector) y no el Inspector gráfico. ↔ Android: sin el dev client, TalkBack no ve ese botón; sin Release de Android no hay prueba en el Samsung (decisión de T6a y `plan.md`).

### 5.4 Limpieza

- Salidas Release borradas solo dentro del DerivedData de HerbStore (`Build/Products/Release-iphonesimulator` 752 MB y `Build/Intermediates.noindex/{Pods.build,HerbStore.build,EagerLinkingTBDs}/Release-iphonesimulator` ≈ 471 MB); el DerivedData Debug se conserva (3,0 GiB). `ios/` y `android/` sin tocar.
- Development Build Debug reinstalado en el Simulator con `simctl install` del `.app` de DerivedData (sin recompilar) y arrancado con Metro 8081: Inicio y Carrito («+», «−», «Eliminar») correctos; `content_size` large; `AccessibilityEnabled` 0. En el Samsung el mismo Development Build arranca y el carrito con C-1 responde.
- Espacio libre: 2,4 GiB al empezar → 7,9 GiB tras borrar iOS DeviceSupport → 7,3 GiB con el Release compilado → **8,5 GiB** tras la limpieza.

## 6. Limitaciones y problemas del método

- **Debug distorsiona** (comprobaciones de desarrollo, Hermes sin optimizar, `SerializableStateInvariantMiddleware`); las cifras sirven para comparar baseline y after, no como cifras de usuario. El Release de Android no se mide (HTTP cleartext bloqueado, decisión en `plan.md`).
- **Llamadas colgadas.** En el Samsung, `adb shell input …` se quedó colgado de 2,5 a 15,5 minutos en varias repeticiones (el dispositivo tiene 4 GB de RAM y el proceso Debug consume ≈ 70 % de CPU en reposo con la sonda), y en iOS `axe tap` falló sin avisar con la hoja de filtros (se cambió a `axe touch --down --up --delay 0.15`, como ya dice `MEMORY.md`). Una repetición con la ventana de interacción inflada (> 15 s en carrito Android) o sin la hoja abierta se descartó y se repitió; en el carrito iOS el Mac estaba bajo carga (ver nota en C-1).
- Las sondas (temporizador de 50 ms, `requestAnimationFrame`, instantáneas cada 500 ms) cuestan CPU, pero son las mismas en baseline y after.
- La «segunda» serie de Home y las de listado (baseline) se tomaron antes de añadir los contadores de peticiones y de hoja a la sonda; no afectan a lo medido en cada ventana.
- No hay cifra de hilo de UI en iOS (ver tabla de herramientas).
- **Release iOS:** sin `<Profiler>` (no existe en producción) no hay trabajo de React en ms; el Release de Android no se mide (cleartext); el Simulator no representa la CPU de un iPhone. La serie *after* de Release se midió antes que el baseline (primer `xcodebuild`), ambas con el Mac en reposo (`uptime` ≈ 2). `axe tap` dejó de registrarse en esta pasada y se cambió a `axe touch --down --up --delay 0.1`; el baseline original de Development usó `axe tap`.
- Un fallo de los guiones de repetición (la variable `i` del bucle se pisaba con la de `i_home_run`/`i_list_run`) se detectó y se repitieron esas series; no hay datos mezclados.

## 7. Cómo repetirlo (RNF-4)

Plataforma y condición: ver la tabla del plan. Pasos: (1) mock con `MOCK_LATENCY_MS=150 ORDER_POST_DELAY_MS=1500`, Metro con `EXPO_PUBLIC_API_ORIGIN=http://localhost:3001`; (2) restaurar la instrumentación; (3) recolector en el puerto 3099 (+ `adb reverse tcp:3099 tcp:3099` en Android); (4) una función `*_run` por superficie (reinicia el proceso, espera `home-ready`, pone marcas, ejecuta la interacción con `adb`/`axe` y vuelca las ventanas con `analyze.mjs`); (5) cinco repeticiones y `aggregate.mjs` para la mediana y el rango. Observación y resultado: tablas de las secciones 2–4.

## 8. Analogías (Android/Kotlin y iOS/Swift)

| Concepto en React Native | Android (Kotlin/Compose) | iOS (Swift/SwiftUI) |
|---|---|---|
| `<Profiler onRender>` / React DevTools Profiler (commits y `actualDuration`) | Layout Inspector con «recomposition counts» | Instruments «SwiftUI» (view body updates) |
| Hilo JS bloqueado (retraso de un `setInterval`) | `StrictMode` / Android Studio Profiler: hilo principal bloqueado | Instruments «Time Profiler»: hilo principal |
| `dumpsys gfxinfo` (percentiles, fotogramas lentos) | `gfxinfo` / Perfetto / «Profile GPU Rendering» | Instruments «Hitches» / Core Animation |
| `memo(Row)` con props estables | `LazyColumn` con `key` y parámetros estables (la fila se salta) | `ForEach` con `Identifiable` + vista `Equatable` |
| Compilador de React (memoriza dentro del componente, no en callbacks de `map`) | Compilador de Compose (omite composables con parámetros estables) | SwiftUI compara dependencias del `body` |
