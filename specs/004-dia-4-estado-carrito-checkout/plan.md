# Plan 004 — Día 4: estado, carrito y checkout

## Precondiciones y límite del incremento
- Requiere catálogo/lista/RTK Query del Día 3 y órdenes mock del Día 1. No duplica productos remotos en slices. RF-2.
- Verificar compatibilidad SDK 57 antes de instalar Redux Persist, MMKV, React Hook Form, Zod, resolvers y, por necesidad del fingerprint, `expo-crypto`; usar `npx expo install`. Reanimated/Gesture Handler ya existen y se revisan sus peers.
- `expo-crypto` es dependencia adicional propuesta por necesidad demostrable: fingerprint SHA-256 sin persistir PII. Solo se instalará cuando este plan sea aprobado. Alternativa pura no criptográfica se descarta por facilitar inferencias.
- Siete checkpoints de 20–30 minutos priorizan persistencia segura → carrito → checkout → recuperación. Si el timebox de 3 horas se agota, se conserva el flujo ejecutable y se retoma el checkpoint pendiente sin relajar idempotencia ni RF.

## Archivos y responsabilidades
- `src/core/store/store.ts`: añade reducers de cliente y persistencia sin copiar RTK Query.
- `src/core/storage/mmkv-storage.ts`, `persist-policy.ts`: adapter y whitelist explícita de carrito, historial, preferencias, intento no reversible y resúmenes sin dirección. RF-11, RF-12, RF-16–RF-27, RNF-1.
- `src/features/preferences/domain/currency.ts`: conversión pura MXN/USD y formato. RF-5, RF-13.
- `src/features/cart/store/cart-slice.ts`, `cart-selectors.ts`: operaciones inmutables, cantidades, subtotal canónico, badge y umbral.
- Limpieza del andamiaje temporal del Día 2 (H-4 del registro de hallazgos del Día 2 en `LEARNING.md`): `CartDevControls` (control `__DEV__` del badge: +1, +10, restablecer), los textos i18n `cartDev.*` (es/en), `src/features/cart/cart-count-source.ts`, `use-cart-count.ts` y `CartPlaceholderScreen` se retiran. El layout de tabs solo cambia la fuente del conteo: `tabBarBadge={getCartBadge(units)}` y la etiqueta hablada con plural pasan a leer `selectCartUnits` (suma de cantidades) con `useSelector`; `getCartBadge` (`undefined` si 0, número hasta 99, `'99+'` desde 100) y sus tests no cambian. El plan 002 ya fijó que el Día 4 conecta el store sin reescribir tabs. RF-7.
- `src/features/cart/screens/CartScreen.tsx`, `components/{CartLine,SwipeToDelete,ShippingProgress,EmptyCart}.tsx`: interfaz y gestos; sustituye a `CartPlaceholderScreen`. RF-7–RF-13.
- `src/features/products/screens/ProductDetailScreen.tsx`, `components/{ProductGallery,QuantitySelector,StickyAddBar}.tsx`: detalle, stock, cantidad y add. RF-4, RF-6, RF-7.
- `src/features/checkout/domain/address-schema.ts`: reglas Zod y normalización de dirección. RF-14, RF-15.
- `src/features/checkout/domain/{canonical-order-request,fingerprint,attempt-machine}.ts`: request canónico volátil, SHA-256 y máquina pura `idle → preliminary → unresolved | terminal`; distingue terminales coherentes de respuestas inciertas. RF-16–RF-27.
- `src/features/checkout/store/checkout-slice.ts`: persiste solo key/fingerprint/status preliminary o unresolved, id/estado remoto cuando existe y resumen sanitizado; nunca form/address/request/error payload.
- `src/features/checkout/data/orders-api.ts`: discrimina POST/GET 200/202, 400 `VALIDATION_ERROR`, ambos 409, 404/410 con pareja status/code y fallos/payloads inconsistentes. RF-17–RF-27.
- `src/features/checkout/screens/{CheckoutScreen,OrderStatusScreen,OrderConfirmationScreen}.tsx`: formulario, lock, consulta/reapertura y confirmación.
- `src/features/orders/store/order-history-slice.ts`: resumen no sensible local y dedupe por order id para la notificación del Día 5/Cuenta del Día 6. RF-19, RF-25, RF-27.
- `src/features/search/store/search-history-slice.ts`: conecta las reglas del Día 3 a persistencia sin cambiarlas. RF-12.
- Rutas delgadas de detalle, carrito y checkout delegan en estas screens.
- Recursos i18n y `LEARNING.md` se amplían con todos los estados. RF-28–RF-31.

## Estado y lógica pura
- Redux de cliente: carrito, historial de búsqueda, preferencias, metadatos del intento y resúmenes de orden; RTK Query sigue como fuente remota.
- Selectors puros: `selectCartUnits`, `selectSubtotalMxn`, `selectDisplaySubtotal`, `selectShippingRemaining`, `selectCanCheckout`.
- Conversión: origen USD ×18 a canónico MXN; display USD = MXN/18; umbral siempre 800 MXN y se formatea al final. RF-5, RF-13.
- Address schema: trim; nombre ≥3; teléfono 10 dígitos; CP 5; estado/ciudad ≥2; calle ≥3; exterior requerido; interior opcional. RF-14, RF-15.
- El request enviado contiene únicamente items `{ productId, quantity }`, shippingAddress y currency; no envía totales. Antes del hash valida, aplica trim, rechaza duplicados, ordena keys recursivamente e items por productId para producir el mismo fingerprint semántico del servidor. RF-14–RF-17.
- El request canónico solo vive en memoria durante el primer submit. Antes del POST se persisten key/fingerprint/status `preliminary`; no hay id remoto ni afirmación de intento. La persistencia nunca recibe request, dirección o error payload. RF-16, RNF-1.
- `AttemptState` puro: `idle`, `preliminary`, `unresolved`, `confirmed`; eventos tipados de POST/GET aplican la matriz y rechazan liberar por un payload terminal incoherente. RF-16–RF-27.

## Flujo idempotente
1. Validar dirección/carrito, crear key/fingerprint, persistir `preliminary`, congelar request solo en memoria y bloquear controles. RF-16.
2. Primer POST + preliminary: 400 `VALIDATION_ERROR` mapea fields; 409 `OUT_OF_STOCK` refresca catálogo/carrito. Ambos eliminan preliminary, desbloquean y permiten nueva key. RF-17, RF-26.
3. POST 202 o 409 `IDEMPOTENCY_KEY_REUSED` eleva a `unresolved`; offline/timeout/5xx o terminal incoherente desde POST/GET también eleva/conserva unresolved y obliga a consultar status. RF-17, RF-18, RF-20, RF-23.
4. Si 400/`OUT_OF_STOCK` llega tarde cuando ya está unresolved, no limpia: conserva bloqueo y consulta status. RF-17, RF-26.
5. 200 confirmed desde GET/POST limpia preliminary/unresolved, vacía carrito, guarda resumen sanitizado y registra order id una vez para dedupe de notificación. RF-19, RF-25.
6. 404 `not_created`/`ORDER_NOT_CREATED` o 410 `expired`/`IDEMPOTENCY_KEY_EXPIRED` coherentes desde GET/POST limpian estado y habilitan nueva key; cualquier pareja inconsistente conserva unresolved. RF-21–RF-23.
7. Reinicio/promoción: toda key preliminary se vuelve unresolved antes de habilitar checkout y consulta status sin dirección; unresolved se conserva. RF-27.
8. Cancelar solo cierra la espera visible; unresolved sigue bloqueando y puede reabrirse. RF-24.

## Interfaz y estados
- Detalle usa datos RTK Query, galería, selector acotado y barra sticky; Share usa API estándar y deep link existente.
- Agregar actualiza badge/subtotal una vez y anima feedback con Reanimated; reduced motion conserva cambio sin traslado. RF-7, RNF-2.
- Swipe revela una acción y no compite con scroll vertical; decrementar desde uno elimina. RF-8–RF-10.
- Durante rehidratación se bloquean mutaciones; corrupción cae a estado vacío. RF-11.
- Checkout diferencia preliminary, field errors conocidos, error global accesible, unresolved pending/sin red/payload inconsistente, confirmed, not_created y expired. RF-15–RF-27.
- `VALIDATION_ERROR.fields` asocia paths conocidos a controles/líneas; paths desconocidos, ausencia de fields o mensaje general se presentan en un resumen accesible sin eco de values. RF-17.

## Android, iOS y CNG
- MMKV y cualquier dependencia nativa implican check/Doctor y recompilación de Development Build; no editar proyectos generados.
- Validar gesto horizontal/vertical, teclado/formulario, sticky CTA, share y rehidratación en Android/iOS. RF-26, RF-29.
- Haptics/notificación se reservan al Día 5; Día 4 expone eventos `productAdded`/`orderConfirmed` sin llamar APIs nativas.

## Accesibilidad, i18n y rendimiento
- Cantidad, swipe alternativo, progreso y errores exponen roles/values/messages; eliminar también está disponible por botón, no solo gesto. RNF-3.
- Todo texto y validación en es/en. RF-15, RF-28.
- Selectors evitan cálculos en render; no memoizar componentes sin medición. Animaciones usan UI thread y se eliminan con reduced motion. RNF-2.
- Persist policy y logs se revisan para demostrar ausencia de dirección/payload reversible. RNF-1.

## Decisiones y alternativas
- **Elegida:** Redux Toolkit para estado global de cliente + RTK Query remoto. **Trade-off:** configuración central. **Descartada:** Context para carrito mutable frecuente y Zustand fuera del stack.
- **Elegida:** Redux Persist + MMKV con whitelist. **Trade-off:** migración/versionado explícito. **Descartada:** persistir todo el store o cache remota.
- **Elegida:** request personal solo en memoria y SHA-256 local. **Trade-off:** tras restart no puede repetirse el POST. **Descartada:** persistir dirección, incompatible con constitución.
- **Elegida:** bloquear otra orden mientras `unresolved`. **Trade-off:** usuario espera consulta/expiración. **Descartada:** nueva key inmediata con riesgo de duplicado.
- **Elegida:** persistir `preliminary` antes del POST y promoverlo a unresolved tras restart. **Trade-off:** puede bloquear aunque el POST no llegara; 404 lo libera. **Descartada:** borrar preliminary al reiniciar, que permitiría duplicar si el servidor recibió el POST.
- **Elegida:** liberar unresolved solo con 200 o pareja 404/410 coherente. **Trade-off:** payload inconsistente mantiene bloqueo. **Descartada:** tratar todo 4xx como terminal, que perdería un intento original ante `IDEMPOTENCY_KEY_REUSED` o respuesta tardía.
- **Elegida:** retirar el andamiaje del badge en el mismo checkpoint que conecta el store (T2), dejando `CartPlaceholderScreen` solo hasta que T4 la sustituya. **Trade-off:** pierde el atajo para probar 0, 5 y 100 unidades sin pasar por el flujo real (se prueba agregando productos y con los tests de `getCartBadge`). **Descartada:** conservar los controles tras `__DEV__`, que dejarían código de prueba y textos `cartDev.*` sin uso.
- **Elegida:** Reanimated/Gesture Handler para feedback/swipe. **Trade-off:** dependencia nativa y validación dual. **Descartada:** JS-thread animation para gestos continuos.

## Verificación
- Sin Jest aún: lint, typecheck, Redux DevTools, inspección del storage, matrices manuales servidor/rehidratación y Android/iOS.
- Matriz pura/manual: preliminary inicial; 400/OUT_OF_STOCK temprano limpia; los mismos tardíos con unresolved conservan; 202/IDEMPOTENCY_KEY_REUSED eleva; 200 confirma/deduplica; 404/410 coherentes liberan; payload incoherente y offline/timeout/5xx conservan; cancel solo oculta; restart preliminary→unresolved; stock se refresca antes de pending y se considera reservado durante pending; cero PII persistida.
- Badge real: tras T2 el badge refleja el carrito persistido (0 sin badge, 5, 99, 100 → `99+` con etiqueta hablada "100 artículos"); `npm run test:logic` mantiene en verde los tests de `getCartBadge`; búsqueda en el repositorio sin `CartDevControls`, `cartDev`, `cart-count-source`, `use-cart-count` ni `CartPlaceholderScreen` al cerrar T4. RF-7.
- Inspeccionar storage y logs tras cada transición: solo key/fingerprint/status/id remoto opcional/resumen sanitizado, nunca dirección, request reversible, field values ni error payload.
- Día 6 automatizará reducers/selectors/schema/attempt machine con Jest y UI con RNTL; no instalar herramientas ahora.

## Bloque pedagógico
- Teoría antes de práctica: state boundaries, Redux flow/middleware/selectors, persistencia, UI thread/worklets, gestos, RHF/Zod e idempotencia. RF-1–RF-3.
- Analogías: Redux/UDF ↔ StateFlow/ViewModel y Observable; worklet ↔ animador UI; RHF/Zod ↔ Form state + validators; idempotency machine ↔ saga/estado transaccional.
- `LEARNING.md`: decisiones/trade-offs, ejercicio de selector o schema, 8–10 respuestas, checklist, Android/iOS y commit. RF-30, RF-31.
