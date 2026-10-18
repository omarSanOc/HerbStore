# Día 6 — evidencia de «eliminar una línea deslizando» (RF-24 a RF-32)

Spec: `specs/006-dia-6-calidad-entrevista/spec.md` (RF-24 a RF-32, HU-5). Plan: `plan.md`, «Decisiones de T6e y T6f». Esta evidencia se construye en dos tareas:

- **T6e (esta sección, 2026-10-17): pruebas automáticas, spike de Maestro y escenario `cart-swipe-delete.yaml`** (RF-30, RF-31; verifica RF-25 a RF-28).
- **T6f (2026-10-17, §«T6f» al final): matriz manual de los 8 casos de RF-32** en Samsung SM-A037M y Simulator iPhone 17 Pro, y dos defectos corregidos con test (el «Eliminar» revelado se partía con texto grande; «−» sobre una unidad sin guardia contra el doble toque).

## Estado de T6e

| Parte | Resultado |
|---|---|
| Jest/RNTL, es y en, sin arrastre | `SwipeToDelete.test.tsx` (9) y `CartScreen.test.tsx` (+26): en verde; cada comprobación nueva se vio fallar con una mutación temporal revertida (§2) |
| Los cinco puntos de verificación | (a) conforme, (b) conforme, (c) conforme, (d) conforme por construcción, (e) **nota para T6f**; además **un defecto REAL no previsto** (doble toque), corregido con test (§3) |
| Spike de Maestro | **Conducible en iOS Simulator y en el Samsung**; `cart-swipe-delete.yaml` verde 3 veces seguidas en cada plataforma (§4) |
| Código de producto tocado | `CartScreen.tsx` (guardia de eliminación compartida); `SwipeToDelete.tsx` NO se toca |

## 1. Jest: qué se comprueba y por qué sin arrastre

El `ReanimatedSwipeable` REAL monta en Jest y deja su acción derecha siempre montada (opacidad 0 mientras la fila está cerrada). Por eso no hace falta simular el arrastre ni un mock de la biblioteca: la acción, sus banderas de accesibilidad y el estado `enabled` del gesto son observables. La única costura es un `jest.spyOn(Gesture, 'Pan')` que sigue llamando a la implementación real y deja leer la configuración del `Pan` (`config.enabled`, `config.activeOffsetXStart`). **No se invoca ningún worklet a mano** (probaría un mock, no el gesto): el arrastre real (distancia de activación, umbral de suelta, velocidad) lo ejercen Maestro (§4) y las manos (T6f).

`SwipeToDelete.test.tsx` (es y en): la acción revelada está montada pero oculta al lector (`accessibilityElementsHidden` en el marco + `importantForAccessibility="no-hide-descendants"`) y la fila sigue visible; pulsarla pide eliminar exactamente una vez; con `disabled` el `Pan` queda `enabled: false`, la acción `disabled` e inerte; una fila ya montada pasa de `enabled` a no y de vuelta con `disabled`; el `Pan` solo se activa tras 24 pt hacia la izquierda (`activeOffsetXStart = -24`, por encima de los 20 dp/pt de RF-24/RF-32 y con `touchAction: pan-y`, así que el desplazamiento vertical sigue siendo del `ScrollView`, RF-26); el objetivo táctil de la acción mide ≥ 48 y su marco ≥ 48.

`CartScreen.test.tsx` (es y en, carrito de 3 líneas con cantidades distintas): cada línea ofrece UNA acción de eliminar al lector con el nombre del producto (3 botones visibles, 3 acciones reveladas montadas y ninguna en el árbol accesible; objetivo ≥ 48); el botón de la línea primera, intermedia y última elimina solo esa, deja las otras con su cantidad y orden y recalcula el título («2 productos»), las unidades y el subtotal; la acción revelada de la línea intermedia hace lo mismo; la última línea deja el estado vacío con «Continuar al checkout» deshabilitado y «Ir a Inicio»; en MXN y en USD el subtotal, el envío gratis y el progreso se recalculan, y **cruzar 800 MXN hacia abajo se decide por el valor canónico**: 799,99 MXN se muestra como `$44.44`, la misma cifra que el umbral, y aun así «Agrega $0.01 para obtener envío gratis»; bloqueo (RF-27) por los DOS caminos, ver §3(d). Corrección de una prueba heredada: en inglés buscaba «Remove …» (el recurso dice «Delete …»), así que «no hay botón Eliminar con el carrito bloqueado» pasaba por vacío; ahora usa el nombre real e incluye los elementos ocultos.

## 2. Mutaciones (cada comprobación nueva falla sin su razón de ser)

Mutación temporal sobre `SwipeToDelete.tsx` o `CartScreen.tsx`, copia previa fuera del repo, restauración comprobada con `shasum` (idénticos).

| Mutación | Pruebas que fallan |
|---|---|
| Quitar `accessibilityElementsHidden` | 2 (RF-28 es/en) |
| Quitar `importantForAccessibility` | 2 (RF-28 es/en) |
| `enabled` siempre verdadero | 3 (RF-27: `disabled` en es/en y fila ya montada) |
| La acción revelada sin `disabled` | 3 (los mismos) |
| Eliminar «por índice vivo» (la línea que ocupa el lugar 1) | 7 (primera/última línea y eliminar la última en es/en, y el «Eliminar» heredado) |
| Quitar la pantalla de bloqueo de `CartScreen` | 6 (RF-27 con filas montadas, y los dos bloqueos de T3a, en es/en) |
| `dragOffsetFromRightEdge` 24 → 10 | 1 (umbral de activación) |
| `minHeight` de la acción 48 → 40 | 1 (objetivo táctil) |
| Quitar la guardia del doble toque (§3) | 4 (visible/revelada × es/en; fallan ANTES de corregir) |

## 3. Los cinco puntos de verificación

| # | Punto | Resultado | Evidencia |
|---|---|---|---|
| a | Acción siempre montada (opacidad 0 cerrada) | **Conforme** | Jest la encuentra con `includeHiddenElements` sin arrastrar. Riesgo: que un toque en la fila CERRADA caiga en la acción invisible. Control en el escenario de Maestro (§4): un toque en el punto de la acción con la fila cerrada no elimina nada, en iOS y Android; la fila de contenido queda encima y recibe el toque |
| b | Maestro no ve la acción por texto | **Conforme (como previsto)**: se toca por porcentaje, decisión de `plan.md` | La acción está fuera del árbol que leen XCTest y UI Automator (RF-28). Se alcanza con `tapOn: point` tras un `swipe`. Es la única excepción a «sin coordenadas» de `.maestro/README.md` |
| c | La velocidad decide al soltar (`translationX + 0.05·velocityX`) | **Conforme** | Decisión de `plan.md`: todo gesto se fija con duración (600 ms) y se registra. Con 192-201 dp/pt de recorrido a 600 ms abrió en las 15 ejecuciones del spike (iOS 8, Samsung 7; 3 con `swipe` sobre elemento y 12 con recorrido explícito). El umbral exacto (80 dp/pt, medio camino) y la sensibilidad a la velocidad se miden en T6f |
| d | `enabled={false}` no cierra una fila ya abierta (¿RF-27?) | **Conforme por construcción; sin cambio de código** | `CartScreen` sustituye TODO el árbol por la pantalla de bloqueo cuando `selectIsCartLocked` es verdadero: las filas se desmontan y con ellas su acción revelada (y su estado abierto). Jest: con tres líneas montadas, `attemptSubmitted` deja 0 botones de eliminar, visibles u ocultos, y las 3 líneas intactas; en la pantalla de restauración y en la de intento sin resolver, 0 botones incluso ocultos. `enabled`/`disabled` de `SwipeToDelete` queda como defensa en profundidad y está probado. Falta solo la observación en dispositivo (T6f, «Bloqueo en dispositivo») |
| e | Ancho fijo de 112 puede partir «Eliminar» con texto muy grande (RF-29) | **Nota para T6f (no medido aquí)** | En código: marco de 112 con 8 de relleno izquierdo y `paddingHorizontal` 16 en la acción dejan **72 de ancho de texto**; «Eliminar»/«Delete» en `label` (16 pt, 600) con tope `actionLabel` = 2 mide ≈ 56/45 a 1.0 y ≈ 112/90 a 2.0, así que a Android 2.0 / iOS AX5 (y quizá desde 1.3-1.5 en español) probablemente se parte «Elimina-r». T6f lo mide con capturas; si se confirma, corrección mínima (`minWidth` en lugar de `width` y/o menos relleno) con antes/después |

### Defecto REAL hallado: un doble toque borraba también la línea siguiente (RF-25)

- **Qué pasó.** En el spike (iOS Simulator, iPhone 17 Pro), `tapOn: point` con `repeat: 2` y `delay: 50` sobre el botón «Delete» de la primera línea de un carrito de 2 líneas dejó el **carrito vacío** (captura de la sesión): el primer toque elimina la línea A, la lista se redibuja, la línea B sube BAJO el dedo y el segundo toque pulsa SU «Delete». Es exactamente el caso límite de la spec («SI el cliente toca dos veces seguidas «Eliminar», ENTONCES se elimina una sola línea y no la que ocupe su lugar») y RF-25 («una sola vez aunque el toque se repita»). Con la acción revelada pasa algo parecido si la línea que sube cae en un botón.
- **Por qué no lo veía Jest antes.** `fireEvent.press` sobre un elemento ya desmontado no hace nada, así que «pulsar dos veces el mismo botón» pasaba por vacío (el primer intento de esa prueba lo era). El modelo fiel del segundo toque es pulsar el control que ahora ocupa ese lugar (el de la línea siguiente).
- **Corrección mínima.** `CartScreen` crea UNA guardia propia de eliminación (NO es `useNavigationLockout`: es un `useRef` síncrono, `removalLocked`, más un `setTimeout` de `NAVIGATION_LOCKOUT_MS` = 500 ms; `useNavigationLockout` solo lo usa `navigate`, el «Continuar», y es una instancia distinta: pulsar «Eliminar» no bloquea «Continuar»). **Por qué un ref síncrono:** el segundo toque nativo puede llegar antes de que React confirme (commit) la lista nueva; un estado, o la identidad de la fila pulsada, ya no sirve porque la fila se desmonta o se sustituye y la siguiente sube bajo el dedo. La guardia se pasa a cada `CartLineRow` como prop; `remove` ejecuta `lineRemoved` dentro de ella: tras una eliminación se ignoran otras 500 ms (`NAVIGATION_LOCKOUT_MS`, el doble toque medido en el Día 5 es de ~100 ms). La guardia es una función estable, así que el `memo` de `CartLineRow` no cambia de comportamiento; `CartScreen.rerender.test.tsx` (RF-16) sigue en verde. **Trade-off:** dos eliminaciones deliberadas en menos de 0,5 s (de líneas distintas) se convierten en una, la segunda se ignora sin aviso. **Descartado:** (i) deshabilitar visualmente los botones 0,5 s (cambia el aspecto y el lector anunciaría estados); (ii) quitar la animación de reflujo (no hay animación: el reflujo es inmediato); (iii) pedir confirmación o deshacer (fuera de alcance por la spec).
- **Prueba.** Cuatro casos (botón visible y acción revelada × es/en) fallaron antes y pasan ahora; tras 500 ms (reloj falso) el siguiente toque vuelve a funcionar.
- **Verificación en dispositivo con la corrección.** El mismo `tapOn` doble (50 ms) sobre «Delete» de la primera línea de 2: **iOS 1 línea restante** (antes: 0), **Samsung 1 línea restante**. No se reprodujo el «antes» en el Samsung (no se revirtió el código allí).
- **Observación NO tratada en T6e (SUPERADA en T6f: ver D-2, «−» quedó protegido con la misma guardia):** «−» sobre una línea de 1 unidad también la elimina («Reduce una unidad; si queda una, elimina el producto»), así que un doble toque ahí puede reducir o eliminar la línea siguiente. La spec solo habla de «Eliminar»; no se tocó. Pregunta pendiente para el usuario.

## 4. Spike de Maestro (RF-31)

Entorno: Maestro 2.11.0, Java 25, iPhone 17 Pro (iOS 26.5, `large`), Samsung SM-A037M (Android 13, 720×1600 a 300 dpi = 384 dp de ancho, font_scale 1.0, animaciones 1.0). Metro en 8081 y mock en 3001 (`MOCK_LATENCY_MS=150`, `ORDER_POST_DELAY_MS=1500`), sin reinicios. El escenario no crea órdenes, así que no exige mock fresco.

- **¿Se puede conducir el swipe?** **Sí en las dos plataformas.** `swipe: start: "90%,28%" end: "40%,28%" duration: 600` activa el `Pan` de RNGH y deja la fila abierta (captura del Simulator: tarjeta desplazada y acción verde «Delete» de 112 al lado). También funcionó `swipe: from: <texto>, direction: LEFT` (probado en iOS); se prefiere el recorrido explícito porque fija la distancia (50 % del ancho = 201 pt / 192 dp) y es la que se registra.
- **¿Se puede tocar la acción revelada?** **Sí, solo por punto**: `tapOn: point: "83%,28%"`. No hay selector por texto (RF-28; §3b). El 28 % de alto cae dentro de la primera línea en ambas plataformas (≈ 20-43 % en el iPhone, ≈ 16-40 % en el Samsung, a tamaño de texto normal) y el 83 % de ancho cae dentro de la acción abierta (≈ 70-96 %). Si cambian el tamaño de texto, el nombre del producto (alto de la tarjeta) o el dispositivo, hay que revisar esos dos valores.
- **Control incluido en el escenario:** antes del swipe, el mismo punto con la fila cerrada no elimina nada (`2 products in your cart`, «Delete <A>» y subtotal 736,80 intactos). Demuestra que el swipe es lo que abre la acción y que el toque no cae en un botón visible.
- **Resultado esperado (aserciones por texto):** «1 product in your cart», sin «Delete Evening Magnesium Powder», con «Delete Garden Protein Capsules» y `Cart subtotal: MX$285.90` (y sin `MX$736.80`).
- **Anotaciones técnicas:** `swipe` solo acepta puntos y duración literales (con variable de `env` falla el análisis: «Parsing Failed»), por eso van escritos en el paso; `tapOn: point` sí admite `${…}`. `tapOn` con `repeat`/`delay` admite puntos pero no resuelve texto en el segundo toque.

### Ejecuciones con el YAML y el código finales (corrección del doble toque incluida)

| Plataforma | Ejecución | Duración | Resultado |
|---|---|---|---|
| iOS Simulator | 1.ª / 2.ª / 3.ª consecutivas | 46,05 s / 45,67 s / 45,78 s | **VERDE x3** |
| Samsung SM-A037M | 1.ª / 2.ª / 3.ª consecutivas | 104,33 s / 102,72 s / 100,37 s | **VERDE x3** |

Antes de esas series hubo otras 6 ejecuciones verdes de versiones previas del YAML (iOS 3, Samsung 1 + 3), sin fallos de la aplicación. **Incidente de herramienta (no del escenario):** una serie en el Samsung falló 3 veces seguidas con `Maestro Android driver did not start up in time` / `Device server died … UNAVAILABLE` (el driver de Maestro en el dispositivo); `adb kill-server` lo resolvió pero **borra los `adb reverse`** y la siguiente ejecución falló en `Continue|Search products` (Metro inalcanzable) hasta restaurar `adb reverse tcp:8081 tcp:8081` y `tcp:3001 tcp:3001`. Lección: tras `kill-server`, repetir los dos `reverse`.

## 5. Estado de los dispositivos tras T6e

Carritos vaciados desde la app (Simulator y Samsung); ambos con inglés + MXN (lo fija `fresh-app.yaml`; el tema queda en Sistema). **`clearState` borró preferencias, historial y pedidos locales previos del Samsung** (que tenía ≥ 3 pedidos) y del Simulator; T6f no los necesita. Ajustes del sistema sin cambiar (`stay_on_while_plugged_in` sigue en 3: se restaura en T8; `font_scale` 1.0, animaciones 1.0, Simulator en `large`). Sin procesos de Maestro en marcha. Metro y mock siguen como estaban.

## 6. Analogías

`ReanimatedSwipeable` ↔ `SwipeToDismissBox` (Compose) y `.swipeActions` (SwiftUI/UIKit `UISwipeActionsConfiguration`); `activeOffsetX` 24 ↔ touch slop / `UIPanGestureRecognizer`; acción oculta al lector ↔ `Modifier.clearAndSetSemantics {}` / `.accessibilityHidden(true)`; Maestro `swipe` ↔ `UiDevice.swipe` (UI Automator) y `press(forDuration:thenDragTo:)` (XCUITest); la guardia de doble toque ↔ `debounce`/`launchSingleTop` en Compose y un `Button` que se ignora mientras `isBusy` en SwiftUI; el reflujo de la lista que pone otra fila bajo el dedo es el mismo problema que el `LazyColumn` sin `key` estable al borrar.

---

## T6f — matriz manual de RF-32 (2026-10-17)

**Resultado: los 8 casos de RF-32 conformes en Android e iOS tras corregir DOS defectos** (§T6f.4): (1) con texto ampliado el «Eliminar» revelado se partía («Dele / te») por el ancho fijo de 112, lo que incumplía RF-29; (2) «−» sobre una línea de una unidad, que también elimina la línea, no tenía la guardia contra el doble toque (hallazgo de T6e, decisión del usuario: «Confirmar y proteger «−» en T6f»). Hallazgo no corregido, a decidir por el usuario: el margen del umbral de 80 dp/pt es de 0-5 dp/pt en arrastres lentos (§T6f.3).

### T6f.1 Entorno, método y herramientas (RNF-4)

| | Android | iOS |
|---|---|---|
| Dispositivo | Samsung SM-A037M, Android 13, 720 × 1600 px a 300 dpi = **1,875 px/dp** (384 × 853 dp) | Simulator iPhone 17 Pro, iOS 26.5, 402 × 874 pt a 3x |
| Condición | Development Build, Metro 8081 y mock 3001 (`MOCK_LATENCY_MS=150`, `ORDER_POST_DELAY_MS=1500`; **9000 solo en el caso 6**, después reiniciado con 150/1500), mock reiniciado antes de empezar; inglés + MXN (`fresh-app` hace `clearState`) | ídem |
| Carrito de 3 | Evening Magnesium Powder 450,90 ×1 · Garden Protein Capsules 285,90 ×2 (571,80) · Herbal Balance Tablets 464,90 ×1; subtotal **1 487,60** (sembrado con Maestro: `clearState`, tres enlaces `herbstore://product/…`, «+» sobre Garden). Para el caso 4 se subió Evening a ×2 (**1 938,50**) | ídem |
| Gesto | `adb shell input swipe x1 y x2 y <ms>` con px = dp × 1,875 (80 dp = 150 px; 20 dp = 38 px), línea 1 en y = 450 px, inicio x = 680 px; mitad de camino también con `input motionevent DOWN/MOVE/UP` | `axe swipe --start-x/--end-x … --duration <s> --delta 2` con pt, línea 1 en y = 240 pt, inicio x = 370 pt |
| Observación | `screencap` + comparación píxel a píxel con una captura base de la fila cerrada (0 px distintos = cerrada, idéntica) y sonda sobre el verde de la acción (`#176B45`); árbol con la herramienta `A11y` (UiAutomation); TalkBack real para el caso 7 | `simctl io screenshot` con la misma comparación y sonda; árbol con `axe describe-ui` (**«no VoiceOver real»**; exige `AccessibilityEnabled`/`ApplicationAccessibilityEnabled` = 1 y relanzar la app, y Maestro los devuelve a 0 al terminar) |
| Carga del Mac | iOS: `uptime` entre 2 y 16 durante la sesión (Spotlight `mds_stores` al 145 % de CPU, ajeno al proyecto); el criterio «< 3» no se cumplió de forma sostenida. Los resultados se repiten con 3 ejecuciones y no cambian con la carga | |

**Aviso de herramienta (iOS).** `axe swipe` con su paso por defecto (`--delta` sin indicar) recorta el gesto: con 0,6 s, 80, 90 y 95 pt NO abrían y 100 pt sí; con `--delta 1, 2, 5 o 10`, 80 pt abre. Toda la matriz iOS usa `--delta 2`. Es un artefacto del inyector (toques demasiado espaciados), no de la app; consta para que quien repita la matriz no concluya un defecto falso.

### T6f.2 Matriz de los 8 casos

Notación: «dist.» = recorrido del dedo; «dur.» = duración ordenada al inyector (medida de reloj entre paréntesis cuando importa); «cerrada» = 0 px distintos de la base. Cada gesto empieza en el borde derecho de la línea 1 salvo que se diga.

| # | Caso | Plataforma | Pasos (inicio → fin, dist., dur.) | Observación | Resultado |
|---|---|---|---|---|---|
| 1 | Abrir con ≥ 80 | Android | (680,450) → (530,450) px, **80 dp**, 600 ms, ×3; y 120 dp 600 ms | Abre en las 4. Una única acción «Delete» a la derecha, **104 × 202,7 dp** (x 264-367,5 dp), nombre completo; la fila de contenido a la izquierda; las otras líneas sin cambio; nada eliminado (3 líneas) | **Conforme** |
| 1 | | iOS | (370,240) → (290,240) pt, **80 pt**, 0,6 s, ×3; y 120 pt 0,6 s | Abre en las 4. Una acción «Delete» de **104 × 202 pt** (x 282-386 pt) con el nombre completo; nada eliminado | **Conforme** |
| 2 | No abrir con ≤ 20 | Android | (680,450) → (642,450) px, **20 dp** (38 px), 600 ms, ×3; 24 dp 600 ms; 20 dp en 50 ms (flick) | **0 px distintos** de la base en las 5: ni una franja de acción | **Conforme** |
| 2 | | iOS | (370,240) → (350,240) pt, **20 pt**, 0,6 s, ×3; 24 pt 0,6 s; 20 pt en 0,05 s | 0 px distintos en las 5 | **Conforme** |
| 3 | Soltar a medio camino | Android | 40 dp (680 → 605 px) 1 500 ms; 60 dp 1 500 ms; 70 dp 1 500 ms; **`motionevent`: DOWN (680,450), MOVE hasta (568,450) = 60 dp, mantenido 2 s, UP** | Cerrada en las 4 (0 px distintos); nada eliminado | **Conforme** |
| 3 | | iOS | 40, 60 y 70 pt en 1,5 s | Cerrada en las 3 (0 px distintos) | **Conforme** |
| 4 | Eliminar la intermedia de 3 | Android | Carrito Evening ×2 (901,80), Garden ×2 (571,80), Herbal ×1 (464,90) = 1 938,50. (680,860) → (455,860) px, 120 dp, 600 ms sobre Garden; toque en (600,980) px sobre la acción | Quedan **Evening ×2 y Herbal ×1, en ese orden**; título «2 products»; `Cart subtotal: MX$1,366.70` (= 901,80 + 464,90); envío gratis sigue (≥ 800) | **Conforme** |
| 4 | | iOS | Igual: (370,470) → (250,470) pt, 120 pt, 0,6 s sobre Garden; toque en (335,520) pt | Quedan Evening ×2 y Herbal ×1 en orden; `Cart subtotal: MX$1,366.70` | **Conforme** |
| 5 | Desplazamiento vertical sobre una línea | Android | (300,700) → (300,250) px, 400 ms, empezando sobre la línea; después con A abierta (120 dp), (640,450) → (640,250) px 400 ms **empezando sobre la acción revelada** | El contenido se desplaza; **3 líneas y 3 botones «Delete»**; al volver arriba 0 px distintos de la base; con A abierta, A sigue abierta y no se elimina nada | **Conforme** |
| 5 | | iOS | (200,450) → (200,200) pt, 0,5 s sobre una línea; con A abierta (80 pt) (330,240) → (330,120) pt, 0,5 s sobre la acción | Se desplaza (≈ 260 y ≈ 108 pt), 3 líneas; ninguna acción se abre ni se activa; A sigue abierta y tras cerrarla 0 px distintos | **Conforme** |
| 6 | Bloqueo (RF-27) con fila abierta | Android | Mock con `ORDER_POST_DELAY_MS=9000`. Fila A abierta (swipe 90 % → 40 %, 600 ms, captura `ablock-open`); desplazar a «Continue to checkout»; formulario de dirección ficticia; «Continue». A los 8 s: «Order in progress». Pestaña Carrito | Pantalla «**Unresolved order**: The cart stays locked…» con **solo** «Reopen status check»; el árbol (`A11y tree`) no contiene ningún «Delete» ni «Increase»; el rótulo de la pestaña sigue «Cart, 4 items» (1+2+1: **no se borró nada**). «Check order status» resuelve el pedido (y lo confirma, que vacía el carrito por diseño) | **Conforme** |
| 6 | | iOS | Igual (captura `block-open`: A abierta) | Mismo bloqueo; Maestro: `assertNotVisible` de «Delete.*», «Increase quantity.*» y «3 products in your cart»; insignia 4 intacta; «Cancel waiting» NO desbloquea; «Check order status» resuelve | **Conforme** |
| 7 | Botón alternativo y acción oculta al lector | Android (TalkBack real) | Fila A abierta 120 dp; `A11y stops`; después `A11y clicktext "Delete Daily Cultures Powder"` (ACTION_CLICK) | Paradas: exactamente **tres «Delete <producto>»** (150 × 90 px = **80 × 48 dp**) y ningún «Delete» sin nombre; la acción revelada (195 × 380 px) sale `NOT-IMPORTANT INVISIBLE` y NO es parada. El clic elimina solo esa línea (2 → 1) | **Conforme** |
| 7 | | iOS (`axe describe-ui`, **no VoiceOver real**) | Fila A abierta 120 pt | Tres botones «Delete <producto>» de **83 × 48 pt** y ninguno sin nombre; la acción revelada no está en el árbol. El botón elimina (casos 8 y doble toque) | **Conforme** (sin VoiceOver real) |
| 8a | Movimiento reducido | Android | Los tres `*_animation_scale` a 0 (reiniciar la app): 80 dp 600 ms, 20 dp 600 ms, 40 dp 1 500 ms; botón «Delete» de la línea 2 (la captura inmediata salió ANTES del cambio: no concluyente); después la acción de la línea restante con grabación de pantalla (`screenrecord`, fotogramas cada 0,1 s) | Abre con 80, cerrada con 20 y 40 (0 px distintos). La eliminación es **un solo cambio de fotograma** (ningún fotograma intermedio con desplazamiento a 100 ms); el resultado es el mismo que con animaciones (cartas, subtotal) | **Conforme** |
| 8a | | iOS | Reduce Motion = 1 (relanzar): 80 pt 0,6 s, 20 pt, 40 pt 1,5 s; acción de la línea 2; botón de la línea 1 con captura inmediata y otra 1 s después | Mismos resultados; la acción elimina solo Zinc (subtotal 1 375,62 con las otras tres); tras el botón la captura inmediata y la de +1 s son **idénticas (0 px)**: sin desplazamiento | **Conforme** |
| 8b | Texto ampliado | Android 1.3 / 1.5 / 2.0 | `font_scale` y espera 14 s (la actividad se recrea y vuelve a Inicio); Carrito; 80 dp 600 ms; texto de la acción medido en el árbol | **1.3** en/es: «Delete» y «Eliminar» en 1 línea (acción 104 y **108,8 dp**); **1.5** en/es: 1 línea (129 × 57 px y 166 × 57 px; acción 104 y **120,5 dp**); **2.0** en: **ANTES «Dele / te»** (texto 135 × 150 px = 2 líneas), **DESPUÉS** «Delete» en 1 línea (172 × 75 px; acción **123,7 dp**); **2.0** es: «Eliminar» en 1 línea (acción **149,9 dp**). Abre con 80 dp y se elimina con el toque en todas; el botón visible mide ≥ 48 dp | **Defecto corregido** (§T6f.4) |
| 8b | | iOS AX5 | `content_size accessibility-extra-extra-extra-large`, relanzar; (370,450) → (290,450) pt 0,6 s; 20 pt 0,6 s; 40 pt 1,5 s | **ANTES** «Dele / te» (acción de 104 pt, captura); **DESPUÉS** «Delete» en 1 línea, acción de **126 pt**, y «Eliminar» (es) en 1 línea, **148 pt**. 20 y 40 pt cerrada (0 px); 80 y 120 pt abren; el toque elimina (queda 1 línea, subtotal 654,90). Botón visible 128 × 58 pt | **Defecto corregido** |

### T6f.3 Umbral real y velocidad (punto c de T6e)

Gesture Handler cuenta el desplazamiento **desde la activación** (a los 24 dp/pt: iOS `setTranslation(0,0)` al empezar, Android `resetProgress`), de modo que con `rightThreshold = 56` el dedo debe recorrer ≈ 80. Medido con arrastres lentos (carrito de 3, mismo punto de partida):

| | 0,25-0,6 s | 1,5 s (lento) |
|---|---|---|
| Android | 70 dp cerrada · **75 dp abre** · 80 dp abre | 75 dp cerrada · **80 dp abre** |
| iOS (`--delta 2`) | 70 pt cerrada · **75 pt abre** · 80 pt abre (también 0,25 s) | 60 y 70 pt cerradas · **80 pt abre** |

- **80 dp/pt abre en todas las repeticiones salvo tres** (Android 1.0, 1.3, 1.5, 2.0 y animaciones a 0; iOS large, Reduce Motion y AX5, con `--delta 2`) y 20 dp/pt nunca (no activa el gesto), así que RF-24 y el caso límite se cumplen. Pero **el umbral exacto de un arrastre lento coincide con 80**: el margen es de 0-5 dp/pt. Las tres excepciones: en Android 2.0, las TRES primeras pasadas de 80 dp tras relanzar la app no abrieron y las 7 siguientes de 80 dp sí (no se reprodujo con 1.5 ni con 1.3); es compatible con un arrastre en el límite (o con un primer gesto absorbido tras el arranque) y no se tocó.
- **La velocidad cuenta** (`translationX + 0,05 × velocityX`): un gesto rápido abre con menos: **60 dp/pt en 100 ms abre** (Android e iOS), 40 y 50 no, y 20 en 50 ms no (no activa). Una pasada brusca que abre con menos de 80 no se considera defecto.
- **Pregunta para el usuario (no aplicada):** ¿se quiere más margen? Bajar `rightThreshold` de 56 a ≈ 40 daría ≈ 15 dp/pt de margen en 80 y conservaría «medio camino» (≈ 40) cerrado. Es una decisión de diseño que cambia el tacto del gesto y no un defecto frente al texto de RF-24 («al menos 80»); por eso no se cambió.

### T6f.4 Defectos hallados y corregidos (con test que falla antes)

**D-1. «Eliminar» revelado partido con texto ampliado (RF-29).**
- *Síntoma:* Android 2.0 e iOS AX5: «Dele / te». En español, por cálculo, también se partía desde ≈ 1.3 (a 1.3 «Eliminar» mide 76,8 dp frente a los 72 del texto; no se midió el «antes» en español); tras la corrección la acción mide 108,8 dp a 1.3 y 149,9 dp a 2.0.
- *Causa:* `actionFrame` con `width: 112` y 8 de relleno + 16 + 16 dejan 72 de ancho de texto; la etiqueta crece hasta ×2 (`fontScaleLimits.actionLabel`) y mide ≈ 92 (en) y ≈ 112 (es) a 2.0.
- *Corrección mínima:* `minWidth: 112` en lugar de `width: 112` en `SwipeToDelete.tsx` (conserva 112 a tamaño normal; con etiqueta mayor el marco crece; el umbral de apertura no cambia).
- *Test:* `SwipeToDelete.test.tsx`, «RF-29: the frame of the revealed action grows with its label instead of having a fixed width» (y el de 48 dp pasa a leer `minWidth`): **2 fallaban antes** (`width` era 112), pasan ahora. *Trade-off:* con texto muy grande la acción ocupa más ancho (149,9 dp de 384 a 2.0 en español). **Descartado:** reducir el relleno (solo gana 16 dp, y a 2.0 no basta) y fijar `numberOfLines={1}` con `adjustsFontSizeToFit` (cambia el tamaño de la etiqueta y no hay equivalente fiable en las dos plataformas).

**D-2. «−» sobre una línea de 1 unidad, sin guardia contra el doble toque (RF-25, mismo caso límite que «Eliminar»).**
- *Síntoma en dispositivo (iOS, guardia de «−» retirada temporalmente):* carrito de 4 líneas de una unidad, dos toques de 50 ms sobre «−» de la línea 1 → **quedan 2 líneas** (también desaparece la que subió). Con la guardia: 3 → solo 1 línea menos. En el Samsung no se reprodujo el «antes» (con 50 y 150 ms quedó 1 línea menos: el segundo toque llega antes de que el reflujo ponga otra fila bajo el dedo), igual que en T6e con «Eliminar».
- *Decisión (usuario):* proteger «−» con la MISMA guardia compartida (el ref síncrono de 500 ms de `CartScreen`, no `useNavigationLockout`; la ventana es única para «Eliminar» y «−» cuando elimina). *Elegida:* en `CartLineRow`, `decrement` pasa por `guardRemoval` **solo cuando la pulsación elimina** (`line.quantity <= 1`); con más unidades despacha sin guardia. *Trade-off:* tras una eliminación por «Eliminar» o por «−» se ignora otra eliminación durante 500 ms; un «−» de línea con más de una unidad justo después de una eliminación baja una unidad de la línea que subió (no destructivo, se recupera con «+»). **Descartadas:** guardar todo «−» (dos «−» rápidos sobre una línea de 3 dejarían de bajar 2 unidades) y una guardia independiente (un «Eliminar» seguido de un «−» de la línea que sube la saltaría).
- *Tests:* `CartScreen.test.tsx` (es y en): «a second tap on "−" right after it removed a one-unit line removes nothing else» y «"−" and "Delete" share the guard» (**4 fallaban antes**, pasan ahora) y «"−" on a line with MORE than one unit is never blocked (two fast taps lower two units)» (pasa antes y después: fija lo que no debe cambiar). `CartScreen.rerender.test.tsx` (RF-16, el `memo` de `CartLineRow` se conserva) sigue en verde.
- *Texto de la spec:* RF-25 solo menciona «Eliminar»; la corrección cabe en su caso límite («se elimina una sola línea y no la que ocupe su lugar»). Se deja como nota al usuario por si quiere que el RF lo diga.

### T6f.5 Doble toque tras las guardias (Maestro, `tapOn point` con `repeat: 2`, `delay: 50`, `retryTapIfNoChange: false`)

Carrito de 4 líneas de una unidad con nombres cortos (Vital Blend Softgels, Zinc Balance Tablets, Daily Cultures Powder, Whey Blend Softgels), todas de la misma altura; puntos sobre la línea 1: Android (81 %, 33 %), «−» (15 %, 33 %); iOS (82 %, 37 %), «−» (14 %, 37 %); swipe 90 % → 40 % en y 28 %/29 %.

| Plataforma | Acción revelada (2.º toque cae sobre el «Delete» de la línea siguiente) | «−» sobre 1 unidad | «Delete» visible |
|---|---|---|---|
| Android | 4 → **3** líneas, queda la 2.ª (**Conforme**) | 3 → **2** (**Conforme**) | 2 → **1** (**Conforme**) |
| iOS | 4 → **3** (**Conforme**) | 3 → **2** (**Conforme**) | 2 → **1** (**Conforme**) |

### T6f.6 Caso límite: acción abierta + otra línea (revisión del reviewer, ronda 2, 2026-10-17)

**Caso límite de la spec:** «SI una línea tiene la acción revelada y el cliente cambia la cantidad de otra línea o la elimina, ENTONCES no se elimina ninguna línea cuya acción “Eliminar” el cliente no haya tocado». No estaba en la matriz de 8 casos de RF-32 (el caso 5 solo probaba el desplazamiento vertical); se ejecutó con el mismo método de §T6f.1 (mismo Samsung y mismo Simulator, Metro 8081 y mock 3001 con `MOCK_LATENCY_MS=150`/`ORDER_POST_DELAY_MS=1500`, tema claro, inglés + MXN, texto normal).

| Plataforma | Condición | Pasos | Observación | Resultado |
|---|---|---|---|---|
| Android (Samsung SM-A037M) | Carrito de 3: L1 Magnesium Glycinate Softgels ×1 (811,90), L2 Pea Protein Softgels ×1 (451,90), L3 Meadow Blend Tablets ×1 (225,90); sembrado con enlaces `herbstore://product/<id>` y «Add to cart» (sin Maestro, sin `clearState`) | (1) `input swipe 680 450 530 450 600` sobre L1 (**80 dp**, 600 ms; se repitió una vez y la fila siguió abierta). (2) Toque en «+» de L2. (3) Toque en «−» de L2. (4) Toque en el botón «Delete» de L3 | Tras (1): acción verde (`#167C57` en el sondeo (520,300) px) a la derecha de L1; 3 líneas. Tras (2): L2 ×2, `Subtotal: MX$903.80`, L1 abierta y presente. Tras (3): L2 ×1 (`MX$451.90`), L1 abierta. Tras (4): «**2 products in your cart**»; quedan L1 (con su acción **todavía abierta**, mismo color de sondeo) y L2; `Cart subtotal: MX$1,263.80` (= 811,90 + 451,90); L3 eliminada; nada más desapareció. Capturas: `shots/r2-c3-and-{0-cart,1-open,2-plus,3-minus,4-del3}.png` | **Conforme** |
| iOS (Simulator iPhone 17 Pro, iOS 26.5) | Mismo carrito de 3 (mismas líneas e importes) | (1) `axe swipe` (370,240) → (290,240) pt, **80 pt**, 0,6 s, `--delta 2`. (2) «+» de L2 (185,537) pt. (3) «−» de L2 (57,537) pt. (4) «Delete» de L3 (327,739) pt | Tras (1): acción verde abierta (sondeo (370,190) pt = `#167C57`). Tras (2): `Subtotal: MX$903.80` en L2, L1 abierta. Tras (3): `MX$451.90`, L1 abierta. Tras (4): «**2 products in your cart**», L1 (acción **todavía abierta**) y L2; L3 eliminada. Capturas: `r2/ios-c3-{0-cart,1-open,2-plus,3-minus,4-del3,5-empty}.png` | **Conforme** |

**Lectura.** La acción revelada de L1 sobrevive a la modificación de otras líneas (la fila no se cierra sola) y **ningún cambio de L2/L3 la activa ni la dispara**: la eliminación solo ocurre con el toque sobre su propio «Eliminar». Después se tocó la acción abierta de L1 en ambas plataformas: desapareció solo L1 (queda L2, que sube a su lugar) y se vació el carrito con el botón «Delete» de L2. Carritos finales vacíos en los dos dispositivos. No se creó ningún pedido.

*Capturas en el directorio temporal de la sesión (no en el repositorio); sondeo de color con un programa de AppKit, no con la vista del usuario.*

### T6f.7 Regresión y estado de los dispositivos

- `.maestro/cart-swipe-delete.yaml` re-ejecutado con el código final: **verde** en iOS (47,7 s) y en el Samsung (102,6 s).
- Los scripts de esta sesión (sembrado de 3 y 4 líneas, doble toque, bloqueo) están en el directorio temporal de la sesión, no en el repositorio: los de `.maestro/` no cambiaron.
- **Restaurado:** Samsung `font_scale` 1.0, `animator/transition/window_animation_scale` 1.0 (verificado tras la última orden; con TalkBack activo Samsung los pone a 0.0 por sí mismo), accesibilidad (`enabled_accessibility_services` vacío, `accessibility_enabled` 0, `touch_exploration_enabled` 0), inglés + MXN, carrito vaciado desde la app, `stay_on_while_plugged_in` sigue en 3 (T8). Simulator: `content_size large`, Reduce Motion 0, `AccessibilityEnabled`/`ApplicationAccessibilityEnabled` 0, inglés, carrito vaciado desde la app; el Simulator se reinició una vez (`simctl shutdown/boot`) porque `axe` dejó de ver el árbol. Mock reiniciado con `MOCK_LATENCY_MS=150` y `ORDER_POST_DELAY_MS=1500`; Metro 8081 sin tocar; `adb reverse` 8081 y 3001 intactos.
- El caso 6 creó un pedido en el mock (`ORDER_POST_DELAY_MS=9000`, uno por plataforma) y dos pedidos locales; el mock se reinició después y los `clearState` posteriores borraron los locales.
