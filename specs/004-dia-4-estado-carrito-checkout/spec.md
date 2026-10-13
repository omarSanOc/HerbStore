# Spec 004 — Día 4: estado, carrito y checkout
Estado: implementada

## Contexto y objetivo
Después de consultar el catálogo, este día completa el flujo de compra simulado desde detalle hasta orden confirmada. El objetivo es distinguir estado remoto, global y local; persistir solo la información necesaria; y aplicar animaciones, gestos, formularios e idempotencia sin duplicar pedidos ni perder un intento incierto.

## Usuarios
- Cliente ficticio que quiere revisar un producto, administrar el carrito y realizar un pedido simulado.
- Candidato que necesita defender límites de estado, persistencia, gestos, validación e idempotencia frente a alternativas comunes.

## Historias de usuario
- HU-1. Como cliente, quiero elegir cantidad y agregar un producto para preparar mi compra.
- HU-2. Como cliente, quiero modificar el carrito y recuperarlo tras reiniciar para no perder mi selección.
- HU-3. Como cliente, quiero enviar una sola orden aunque toque dos veces, haya timeout o deba reintentar.
- HU-4. Como candidato, quiero comparar Redux, Context, Zustand y modelos nativos para justificar la elección de estado.

## Definiciones
- **Fingerprint de intento:** huella no reversible del request usada para comprobar identidad sin conservar dirección ni payload recuperable en la app.
- **Intento recuperable:** entrada no sensible del historial operativo de checkout formada solo por clave de idempotencia, fingerprint, id/estado del intento y, si existe, resumen de orden sin dirección.
- **Preliminary:** estado local anterior a la confirmación de un intento en servidor; conserva únicamente key, fingerprint y estado, sin dirección ni request reversible.
- **Unresolved:** estado local no definitivo que conserva los metadatos del intento, bloquea otra orden y solo termina con confirmación, `not_created` o `expired` observables.
- **Valor canónico:** importe expresado en MXN; 1 USD equivale de forma fija a 18 MXN.
- **Historial local de pedidos:** resumen no sensible de órdenes confirmadas por esta instalación, sin dirección ni sincronización externa.

## Requisitos funcionales
- RF-1: ANTES de cada construcción guiada, EL MATERIAL presenta un bloque teórico de máximo 10 minutos sobre estado, persistencia, animación, gestos, formularios o idempotencia que se practicará después.
- RF-2: EL MATERIAL explica slices, store, acciones, selectors y middleware de Redux Toolkit; separa estado remoto, global y local; y compara Redux con Context, Zustand, UDF/MVI, StateFlow/ViewModel y modelos de SwiftUI.
- RF-3: EL MATERIAL explica React Hook Form, Zod, worklets, shared values, hilo UI, Reanimated y Gesture Handler, con equivalentes Android/iOS; para cada alternativa registra elección, trade-off y opción descartada.
- RF-4: CUANDO el usuario abre un producto existente, EL SISTEMA muestra galería, descripción, porción, precio en moneda preferida, disponibilidad, cantidad, acción fija de compra, compartir y deep link del producto.
- RF-5: CUANDO se muestra un precio de origen MXN o USD, EL SISTEMA lo convierte a la moneda preferida con la tasa fija 1 USD = 18 MXN y lo formatea según moneda e idioma; cambiar preferencia no cambia el valor canónico.
- RF-6: CUANDO el usuario cambia cantidad, EL SISTEMA la limita entre una unidad y el stock disponible y actualiza el importe convertido; intentar superar stock conserva el máximo y anuncia el límite.
- RF-7: CUANDO el usuario agrega un producto disponible, EL SISTEMA modifica una sola vez la cantidad, actualiza badge y subtotal en la misma interacción y muestra una transición que puede desactivarse con movimiento reducido.
- RF-8: CUANDO el usuario incrementa o reduce una línea, EL SISTEMA recalcula cantidades y totales sin mutación directa; reducir una línea de una unidad elimina inmediatamente esa línea.
- RF-9: CUANDO el usuario desliza lateralmente una línea, EL SISTEMA revela una única acción Eliminar; tocarla elimina la línea, mientras el desplazamiento vertical no activa la acción.
- RF-10: SI el carrito queda vacío, ENTONCES EL SISTEMA muestra un estado vacío con acción para ir a Inicio y mantiene checkout deshabilitado.
- RF-11: MIENTRAS se rehidrata el estado, EL SISTEMA muestra un estado de restauración y bloquea cambios del carrito; al terminar muestra los datos válidos o un carrito vacío si faltan o son incompatibles.
- RF-12: CUANDO la app se reinicia, EL SISTEMA restaura carrito e historial de búsqueda; el historial conserva orden, deduplicación, límite y borrados definidos el Día 3.
- RF-13: MIENTRAS el carrito contiene productos, EL SISTEMA calcula subtotal canónico en MXN, evalúa envío gratis en 800 MXN y muestra umbral y progreso convertidos a la moneda preferida; exactamente 800 MXN cumple el umbral.
- RF-14: CUANDO el usuario abre checkout con carrito no vacío, EL SISTEMA presenta nombre de al menos 3 caracteres, teléfono de exactamente 10 dígitos, código postal de exactamente 5 dígitos, estado y ciudad de al menos 2 caracteres, calle de al menos 3, número exterior obligatorio y número interior opcional, todos normalizados sin espacios extremos.
- RF-15: MIENTRAS un campo incumple RF-14, EL SISTEMA muestra su error en español o inglés y no permite enviar; errores de campos devueltos por el servidor se asocian al campo correspondiente y un error general se muestra como resumen.
- RF-16: CUANDO comienza un envío localmente válido, EL SISTEMA crea key y fingerprint, los guarda con estado `preliminary`, mantiene el request inmutable solo en memoria y bloquea cambios de dirección, carrito y nuevos envíos. El estado `preliminary` no contiene id de servidor, dirección ni body reversible y no afirma que exista un intento remoto.
- RF-17: SI la respuesta correlacionada al primer `POST /orders` es 400 `VALIDATION_ERROR` o 409 `OUT_OF_STOCK` y el estado local continúa `preliminary`, ENTONCES EL SISTEMA elimina esos metadatos, desbloquea dirección y carrito y permite corregir e iniciar con una key nueva; asigna los paths conocidos de `fields` a su control o línea y presenta los desconocidos/generales como error global accesible, sin persistir ni registrar valores. SI cualquiera de esas respuestas llega cuando la key ya está `unresolved`, ENTONCES no elimina ni desbloquea el intento: conserva `unresolved` y consulta `GET /orders/status/:key`. SI responde 409 `IDEMPOTENCY_KEY_REUSED`, ENTONCES eleva o conserva la key como `unresolved`, mantiene bloqueada otra orden y consulta el status mediante el link recibido, sin persistir error, dirección ni fingerprint remoto.
- RF-18: SI `POST /orders` termina en timeout, pérdida de conexión o 5xx, ENTONCES EL SISTEMA marca la clave `unresolved`, conserva únicamente sus metadatos no reversibles, bloquea otra orden y consulta su estado sin reenviar dirección.
- RF-19: CUANDO GET o POST responde 200 con `confirmed`, EL SISTEMA guarda el resumen sanitizado, elimina `preliminary` o `unresolved`, vacía el carrito, muestra una sola confirmación y conserva deduplicación de notificación por id de orden.
- RF-20: CUANDO GET o POST responde 202 con `pending`, EL SISTEMA eleva `preliminary` o conserva la key como `unresolved`, muestra el estado pendiente y habilita otra consulta después de `retryAfterSeconds`, sin confirmar ni permitir una orden nueva.
- RF-21: CUANDO GET o POST responde 404 con `status: 'not_created'` y `error.code = 'ORDER_NOT_CREATED'`, EL SISTEMA elimina `preliminary` o `unresolved`, libera la compra y exige reingresar dirección para crear un intento con una key nueva; no muestra ni registra la key contenida en la solicitud.
- RF-22: CUANDO GET o POST responde 410 con `status: 'expired'` y `error.code = 'IDEMPOTENCY_KEY_EXPIRED'`, EL SISTEMA elimina `preliminary` o `unresolved`, libera la compra y permite iniciar otro intento; el simple transcurso del reloj local no libera una key sin este resultado observable.
- RF-23: SI GET o POST termina offline, en timeout o con 5xx, o entrega un payload terminal cuya pareja `status`/`error.code` es ausente o inconsistente, ENTONCES EL SISTEMA eleva `preliminary` o conserva la key como `unresolved`, no confirma, bloquea otra orden y muestra un error global accesible con acción para consultar o reintentar status.
- RF-24: CUANDO el usuario pulsa Cancelar mientras la consulta está pendiente o no responde, EL SISTEMA cierra solo la espera visible, conserva la clave `unresolved` y mantiene bloqueada otra orden; el intento puede reabrirse para consultar y no existe cancelación remota.
- RF-25: CUANDO el servidor confirma directamente la orden, EL SISTEMA aplica el mismo cierre que RF-19: una confirmación, resumen sin dirección, limpieza del intento y carrito vacío.
- RF-26: SI la respuesta correlacionada al primer POST es 409 `OUT_OF_STOCK` y la key sigue `preliminary`, ENTONCES EL SISTEMA elimina `preliminary`, no persiste la dirección, desbloquea la compra, actualiza producto y carrito con el stock vigente, informa la indisponibilidad e invita a ajustar o retirar líneas con una key nueva. SI `OUT_OF_STOCK` llega de forma tardía, repetida o inconsistente cuando la key ya está `unresolved`, ENTONCES conserva el bloqueo y consulta status sin eliminar metadatos. MIENTRAS la consulta devuelve 202 `pending`, considera reservadas las cantidades aceptadas y continúa hasta `confirmed` o `expired`.
- RF-27: CUANDO la app arranca y encuentra una key persistida como `preliminary`, EL SISTEMA la promueve inmediatamente a `unresolved`, bloquea una orden nueva y consulta `GET /orders/status/:key` sin requerir dirección, porque el POST pudo alcanzar al servidor antes de terminar el proceso. Las keys ya `unresolved` conservan ese estado y siguen la misma consulta; 200 confirma, 202 mantiene el bloqueo, 404/410 coherentes liberan y offline/timeout/5xx o payload inconsistente conservan `unresolved`. Los resúmenes confirmados de esta instalación permanecen disponibles y ninguna dirección se restaura.
- RF-28: EL SISTEMA ofrece en español e inglés todo texto visible añadido durante el día.
- RF-29: CUANDO concluye cada paso guiado, EL PROGRAMA se detiene hasta confirmar el comportamiento en Android y en iOS.
- RF-30: CUANDO finaliza el día, EL MATERIAL entrega un ejercicio sin solución sobre selector o validación, entre 8 y 10 preguntas con respuestas cortas y un checklist oral de estado, persistencia, animación e idempotencia.
- RF-31: CUANDO todos los criterios están validados, EL PROGRAMA actualiza el registro acumulado de aprendizaje en español y crea un commit claro en inglés.

## Requisitos no funcionales
- RNF-1: EL SISTEMA nunca registra ni persiste dirección, teléfono, nombre, payload reversible, secretos o datos personales. Los metadatos `preliminary` se eliminan solo ante 400 `VALIDATION_ERROR` o 409 `OUT_OF_STOCK` correlacionados con el primer POST mientras siguen preliminary, y se promueven a `unresolved` al reiniciar. Los metadatos `unresolved` solo se eliminan ante 200 `confirmed`, 404 `not_created`/`ORDER_NOT_CREATED` o 410 `expired`/`IDEMPOTENCY_KEY_EXPIRED` coherentes. El resumen confirmado nunca contiene datos personales.
- RNF-2: SI está activo movimiento reducido, ENTONCES agregar, deslizar y confirmar conservan cambios de estado y mensajes, pero eliminan movimiento no esencial.
- RNF-3: CUANDO se usan cantidad, carrito o formulario, EL SISTEMA ofrece nombres, roles, estados y errores accesibles, texto escalable y objetivos mínimos de 48 dp en Android y 44 pt en iOS.
- RNF-4: CUANDO se valida el día, EL PROYECTO supera lint, tipos estrictos y comprobaciones deterministas de reducers, selectors, conversión, validación e idempotencia, además de Android e iOS.

## Casos límite
- SI se agrega más que el stock, ENTONCES el carrito conserva el máximo disponible y anuncia el límite.
- SI el stock cambia entre la vista de detalle/carrito y la recepción del primer POST y la key sigue `preliminary`, ENTONCES un 409 `OUT_OF_STOCK` actualiza producto/carrito, informa las líneas indisponibles y permite ajustarlas sin guardar dirección ni intento.
- SI el usuario reduce la última unidad, ENTONCES la línea se elimina sin quedar con cantidad cero.
- SI el estado persistido está vacío, corrupto o es incompatible, ENTONCES se descarta y se muestra carrito vacío sin cierre inesperado.
- SI se intenta abrir checkout con carrito vacío, ENTONCES permanece en carrito, muestra el estado vacío y no crea intento.
- SI subtotal canónico pasa por debajo o encima de 800 MXN, ENTONCES mensaje y progreso cambian según el valor canónico aunque la vista esté en USD.
- SI hay doble toque, ENTONCES solo el primero inicia el intento y los siguientes no generan solicitudes.
- SI todavía no existe respuesta del primer POST, ENTONCES la key permanece `preliminary`; una respuesta incierta la eleva a `unresolved` y una respuesta terminal sin intento correlacionada con ese primer POST la elimina solo mientras siga `preliminary`.
- SI un 4xx definitivo de `POST /orders` devuelve errores de dirección, ENTONCES el formulario volátil conserva los valores para corregirlos, pero la app no los guarda al reiniciar.
- SI `VALIDATION_ERROR.fields` contiene `shippingAddress.postalCode`, `shippingAddress.phone` o un path de item conocido, ENTONCES el control correspondiente muestra su error localizado; un path desconocido o ausencia de `fields` produce un error global accesible sin eco ni registro de valores.
- SI el primer POST devuelve 409 `OUT_OF_STOCK` mientras la key sigue `preliminary`, ENTONCES la app elimina esos metadatos, refresca catálogo/carrito, informa la indisponibilidad y permite ajustar o enviar con una key nueva.
- SI el POST devuelve 409 `IDEMPOTENCY_KEY_REUSED`, ENTONCES la app conserva la key `unresolved`, no permite otra orden y consulta el intento original sin mostrar ni guardar datos sensibles del error.
- SI un 400 `VALIDATION_ERROR` o 409 `OUT_OF_STOCK` llega para una key que ya estaba `unresolved`, ENTONCES la app conserva el bloqueo y consulta status en vez de borrar el intento.
- SI el proceso termina mientras el primer POST está en vuelo y al reiniciar existe una key `preliminary`, ENTONCES se promueve a `unresolved` antes de habilitar checkout y se consulta status sin dirección.
- SI hay timeout después de crear la orden, ENTONCES consultar la clave recupera la misma identidad y no reenvía la dirección.
- SI la app se reinicia y la consulta indica que no se creó orden, ENTONCES descarta el intento anterior, solicita de nuevo la dirección y usa una clave nueva.
- SI la app se reinicia y la consulta encuentra la orden, ENTONCES guarda y muestra el mismo resumen sin recuperar ni persistir dirección.
- SI la consulta devuelve 202 repetidamente, ENTONCES conserva `unresolved`, respeta cada `retryAfterSeconds` y bloquea nuevas órdenes hasta un resultado terminal.
- SI el catálogo muestra menos stock después de que el POST creó el pending, ENTONCES la app conserva el intento porque sus cantidades ya están reservadas y acepta su confirmación posterior.
- SI un pending expira excepcionalmente y la consulta devuelve 410, ENTONCES la app libera el estado local según RF-22 y permite un intento nuevo; la reserva ya fue liberada por el servidor.
- SI la consulta falla offline, por timeout o 5xx y el usuario cancela la espera, ENTONCES el intento continúa `unresolved`, puede reabrirse y otra orden sigue bloqueada.
- SI transcurren 24 horas pero aún no se obtuvo 410, ENTONCES la app conserva el bloqueo hasta consultar y observar `expired`.
- SI la consulta devuelve 404 o 410, ENTONCES la app exige la pareja contractual status/code antes de liberar el intento; un payload inconsistente se trata como error global y conserva `unresolved`.
- SI cualquier GET o POST devuelve un terminal con `status`/`error.code` incoherentes, ENTONCES `preliminary` se eleva a `unresolved` o `unresolved` se conserva, y solo se ofrece consultar/reintentar status.

## Fuera de alcance
- Pago real, autenticación, sincronización multi-dispositivo y recuperación de órdenes externas.
- Hápticos, notificación local y validación nativa de compartir/deep links, que corresponden al Día 5.
- Pantalla final de Cuenta y auditoría E2E, que corresponden al Día 6.

## Criterios de finalización
- Detalle, conversión, carrito, umbral y checkout cumplen RF-4 a RF-27 en Android e iOS.
- Carrito, historial, metadatos `preliminary`/`unresolved` no reversibles y pedidos locales sobreviven solo los reinicios definidos; dirección y payload reversible nunca se persisten.
- La matriz demuestra: 400/`OUT_OF_STOCK` correlacionados con el primer POST eliminan solo `preliminary`; restart, 202, `IDEMPOTENCY_KEY_REUSED` y respuestas tardías/inciertas producen o conservan `unresolved`; 200 confirmado y parejas coherentes 404/410 eliminan el estado; ninguna transición permite sobreventa ni segunda orden insegura.
- Los errores de validación se asignan por path sin persistir/loggear valores; una vez `unresolved`, solo 200 confirmado o 404 `not_created`/`ORDER_NOT_CREATED` y 410 `expired`/`IDEMPOTENCY_KEY_EXPIRED` coherentes liberan el intento.
- Todo texto nuevo está disponible en español e inglés y se validan accesibilidad y movimiento reducido.
- Se completan verificaciones, ejercicio, 8–10 preguntas, checklist, registro y commit.

## Dudas abiertas
- Ninguna.
