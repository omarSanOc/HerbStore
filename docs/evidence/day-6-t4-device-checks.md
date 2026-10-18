# Día 6 — comprobaciones en dispositivo de T4a y T4b (revisión del reviewer, ronda 2)

Fecha: 2026-10-17. Estado: **comprobado por herramientas en Samsung SM-A037M (Android 13) y Simulator iPhone 17 Pro (iOS 26.5)**; lo visual lo confirma el usuario. Cubre: (1) «Ir a Inicio» del enlace no reconocido (T4b, los 5 puntos de `tasks.md`), (2) tema «Sistema» en caliente (T4a/RF-10), (3) S-RF24 y barra de navegación del Samsung en oscuro (T4a, D). El caso límite del carrito vive en `day-6-cart-swipe.md` §T6f.6 y los iconos/texto en caliente en `day-6-contrast-motion.md` §9.

**Entorno común.** Development Build con Metro 8081 y mock 3001 (`MOCK_LATENCY_MS=150`, `ORDER_POST_DELAY_MS=1500`) sin reiniciar; `adb reverse` 8081/3001 intacto; inglés + MXN + tema «Sistema»; carritos vacíos y sin pedidos (Mis pedidos vacío en ambos). Herramientas: Android `adb`, `A11y` (UiAutomation) para el árbol y los toques, `screencap`; iOS `axe describe-ui` (**no VoiceOver real**), `axe touch`/`axe swipe --delta 2`, `xcrun simctl openurl|io screenshot|ui`. Capturas en el directorio temporal de la sesión (no en el repositorio): Android `shots/r2-*.png`, iOS `r2/ios-*.png`. Los colores se miden con un sondeo de píxeles (programa de AppKit), no a simple vista.

## 1. T4b — «Ir a Inicio» del enlace no reconocido

Los 5 puntos, tal cual los define `tasks.md` (T4b, «Incluye (Día 5, decisión del usuario)»): (1) `home-root-plan.test.ts` (`node:test`) tiene en verde los casos nuevos (Inicio en raíz, Inicio con detalle apilado, otra pestaña activa, raíz solo con `(tabs)`, raíz sin `(tabs)`) y los de RF-37, tras verlos fallar antes del cambio; (2) en Android (Samsung) e iOS (Simulator), con un producto abierto por `herbstore://product/<id>` en Inicio y después `herbstore://<ruta-desconocida>`, «Ir a Inicio» deja Inicio seleccionado en su raíz: título «Inicio», sin flecha, Atrás del sistema → launcher en Android y gesto de borde sin efecto en iOS, sin detalle ni Inicio duplicado; (3) lo mismo partiendo con la pestaña Carrito activa; (4) 0 avisos «not handled» en `ReactNativeJS`/`log stream`; (5) los 404 de producto y categoría siguen llegando a Inicio como en el Día 5.

El punto 1 es automático (ya en verde, ver `tasks.md`); aquí se ejecutan 2 a 5. Enlaces: producto existente `herbstore://product/product-261009-001` (Android) / `…-001` (iOS), desconocido `herbstore://no-existe`; 404 de producto `herbstore://product/product-261009-999`; categoría inválida `herbstore://category/BAD_ID` (un id válido pero inexistente, `category/nonexistent`, no es un 404: muestra «Category» con la lista vacía y «Go to Home»).

| Punto | Plataforma | Pasos | Observación | Resultado |
|---|---|---|---|---|
| 2 | Android | Pestaña Inicio; `am start -a VIEW -d herbstore://product/…` (título «Product»); `am start … herbstore://no-existe` | Pantalla «We couldn't find this screen» / «Link not recognized» con «Go back» y «Go to Home»; se toca «Go to Home» (`A11y`): título «**Home**», **sin** flecha («Desplazarse hacia arriba» ausente del árbol), pestaña Inicio seleccionada; **Atrás del sistema → launcher** (`mCurrentFocus` = `LauncherActivity`) en el primer Atrás (no queda detalle ni Inicio duplicado ni pantalla vacía debajo). Capturas `shots/r2-t4b-a{1-product,2-notfound,3-home}.png` | **Conforme** |
| 2 | iOS | `simctl openurl` del producto y de `no-existe` | «Go to Home» → título «**Home**», sin «Go back»; gesto de borde (`axe swipe` x 2 → 300) sin efecto (sigue «Home»). Capturas `r2/ios-t4b-{1-product,2-notfound,3-home,4-after-edge}.png` | **Conforme** |
| 3 | Android | Producto abierto en Inicio → pestaña Carrito («Your cart is empty») → `herbstore://no-existe` → «Go to Home» | Título «Home» seleccionado y sin flecha; **Atrás → launcher** (sin ninguna pantalla debajo) | **Conforme** |
| 3 | iOS | Igual (pestaña Carrito activa, 0 botones «Go back» tras el cambio) | Título «Home», sin «Go back»; gesto de borde sin efecto | **Conforme** |
| 4 | Android | `logcat -c` antes de cada enlace; `ReactNativeJS` | 0 líneas «not handled» en las cuatro secuencias (no reconocido ×2, 404 de producto, categoría inválida) | **Conforme** |
| 4 | iOS | `log stream` del proceso durante toda la sesión (4 718 líneas) | 0 «not handled»; solo ruido del sistema (AX, ATS, `focusItemsInRect`) sin relación con el router. `console.log` no sale en `log stream` (limitación conocida), `console.error`/`warn` sí | **Conforme** |
| 5 | Android | `herbstore://product/product-261009-999` y `herbstore://category/BAD_ID` → «Go to Home» | «Product not found» / «Category not found»; «Go to Home» → título «Home», sin flecha; Atrás → launcher | **Conforme** |
| 5 | iOS | Ídem | Ídem; gesto de borde sin efecto tras cada salida | **Conforme** |

Defectos: ninguno. Observación menor (no es de T4b): en el Samsung la flecha del encabezado se anuncia «Desplazarse hacia arriba» en español aunque la app esté en inglés (el texto lo pone el sistema del Samsung, no la app; ya anotado en el Día 5 como «título de Atrás»).

## 2. T4a — tema «Sistema» en caliente (RF-10)

Condición: preferencia de tema = «Sistema» (la app sigue al SO: si estuviera en «Claro»/«Oscuro» no cambiaría). Samsung: `adb shell cmd uimode night no|yes`; iOS: `xcrun simctl ui booted appearance light|dark`. Con la app abierta, sin reiniciar. Se sondeó el píxel de encabezado, fondo de página, barra de pestañas y barra de navegación en cada captura. Claro: encabezado `#FFFFFF`, página `#F6F8F5`; oscuro: encabezado `#212E25`, página `#121C15` (con una hoja abierta el fondo está atenuado por el telón: `#8E8F8D` en claro frente a `#060B08`/`#050B06` en oscuro).

| Pantalla | Android | iOS |
|---|---|---|
| Inicio | claro → oscuro: encabezado `#FFFFFF` → `#212E25`, página `#F6F8F5` → `#121C15`, barra de pestañas `#FFFFFF` → `#212E25` | idem (barra `#FFFFFF` → `#212E25`) |
| Carrito (vacío) | idem | idem |
| Cuenta | idem | idem |
| Mis pedidos (vacío) | idem | idem |
| Hoja «Sort by» (Gorhom) abierta | **cambia completa**: hoja, telón y página detrás (`#929292`/`#8E8F8D` → `#0F1710`/`#060B08`) | **cambia completa** (`#919191`/`#8D8E8C` → `#0D1510`/`#050B06`) |
| Modal del escáner (`herbstore://scanner`, pantalla previa al permiso) | encabezado `#FFFFFF` → `#212E25`, página `#F6F8F5` → `#121C15` | idem; captura oscura inspeccionada (botón «Continue» verde claro, «Close» con borde) |

**Resultado: conforme en ambas plataformas, en las 6 superficies, sin reiniciar.** Capturas: Android `shots/r2-th-and-{home,cart,account,myorders,sheet-sort,modal-scanner}-{light,dark}.png`; iOS `r2/ios-th-{home,cart,account,myorders,sheet-sort,modal-scanner}-{light,dark}.png`.

**Latencia en el Samsung (observación, no es un defecto).** La actualización tarda más que en iOS: con una espera fija de 2,5 s la captura de la hoja abierta salió todavía clara una vez (las pantallas sin hoja ya estaban oscuras a los 2,5 s); con sondeo cada ~0,7 s el cambio completo (incluida la hoja) apareció en ≲ 6 s. Se atribuye a la lentitud del equipo (A03s) y a que el cambio pasa por `AppCompatDelegate`/`uiMode`; no hay reinicio ni parpadeo permanente.

Restaurado: Samsung `cmd uimode night no`; Simulator `appearance light`.

## 3. T4a — barra de navegación del Samsung en oscuro (D) y S-RF24

**Barra de navegación (D).** Reproducida con la app en oscuro (`night yes`): la barra de tres botones del Samsung (Atrás/Inicio/Recientes) **sigue clara** (`#EDEDED` en el sondeo (14, 1576) px) mientras el encabezado y la barra de pestañas son oscuros (`#212E25`), en Inicio, Carrito, Cuenta y la hoja; en claro es `#FFFFFF`. Coincide con el diagnóstico de `plan.md`, «Decisiones de T4a» (`isAppearanceLightNavigationBars` se fija al crear la Activity). **Sin cambio: la decisión D se mantiene** (no hay API de JS ni dependencia instalada; corregirlo exigiría una dependencia o un cambio nativo, que la constitución, art. 1, descarta para esta tarea). Los iconos de la barra son oscuros sobre fondo claro (legibles); no es un defecto de contraste sino de coherencia visual. Capturas `shots/r2-th-and-*-dark.png` (borde inferior). Queda para el usuario decidir si le basta.

**S-RF24 (tap de la notificación con Inicio apilado): NO comprobado, no automatizable de forma fiable.**
- *Android:* el tap lleva el `PendingIntent` que genera `expo-notifications` al programar la notificación de un pedido; `adb shell cmd notification post` crea una notificación ajena a la app, sin ese intent ni el `data` `{ destination: 'home' }`. Sin pedido real no hay notificación que tocar, y crear un pedido deja un pedido residual en el mock y en «Mis pedidos» (se pidió no crearlos salvo necesidad). Permiso `POST_NOTIFICATIONS` concedido en el Samsung. Sin evidencia nueva.
- *iOS:* se probó `xcrun simctl push booted com.herbstore.mobile` con `{"aps":{…},"destination":"home"}` con Inicio = [Inicio, detalle] y también con la pestaña Carrito en «Delivery details». El sistema entregó `UIWillPresentNotificationAction` a la app, pero **no apareció banner** ni se registró ningún tap (el banner solo se muestra con la configuración del handler y el flujo real de un pedido; 0 líneas `tap source`). Inconcluso, no se atribuye resultado.
- *Estado:* S-RF24 sigue con la evidencia del Día 5 (`docs/evidence/day-5-platform.md`, «no se reprodujo») y el paso manual del reviewer: hacer un pedido con la app en una pestaña distinta de Inicio y un detalle apilado en Inicio, y tocar el banner. Va como pendiente del usuario.
