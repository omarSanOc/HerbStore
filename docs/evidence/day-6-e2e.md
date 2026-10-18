# Día 6 — evidencia E2E con Maestro (T5, RF-6, RF-17, RNF-1, RNF-2)

## Estado vigente (2026-10-16)

**Flujo EN VERDE en las dos plataformas.** iOS Simulator: 3 ejecuciones consecutivas con mock fresco (84-89 s) + una más tras los cambios de plataforma (94 s). **Samsung SM-A037M (Android 13): 3 ejecuciones consecutivas EN VERDE con el YAML final** (ejecuciones 22-24, 283-302 s, cada una desde `clearState` y con el mock reiniciado: stock 99 -> 98, una fila en «My orders»), precedidas por otras 4 verdes con versiones intermedias del YAML (ejecuciones 18-21). **La mutación con las TRES defensas del doble toque rotas HIZO FALLAR el flujo en iOS** (stock 97, dos órdenes; ejecución 12) y, tras restaurar el código (`cmp`/`shasum`/`git diff --stat` idénticos), el flujo volvió a VERDE (ejecución 13); la mutación no se repitió en Android (comparten YAML y la defensa es de JS, no de plataforma). Con solo dos defensas rotas seguía en verde (ejecución 9). **T5 `[x]` en iOS y Android.** Extras opcionales `product-404.yaml` y `deep-link-a-b.yaml`: verdes en las dos plataformas (ver «Extras»).

Entorno: Maestro **2.11.0** (instalado con el script oficial en `~/.maestro`, ≈345 MiB; disco libre 5,7 -> 5,3 GiB), Java 25.0.4 (funciona), iPhone 17 Pro iOS 26.5 (`<ios-simulator-udid>`, idioma del dispositivo: **español**), Development Build Debug ya instalado, Metro de la sesión (`EXPO_PUBLIC_API_ORIGIN=http://localhost:3001`, con watch) y mock con `ORDER_POST_DELAY_MS=1500`. Maestro 2.x en iOS usa su propio driver XCTest: **no necesita `idb` ni otra herramienta**. Se exportó `MAESTRO_CLI_NO_ANALYTICS=1` en los comandos (el CLI trae analíticas activas por defecto).

## Ejecuciones (RNF-4: plataforma, condición, pasos, observación, resultado)

Condición común: iOS 26.5 Simulator (iPhone 17 Pro), Maestro 2.11.0, mock con `ORDER_POST_DELAY_MS=1500` reiniciado antes de cada ejecución (stock 99), `clearState` dentro del flujo, comando `maestro --device <ios-simulator-udid> test .maestro/checkout.yaml`.

| # | Fecha (hora) | Pasos / versión del YAML | Duración | Observación | Resultado |
|---|---|---|---|---|---|
| 1 | 2026-10-16 12:52 | YAML heredado | 87 s | Tras «Continue» del Dev Menu quedaba abierto el menú completo (Reload/Go home/Tools); falla `Search products` | **ROJO** (F-1) |
| 2 | 12:54 | + cierre del Dev Menu | 41 s | «Mis pedidos» no se abre (botón bajo el pliegue); falla `You don't have any orders yet` | **ROJO** (F-2) |
| 3 | 12:55 | + `scrollUntilVisible` | 41 s | Idéntico: iOS ya lo considera «visible», no hay scroll | **ROJO** (F-2) |
| 4 | 12:56 | + `scroll` explícito | 103 s | Llega al doble toque; stock 98; falla en `Order confirmed\|Allow`: la alerta del SO está en español («Permitir») | **ROJO** (F-3) |
| 5 | 12:58 | + `Allow\|Permitir` | 373 s | La alerta de la ejecución 4 seguía en pantalla y tapaba el reset; falla en `Continue\|Search products` tras 3 reintentos de 120 s | **ROJO** (F-4) |
| 6 | 13:05 | YAML final | 84 s | Una orden (stock 99 -> 98), una fila en «My orders» | **VERDE** (1.º) |
| 7 | 13:06 | YAML final | 89 s | ídem | **VERDE** (2.º) |
| 8 | 13:08 | YAML final | 89 s | ídem | **VERDE** (3.º consecutivo) |
| 9 | ≈13:11 | **Mutación** con 2 defensas rotas | 90 s | **Siguió en verde** (stock 98): la mutación no era suficiente | verde (inesperado, ver «Mutación») |
| 10 | ≈13:13 | Código restaurado (`cmp` idéntico) | 91 s | Una orden, una fila | **VERDE** |
| 12 | 2026-10-16 14:02 | **Mutación con las 3 defensas rotas** (autorizada por el usuario) | 85 s | Llegó hasta «Order confirmed» y «1 unit»; `read-stock.js` leyó stock **97** (99 -> 97 = 2 órdenes de 1 unidad); falló el `assertTrue` («expected exactly ONE order…», «Assertion is false») | **ROJO esperado: regresión detectada** |
| 13 | 14:04 | Código restaurado (`cmp`, `shasum`, `git diff --stat` idénticos), mock fresco (99) | 90 s | Una orden (stock 98), una fila en «My orders» | **VERDE** |

### Samsung SM-A037M (Android 13, idioma del SO: español), Maestro 2.11.0

Condición común: USB, `adb reverse` 8081 y 3001, Metro de la sesión (`EXPO_PUBLIC_API_ORIGIN=http://localhost:3001`), mock con `ORDER_POST_DELAY_MS=1500` y stock 99 reiniciado antes de cada ejecución de `checkout.yaml`, `clearState` dentro del flujo, `maestro --device <android-serial> test .maestro/checkout.yaml`. Un paso de Maestro tarda ≈4-7 s en este gama baja (uiautomator): por eso el flujo dura ≈5 min (frente a ≈1,5 min en el Simulator).

| # | Fecha (hora) | Pasos / versión del YAML | Duración | Observación | Resultado |
|---|---|---|---|---|---|
| 14 | 2026-10-16 14:34 (ejecutó el usuario) | YAML de iOS, sin ramas | 3:09 | El 1.er `openLink` se perdió (45...120 s de espera), el 2.º funcionó; tras «Continue» no hay nodo `id: xmark`; «Element not found» | **ROJO** (F-6, F-8) |
| 15 | 14:47 | + rama Android del Dev Menu (`tapOn: "Close"`) y espera corta del enlace | 2:02 | Dev Menu cerrado; el 1.er enlace se volvió a perder (45 s); falla `assertVisible "My orders"`: bajo el pliegue, no existe en el árbol | **ROJO** (F-7) |
| 16 | 14:50 | + `subflows/open-my-orders.yaml` (`scroll` + `scrollUntilVisible`); solo `reset-state.yaml` | 2:09 | Reset completo en verde, pero el 1.er enlace perdido otra vez (45 s) | VERDE (reset) |
| 17 | 14:52 | + espera del lanzador («DEVELOPMENT SERVERS») antes del `openLink`; solo `reset-state.yaml` | 1:24 | Sin enlace perdido: el 1.er `openLink` funciona | VERDE (reset) |
| 18 | 14:54 | `checkout.yaml` completo | 4:37 | Una orden (stock 98), una fila; no apareció diálogo de permiso (F-10). Código de salida no capturado (salida filtrada con `tail`); todos los pasos `COMPLETED` | VERDE (sin código de salida) |
| 19 | 14:59 | ídem | 4:55 | exit 0; stock 98; una fila | **VERDE** |
| 20 | 15:04 | ídem | 4:49 | exit 0; stock 98; una fila | **VERDE** |
| 21 | 15:09 | + `fresh-app.yaml` compartido con los extras | 4:51 | exit 0; stock 98; una fila | **VERDE** |
| — | 15:18 | extra `deep-link-a-b` (con `fresh-app` sin reintento) | 1:09 | Falló `tapOn "English"`: el toque en la pestaña Cuenta tras cerrar el Dev Menu se perdió (F-9) | ROJO (extra) |
| 22 | 15:24 | **YAML final** (+ `retry` de pestaña + idioma) | 5:02 | exit 0; stock 98; una fila | **VERDE** (1.º) |
| 23 | 15:29 | YAML final | 4:43 | exit 0; stock 98; una fila | **VERDE** (2.º) |
| 24 | 15:34 | YAML final | 5:02 | exit 0; stock 98; una fila | **VERDE** (3.º consecutivo) |

**Comprobación en el iOS Simulator con los cambios de plataforma:**

| # | Fecha (hora) | Pasos | Duración | Observación | Resultado |
|---|---|---|---|---|---|
| 25 | 15:39 | YAML final, mock fresco (99) | 94 s | exit 0; stock 98; una fila. La rama iOS (`id: xmark`, «Open» opcional, `scroll` + `scrollUntilVisible` sobre un nodo ya listado) no cambió | **VERDE** |

Observaciones constantes en los verdes: el «Open» del enlace al dev client **no aparece** en el Simulator con iOS 26.5 (el `tapOn` opcional sale «WARNED» y es inocuo); `hideKeyboard` en teléfono y código postal sale «WARNED» (no cierra el pad numérico en iOS, como se preveía) y no estorba porque el campo siguiente se cierra con Enter; el doble toque se emite como «Double tap on "Continue"» (`TapRepeat(repeat=2, delay=50)`).

### Fallos y ajustes (lo que se aprendió)

- **F-1: el Dev Menu queda abierto.** En el primer arranque tras `clearState` aparece la hoja de bienvenida; al pulsar «Continue» se muestra el menú completo (Reload, Go home, Tools). Solución: tras «Continue», si hay «Go home», tocar el botón X (`id: xmark`, símbolo SF; nombre accesible «Cerrar»). En Android el menú es otro: **sin verificar**.
- **F-2: «My orders» queda bajo el pliegue y bajo la barra de pestañas.** En iOS el árbol de accesibilidad lista nodos fuera de pantalla: Maestro lo da por «visible», `scrollUntilVisible` no se mueve y el toque cae fuera. Solución: `- scroll` explícito antes del toque (inocuo en Android, donde `uiautomator` solo lista lo visible). Esto es una diferencia real iOS/Android de Maestro.
- **F-3: la alerta de permiso de notificaciones sale en el idioma del DISPOSITIVO** (español), aunque la app esté fijada a inglés. Solución: `Allow|Permitir`.
- **F-4: una alerta huérfana** (de una ejecución que falló con la alerta abierta) sobrevive y cubre el reset siguiente. Solución: al empezar `reset-state.yaml`, si hay «Don't Allow|No permitir», se descarta.
- **F-5 (cosmético): `label` de `assertTrue` no se interpola** (mostraba `${PRODUCT_ID}` literal). Los dos labels son ahora frases fijas.
- **F-6 (Android): el Dev Menu se cierra con otro selector.** Tras «Continue», Android muestra Reload / Go home / Tools y **no existe `xmark`**: el cierre es una `View` clicable (`[596,681][686,771]`) sin `resource-id` cuyo hijo tiene `accessibilityText: "Close"` (el menú del dev client va siempre en inglés). El selector de texto de Maestro también compara `accessibilityText`, así que `tapOn: "Close"` basta. Se probó solo la ruta del texto (no la tecla Back, que podría salir de la app). Rama por plataforma con `runFlow` + `when: platform: iOS|Android` (la sintaxis consta en la clase `Condition` de Maestro 2.11.0 y funcionó): el `id: xmark` de iOS queda intacto.
- **F-7 (Android): «My orders» no existe en el árbol hasta que se hace scroll.** A diferencia de iOS (F-2), `uiautomator` solo lista lo visible, por eso `assertVisible "My orders"` falló. Solución: subflujo `open-my-orders.yaml` con `scroll` + `scrollUntilVisible` (en iOS el 2.º es un no-op porque el nodo ya está listado; en Android el 1.º acerca y el 2.º termina). Se usa también en `reset-state.yaml` (el `assertVisible` previo se sustituyó por el propio toque, que ya demuestra el inglés).
- **F-8 (Android): el primer `openLink` tras `clearState` se perdía.** Con logcat: el enlace llega a `MainActivity` 60 ms después de que `launchApp` la lance, ANTES de que exista el proceso (`Start proc` 14 ms después), y la `DevLauncherActivity` que Expo abre después (≈2 s) lo traga; el 2.º enlace, con el lanzador ya en pantalla, funciona en 4 s. Solución: en Android esperar «DEVELOPMENT SERVERS» (el encabezado del lanzador) antes del `openLink`, y el `retry` queda como red de seguridad (45 s por intento, 4 intentos; antes 120 s × 3). Se ahorró ≈45-110 s por ejecución. Los enlaces con la app YA abierta (extras) no se pierden. El «Open» opcional de iOS se limita a iOS (en Android no existe y su búsqueda costaba 8 s).
- **F-9 (Android, intermitente 1 de ≈10): un toque en la pestaña «Cuenta» justo tras cerrar el Dev Menu se perdió** (Maestro dio el toque por hecho, la app siguió en Inicio y «English» no apareció). Solución: `retry` del par «pestaña + English» (tocar la pestaña activa es inocuo). Sin repetición en las 3 ejecuciones finales (ni en los extras posteriores), pero con una muestra pequeña: se deja el `retry`.
- **F-10 (Android 13): no apareció diálogo de permiso de notificaciones** en ninguna de las 7 ejecuciones completas (`expo-notifications` 57 responde `denied`+`canAskAgain` en instalación nueva y la app no lo pide en este punto). La rama `Allow|Permitir` se mantiene por si el SO lo muestra; no se pudo verificar su selector en Android.
- **F-11 (iOS, extra A→B): el Atrás nativo se alcanza por `id: BackButton`** (su etiqueta es el título de la pantalla anterior, p. ej. «Search» o «Home»); Android usa la tecla del sistema (`back`).
- `hideKeyboard` en Android (= tecla Atrás) con teclado abierto en teléfono y código postal: no abandonó la pantalla en ninguna ejecución. El doble toque sale como `Double tap on "Continue"` y dio siempre una sola orden.
- Sin cambios de producto: no hizo falta tocar `src/`. Los selectores por texto/etiqueta y los `testID` de los campos (`id: checkout-...`) funcionaron a la primera; `pressKey: Enter` cierra el teclado de los campos de texto en iOS.

## Qué comprueba el flujo (RF-6)

1. `reset-state.yaml`: el mock devuelve el stock inicial (99) del producto → si no, se niega a seguir («el mock ya tiene órdenes»); `launchApp` con `clearState`; reabre el Development Build con `exp+herbstore://expo-development-client/?url=…` (con reintento si el primer enlace se pierde y toque opcional sobre «Open»/«Continue» del Dev Menu); fija inglés; «Mis pedidos» vacío; carrito vacío (la pestaña no lleva cantidad).
2. Buscar «Evening Magnesium Powder» (un solo resultado: `1 product`), abrir el producto, «Add to cart», pestaña `Cart, 1 item`, «Continue to checkout».
3. Dirección ficticia (Ana Perez, 5512345678, 01234, Jalisco, Guadalajara, Avenida Central, 10) con teclado cerrado tras cada campo.
4. **Doble toque** en «Continue» (`repeat: 2`, `delay: 50`, sin reintento) con el POST retrasado 1,5 s: la segunda pulsación cae con la primera petición en vuelo.
5. Una confirmación («Order confirmed», «1 unit»; el POST devuelve 202 y se pulsa «Check order status»; se acepta la alerta de notificaciones si aparece).
6. **Una sola orden**, dos pruebas: (a) servidor: stock final = stock inicial − 1 (dos órdenes dejarían 97); (b) app: «My orders» tiene una fila y no una segunda.

Matriz POST del Día 4, camino feliz con UI real: pasos 2–5 (202 pendiente → consulta → confirmada). Los demás estados (409, 404/410, timeout, 503, offline, reinicio) siguen cubiertos por `attempt-machine`, `order-outcome`, thunks y RNTL (T3b); no se automatizan aquí.

## Mutación para comprobar que el flujo detecta la regresión (EJECUTADA: DETECTA con las tres defensas rotas)

Hay TRES defensas en capas contra el doble toque en «Continue»; solo rompiendo las tres el segundo toque llega a crear otra orden:

1. `CheckoutScreen.tsx` (`onSubmit`): `if (sendingLock.current) return;`.
2. `checkout-thunks.ts` (`submitOrder`): `if (state.checkoutAttempt.status !== 'idle') return {... ignored: true}`.
3. `checkout-thunks.ts` (`submitOrder`): tras `dispatch(attemptSubmitted({ key, fingerprint }))`, `if ((getState() as ThunkState).checkoutAttempt.key !== key) return {... ignored: true}` (la máquina `transitionAttempt` solo acepta `submitted` desde `idle`: si no adoptó SU clave, el thunk se ignora).

Procedimiento (ambos archivos tenían cambios sin commit de T1-T5; nada de `git stash`/`checkout`/`reset`): `git diff --stat` y `shasum -a 256` previos (56 archivos, +9690/-4562), copia de respaldo de los dos archivos fuera del repo, edición manual (las tres líneas sustituidas por un comentario), mock reiniciado con `ORDER_POST_DELAY_MS=1500` (`GET /products/product-261009-062` -> `stock: 99`), Metro de la sesión con watch (sin `CI`), `maestro --device <ios-simulator-udid> test .maestro/checkout.yaml`.

| Ejecución | Defensas rotas | Resultado | Duración | Stock observado | Órdenes (POST /orders con éxito) |
|---|---|---|---|---|---|
| 9 (≈13:11) | 1 y 2 | Verde (no detecta) | 90 s | 98 | 1 |
| **12 (14:02)** | **1, 2 y 3** | **ROJO en `assertTrue` del stock** | **85 s** | **97** | **2** |
| 13 (14:04) | ninguna (restaurado) | Verde | 90 s | 98 | 1 |

**Resultado: el flujo detecta la regresión.** Con las tres rotas la segunda pulsación de «Continue» llegó a `onPress` dentro de la ventana de 1,5 s del POST en vuelo (queda probado lo que antes solo se suponía), generó otra `Idempotency-Key` y el mock registró una segunda orden (el mock no deduplica por contenido, solo por clave): stock 99 -> 97. El flujo avanzó hasta «Order confirmed» y «1 unit» (la app muestra una confirmación) y falló justo en el `assertTrue` del servidor, con la etiqueta «FAIL: expected exactly ONE order (final stock = initial stock - 1); the mock registered a different number.». El número de POST se deduce del stock porque el mock no registra peticiones ni lista órdenes (cada orden es de 1 unidad): 99 - 97 = 2. Artefactos de Maestro (capturas y jerarquía) en `~/.maestro/tests/2026-10-16_140208`.

**Restauración verificada** (inmediata): `cp` desde los respaldos; `cmp` idéntico en ambos archivos; `shasum -a 256` idéntico (`CheckoutScreen.tsx` `a1aa9495…c327a41`, `checkout-thunks.ts` `90678cce…4067695`); `git diff --stat` idéntico (56 archivos, +9690/-4562); `grep` sin marcas de mutación en `src/`. Después, mock fresco (99) y Metro recargado por su watch: el flujo volvió a VERDE (ejecución 13, stock 98, una fila).

## Comandos para el Samsung

Los comandos de este documento usan los marcadores `<android-serial>` y `<ios-simulator-udid>` en lugar de los identificadores reales (no se versionan seriales ni UDID). Cómo obtenerlos: `adb devices -l` (primera columna) y `xcrun simctl list devices booted` (UDID entre paréntesis).

Ver `.maestro/README.md`. Resumen, desde la raíz del repo, con el Samsung por USB y desbloqueado (el Metro de la sesión ya apunta al mock; en un Metro nuevo, `EXPO_PUBLIC_API_ORIGIN=http://localhost:3001`):

```bash
export ANDROID_HOME=$HOME/Library/Android/sdk; export PATH=$PATH:$ANDROID_HOME/platform-tools:$HOME/.maestro/bin
export MAESTRO_CLI_NO_ANALYTICS=1
adb devices -l                               # anota el serial (<android-serial>)
adb reverse tcp:8081 tcp:8081; adb reverse tcp:3001 tcp:3001
lsof -ti tcp:3001 | xargs kill 2>/dev/null; ORDER_POST_DELAY_MS=1500 npm --prefix mock-server start   # terminal 1
EXPO_PUBLIC_API_ORIGIN=http://localhost:3001 npx expo start --dev-client                                # terminal 2
maestro --device <android-serial> test .maestro/checkout.yaml                                                   # terminal 3 (≈5 min)
maestro --device <android-serial> test .maestro/product-404.yaml                                                # extra (≈70 s)
maestro --device <android-serial> test .maestro/deep-link-a-b.yaml                                              # extra (≈70 s)
```

Antes de CADA ejecución de `checkout.yaml` repite el reinicio del mock (si no, `reset-state.yaml` se niega a seguir: el stock ya no es 99); los extras no lo exigen. `clearState` borra en el dispositivo: preferencias, carrito, historial de búsqueda, pedidos y el intento de checkout (en el Samsung ya se perdieron el historial «vv», el pedido `scheduled` y las preferencias English + USD + Dark; quedó English + MXN + Sistema). Estado esperado al terminar `checkout.yaml`: 1 orden (stock 98) y 1 fila en «My orders».

## Extras (opcionales, fuera de RF-6 y del flujo por defecto)

Ambos empiezan con `subflows/fresh-app.yaml` (`clearState`, Development Build, inglés, Inicio), no tocan el stock del mock y afirman lo que el usuario VE.

- **`product-404.yaml`** (≈70 s Android, ≈33 s iOS): `openLink herbstore://product/product-261009-999` -> «Product not found» + «The product does not exist or the link is not valid.» + «Go back» -> «Go to Home» -> «Search products» y sin el aviso. El id tiene forma de catálogo (`product-<6>-<3>`) pero no existe: el servidor da 404. Un id mal formado como `no-existe` iría por `product/invalid` («Invalid product»), un caso distinto que cubren `linking.test.ts` y RNTL.
- **`deep-link-a-b.yaml`** (≈74 s Android, ≈42 s iOS): A (`product-261009-062`, «Evening Magnesium Powder») abierto por enlace; el enlace a B (`product-261009-002`, «Magnesium Glycinate Softgels») lo REEMPLAZA (`dangerouslySingular`): se ve B y A desaparece; UN solo Atrás (Android: `back`; iOS: `id: BackButton`) lleva a Inicio sin mostrar A ni B (si B se hubiera apilado sobre A, Atrás revelaría A).

| Extra | Android (Samsung) | iOS (Simulator) |
|---|---|---|
| `product-404` | 73 s, 71 s, 72 s: 3 VERDES | 33 s, 32 s, 32 s: 3 VERDES |
| `deep-link-a-b` | 69 s (sin el paso Atrás), **ROJO** 69 s (F-9, antes del `retry`; no es del extra), 74 s, 74 s: 3 VERDES (2 con el paso Atrás) | 41 s, 42 s, 41 s, 42 s: 4 VERDES |

**Estabilidad del enlace al dev client (el hallazgo del primer `openLink`):** el problema es SOLO el enlace `exp+herbstore://…` justo después de `launchApp` con `clearState` en Android (F-8), no los enlaces `herbstore://product/…` con la app ya abierta: éstos llegaron al primer envío en TODAS las ejecuciones (los `retry` de los extras nunca reintentaron), sin pausas fijas. Decisión: esperar el lanzador antes del enlace al dev client (Android) y dejar `retry` + `extendedWaitUntil` sobre lo que el usuario ve en los enlaces de los extras como red de seguridad. En iOS el primer enlace nunca se perdió y el «Open» del sistema no aparece (iOS 26.5): su `tapOn` es opcional y solo en iOS.

## Candidatos heredados del Día 2 (matriz T9 de `LEARNING.md`)

No amplía RF-6: el único escenario obligatorio es el flujo crítico. Criterio: riesgo que cubre sin red de seguridad, coste y estabilidad en Maestro. **Extras automatizados: dos** (`product-404` y `deep-link-a-b`, pedidos por el usuario tras el primer verde; ver «Extras»).

| Candidato | ¿Automatizado? | Por qué |
|---|---|---|
| Tabs y badge | Parcial, incidental | El flujo exige `Cart, 1 item` (etiqueta con cantidad tras añadir) y `Cart` sin cantidad al empezar. Los límites 5 / 99+ necesitan manipular el carrito (el control de desarrollo se retiró en el Día 4, H-4) y la lógica del tope está en `node:test`. Riesgo bajo, coste alto. |
| Reselección del tab | Parcial, incidental | `reset-state` reselecciona «Account» y exige volver a la raíz (RF-37). El plan puro tiene `home-root-plan.test.ts`; «Atrás sale de la app» solo existe en Android (`back` no existe en iOS): coste alto para el valor. |
| Escáner modal | No | Exige cámara y permiso reales (el Simulator no tiene cámara); la máquina del escáner y la pantalla ya tienen `node:test` y RNTL. Sigue siendo evidencia manual (Día 5). Riesgo medio, estabilidad nula. |
| Deep links (activo y A→B) | **Sí, extra** (`deep-link-a-b.yaml`) | Es el único caso con valor real que RNTL no cubre (`dangerouslySingular` solo se probaba en dispositivo). Quedó estable porque el enlace con la app ya abierta no se pierde; lo frágil era el enlace al dev client en arranque en frío (F-8, resuelto esperando el lanzador). Arranque en frío CON enlace de producto (`initial: true`) sigue manual: el launcher del dev client lo intercepta. |
| Producto 404 | **Sí, extra** (`product-404.yaml`) | Barato y estable (≈30-70 s). RNTL ya cubre la pantalla; esto añade el `dismissTo('/')` real hacia Inicio, que antes solo se vio en dispositivo. |
| Doble toque | **Sí** | Es el corazón del flujo: «Continue» con el POST en vuelo. Otros dobles toques (tarjetas, Atrás) los cubren `navigation-lockout.test.ts` y `navigation-taps.test.tsx` y el comportamiento nativo se validó a mano en T3a. |
| Estados de Home con fixtures | No | Cada fixture exige `.env.local` y reiniciar Metro con `-c`: tiempo y fragilidad altos. `home-fixtures.test.ts` y `HomeScreen.test.tsx` cubren cada estado (loading, vacío, error, offline) por función y por pantalla. Cierra H-9. |
| Autoplay con 2 banners | No | Depende de tiempo real y de reduced motion del sistema (flaky por definición). La lógica está en `carousel-autoplay.test.ts`, `banner-pager.test.ts` y `banner-interaction.test.ts` con reloj controlado. |
| TalkBack/VoiceOver, escala de fuente, reduced motion del sistema, arranque en frío con enlace | No | Ya clasificados «no automatizables con facilidad» en el Día 2; los cubren T6a–T6c con evidencia manual/inspector. |

Los dos extras de la propuesta original quedaron creados y en verde en las dos plataformas; el flujo obligatorio sigue siendo `checkout.yaml`.
