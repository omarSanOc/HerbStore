# Spec 001 — Día 1: fundamentos y preparación del entorno
Estado: implementada

## Contexto y objetivo
HerbStore prepara a un desarrollador Android sénior, nuevo en React Native, para explicar su modelo de ejecución y construir sobre una base reproducible. El entorno móvil ya está validado en Android e iOS; este día conserva esa base y completa el servidor ficticio, los fundamentos de componentes y el sistema visual inicial. Es requisito previo de los cinco días siguientes.

## Usuarios
- Desarrollador con experiencia en Kotlin, Compose, Coroutines/Flow, Clean Architecture y MVVM que aprende React Native y Swift/SwiftUI.
- Entrevistador técnico que necesita evidencias ejecutables y explicaciones comparables entre plataformas.

## Historias de usuario
- HU-1. Como candidato, quiero relacionar ejecución y renderizado de React Native con Android e iOS para evitar analogías incorrectas.
- HU-2. Como aprendiz, quiero practicar componentes, hooks y estilos en incrementos verificables para reconocer errores frecuentes al venir de nativo.
- HU-3. Como participante de los días posteriores, quiero un catálogo ficticio determinista para repetir los mismos escenarios sin servicios externos.

## Definiciones
- **Development Build:** aplicación de desarrollo propia que incorpora las capacidades nativas requeridas y no depende de Expo Go.
- **New Architecture:** modelo de interoperabilidad y renderizado basado en JSI, Fabric, TurboModules, Codegen y modo bridgeless.
- **Intento de orden:** asociación temporal del servidor entre una clave de idempotencia, un fingerprint no reversible del request y el resultado de la orden.
- **Item de orden:** par `{ productId, quantity }` con un producto único existente y cantidad entera entre 1 y 99, inclusive.
- **Dirección de envío MX:** objeto con `fullName`, `phone`, `postalCode`, `state`, `city`, `street`, `exteriorNumber` e `interiorNumber` opcional; todos los textos eliminan espacios exteriores antes de validarse.
- **Resumen sanitizado de orden:** objeto sin dirección ni datos personales con `id`, items, moneda, importes, estado y fecha de creación.
- **Reloj controlable:** referencia temporal sustituible en pruebas para observar procesamiento y expiración sin esperar tiempo real.
- **Redondeo half-up a 2 decimales:** sobre importes no negativos, se conserva el centavo más próximo y una fracción de medio centavo o superior incrementa el segundo decimal; una fracción menor se descarta.
- **Serialización canónica:** representación del request validado y normalizado con claves de objetos ordenadas recursivamente e items ordenados por `productId`, usada como entrada del hash no reversible.
- **Tombstone:** registro no personal de una key expirada que contiene únicamente la key, estado `expired` y timestamps necesarios para rechazar su reutilización temporal.
- **Error HTTP:** toda respuesta no 2xx contiene `{ error: { code, message } }`; puede añadir únicamente `fields`, estado o links no sensibles cuando el contrato los defina. Los 404/410 de consulta de orden incluyen además `status` en el nivel superior.
- **Errores por campo:** `fields` es un mapa de paths del payload a uno de los códigos estables `REQUIRED`, `INVALID_TYPE`, `INVALID_FORMAT`, `INVALID_VALUE`, `TOO_SHORT`, `OUT_OF_RANGE`, `DUPLICATE`, `UNKNOWN_PRODUCT` o `ADDITIONAL_PROPERTY`; nunca contiene ni reproduce el valor recibido.

## Requisitos funcionales
- RF-1: ANTES de cada construcción guiada, EL MATERIAL presenta un bloque teórico de máximo 10 minutos sobre los conceptos que se practicarán a continuación.
- RF-2: EL MATERIAL explica hilos JavaScript, UI y de segundo plano; Metro y Fast Refresh; Hermes; JSI, Fabric, TurboModules, Codegen y bridgeless, y contrasta la New Architecture con el Bridge anterior.
- RF-3: EL MATERIAL compara Expo y React Native CLI, Development Build y Expo Go, y explica generación nativa reproducible y configuración mediante plugins como objetivos formativos.
- RF-4: CUANDO se enseñan JSX, componentes funcionales, props, estado, efectos, referencias, hooks, renders o reconciliación, EL MATERIAL incluye la analogía y la diferencia con Kotlin/Compose y Swift/SwiftUI, y muestra los riesgos de mutación, efectos incompletos, renders innecesarios y trabajo pesado en JavaScript.
- RF-5: CUANDO se construye la interfaz del día, EL SISTEMA demuestra composición, props inmutables, estado local, una referencia, un efecto con limpieza y distribución mediante Flexbox, StyleSheet y unidades independientes de densidad.
- RF-6: EL MATERIAL explica la organización por funcionalidades y responsabilidades compartidas, la compara con Clean Architecture y MVVM, y para cada alternativa tratada identifica la elección de HerbStore, su trade-off y una opción descartada.
- RF-7: CUANDO se genera el catálogo con la misma seed fija, EL SERVIDOR produce exactamente 300 productos con ids, EAN-13 y relaciones idénticos entre ejecuciones.
- RF-8: EL SERVIDOR representa cada producto con id, marca ficticia, nombre, categoría, subcategoría, precio y moneda de origen, calificación, reseñas, unidades vendidas, insignias, cupón, stock, indicadores de marca propia y suscripción, imágenes ficticias, información de porción, descripción y EAN-13.
- RF-9: CUANDO se consultan `/home`, `/categories`, `/products`, `/products/:id`, `/products/barcode/:code` o `/brands`, EL SERVIDOR responde con datos coherentes del catálogo; los recursos inexistentes responden como no encontrados sin inventar productos.
- RF-10: CUANDO se consulta `/products`, EL SERVIDOR admite `category`, `brand`, `subcategory`, `minRating`, `inStock`, `ownBrand`, `subscribeAndSave` y `q`; `brand` y `subcategory` aceptan valores separados por comas, aplican OR dentro de su propio facet y los facets distintos se combinan con AND.
- RF-11: CUANDO `/products` recibe `q`, EL SERVIDOR compara marca, nombre y descripción sin distinguir mayúsculas, acentos ni espacios exteriores o internos consecutivos.
- RF-12: CUANDO se consulta `/products`, EL SERVIDOR admite orden `featured`, `price_asc`, `price_desc`, `rating` o `best_selling`; si no se indica, usa `featured`.
- RF-13: CUANDO se consulta `/products`, EL SERVIDOR acepta `page` entero desde 1 y `limit` entero entre 1 y 50, usa 20 por defecto, aplica todos los filtros antes de paginar y responde `{ items, page, totalPages, total }` calculado sobre el resultado combinado.
- RF-14: CUANDO `/products` recibe parámetros, `category` admite un valor de texto no vacío; `brand` y `subcategory` admiten CSV sin elementos vacíos; `q` debe conservar al menos un carácter tras normalizar espacios; `minRating` acepta únicamente un número entre 0 y 5; e `inStock`, `ownBrand`, `subscribeAndSave` y `fail` aceptan únicamente `true` o `false`. Formatos, sort o paginación inválidos responden 400 sin resultados parciales.
- RF-15: SI todos los valores sintácticamente válidos de `category`, `brand` o `subcategory` son desconocidos, ENTONCES `/products` responde 200 con `items` vacío, `total: 0` y `totalPages: 0`; en un CSV mixto, los desconocidos no aportan coincidencias y los conocidos conservan la semántica OR.
- RF-16: SI se solicita un id de producto inexistente, ENTONCES EL SERVIDOR responde 404; SI un EAN-13 tiene formato o checksum inválido, responde 400; SI es válido y no existe, responde 404.
- RF-17: CUANDO se configura latencia artificial, EL SERVIDOR espera esa duración antes de responder; SI además recibe `fail=true`, ENTONCES espera la misma latencia y después responde 500.
- RF-18: CUANDO `POST /orders` recibe una clave de idempotencia no vacía, EL SERVIDOR acepta únicamente las propiedades raíz `items`, `shippingAddress` y `currency`; cada item acepta únicamente `productId` y `quantity`, con `productId` de texto no vacío, único y existente y `quantity` entera entre 1 y 99; `shippingAddress` acepta únicamente `fullName`, `phone`, `postalCode`, `state`, `city`, `street`, `exteriorNumber` e `interiorNumber` opcional; `currency` es `MXN` o `USD`. Cualquier propiedad adicional en raíz, item o dirección responde 400 y no crea intento.
- RF-19: CUANDO `POST /orders` valida el request, EL SERVIDOR elimina espacios exteriores de todos los textos y aplica sobre el resultado los mínimos de dirección: `fullName` 3, `state` 2, `city` 2 y `street` 3 caracteres; `phone` contiene exactamente 10 dígitos, `postalCode` exactamente 5, `exteriorNumber` es no vacío e `interiorNumber` se omite si queda vacío. SI falta la key, `items` está vacío, un item está duplicado/no existe/fuera de 1–99, o dirección/moneda/tipos son inválidos, ENTONCES responde 400 con `{ error: { code: 'VALIDATION_ERROR', message: 'Order request validation failed' }, fields }`, sin crear intento ni reserva. `fields` usa paths del payload —por ejemplo `shippingAddress.postalCode`, `shippingAddress.phone` o `items[0].quantity`— y códigos de error por campo, sin valores recibidos; errores no estructurales no incluyen `fields`.
- RF-20: CUANDO el request es válido, EL SERVIDOR normaliza cada precio de catálogo a MXN con precisión completa —un precio MXN se conserva y uno USD se multiplica por 18—, multiplica por `quantity` sin redondeo visual y suma `canonicalSubtotalMXN`; el envío es gratuito cuando `canonicalSubtotalMXN >= 800` y, por debajo, cuesta 99 MXN canónicos. Para la respuesta, convierte cada precio unitario de origen a la `currency` elegida y aplica half-up a 2 decimales; calcula `lineTotal` como half-up de ese `unitPrice` ya redondeado multiplicado por `quantity`, `subtotal` como half-up de la suma de `lineTotal`, `shipping` como 0 o half-up de convertir 99 MXN, y `total` como half-up de `subtotal + shipping`.
- RF-21: CUANDO el request supera validación, EL SERVIDOR usa sus valores con trim, ordena recursivamente las claves, ordena `items` por `productId`, obtiene la serialización canónica y calcula su fingerprint no reversible. El orden original de claves/items y los espacios exteriores no cambian el fingerprint; mayúsculas, acentos, cantidades, `currency` o cualquier otro contenido sí lo cambian. SI una key activa recibe un fingerprint distinto, ENTONCES responde 409 con `{ error: { code: 'IDEMPOTENCY_KEY_REUSED', message }, status, links: { status } }`, donde `status` identifica el estado vigente y el link apunta a `GET /orders/status/:key`; no retorna dirección ni fingerprint y no altera el intento original ni su reserva.
- RF-22: CUANDO `POST /orders` recibe por primera vez una key y request válidos, EL SERVIDOR revalida y reserva atómicamente el stock completo antes de crear un único intento `pending`; SI el stock es insuficiente, ENTONCES responde 409 con `{ error: { code: 'OUT_OF_STOCK', message } }` sin crear intento, reserva ni key activa. El pending conserva la reserva e impide que otro intento reserve las mismas unidades; cambios posteriores del stock disponible causados por otras operaciones no reducen ni invalidan esa reserva. Al finalizar su intervalo configurable, siempre menor a 24 horas en operación normal, pasa a `confirmed` y compromete/descuenta definitivamente las unidades reservadas. SI por configuración sigue pending al alcanzar exactamente 24 horas, prevalece la expiración, libera toda la reserva y no confirma; no existe cancelación remota.
- RF-23: CUANDO se crea el pending, EL SERVIDOR asigna una sola vez un `id` UUIDv4 y un `createdAt` RFC 3339 en UTC, conserva ambos en reintentos y responde 202 con `{ status: 'pending', retryAfterSeconds, key }`; `retryAfterSeconds` es un entero mínimo 1 que expresa los segundos restantes redondeados hacia arriba. Repetir misma key/fingerprint mientras pending devuelve el mismo intento 202 sin reservar otra vez; tras confirmar y antes de expirar devuelve 200 con `{ status: 'confirmed', order }`. `order` es `{ id, items, currency, subtotal, shipping, total, status: 'confirmed', createdAt }`, sus items son `{ productId, quantity, unitPrice, lineTotal }`, y el estado activo conserva solo key, fingerprint, timestamps, estado, reserva y resumen sanitizado, nunca dirección, request reversible ni logs con esos datos.
- RF-24: CUANDO se consulta `GET /orders/status/:key` durante las primeras 24 horas desde `createdAt`, EL SERVIDOR responde 200 con `{ status: 'confirmed', order }` o 202 con `{ status: 'pending', retryAfterSeconds }`; una key nunca creada responde 404 con `{ status: 'not_created', error: { code: 'ORDER_NOT_CREATED', message: 'No order attempt exists for this key' } }`. Al cumplirse exactamente 24 horas, elimina fingerprint, reserva y resumen, crea un tombstone por 24 horas adicionales y tanto GET como POST con esa key y cualquier cuerpo responden 410 con `{ status: 'expired', error: { code: 'IDEMPOTENCY_KEY_EXPIRED', message: 'The idempotency key has expired' } }` sin crear intento. Al cumplirse exactamente 48 horas desde `createdAt`, olvida el tombstone: GET vuelve a responder el 404 `ORDER_NOT_CREATED` definido y POST puede crear un intento nuevo, aunque el cliente debe usar keys nuevas. Los mensajes son estables, no sensibles y el reloj controlable verifica ambas fronteras.
- RF-25: EL MATERIAL documenta la dirección observable que debe usar el cliente para alcanzar el servidor desde emulador Android, simulador iOS y un dispositivo físico en la misma red.
- RF-26: CUANDO cambia el tema del sistema, EL SISTEMA aplica colores, tipografía, espaciado, radios y tamaños táctiles coherentes en tema claro y oscuro.
- RF-27: EL SISTEMA ofrece en español e inglés todo texto visible incorporado durante el día; cambiar de idioma no deja textos del día sin traducir.
- RF-28: CUANDO concluye cada paso guiado, EL PROGRAMA se detiene hasta confirmar el resultado en Android y en iOS.
- RF-29: CUANDO finaliza el día, EL MATERIAL entrega un ejercicio sin solución, entre 8 y 10 preguntas con respuestas cortas y un checklist oral sobre ejecución, renderizado, Expo y generación nativa.
- RF-30: CUANDO todos los criterios están validados, EL PROGRAMA actualiza el registro acumulado de aprendizaje en español y crea un commit claro en inglés; antes no da el día por completado.

## Requisitos no funcionales
- RNF-1: EL SISTEMA utiliza únicamente nombres, datos e imágenes ficticios y no registra secretos ni datos personales.
- RNF-2: CUANDO se valida el día, EL PROYECTO supera lint, comprobación estricta de tipos, compatibilidad y diagnóstico del entorno sin errores.
- RNF-3: CUANDO una persona usa controles del día, EL SISTEMA ofrece nombre y rol accesibles, escalado de fuente y objetivos táctiles mínimos de 48 dp en Android y 44 pt en iOS.
- RNF-4: SI el usuario solicita movimiento reducido, ENTONCES el sistema visual elimina movimiento no esencial y mantiene visible el resultado de cada acción.

## Casos límite
- SI el servidor se reinicia con la misma seed, ENTONCES conserva los 300 productos, ids y EAN-13; con otra seed no se considera una ejecución válida del programa.
- SI una consulta válida no produce productos o pide una página posterior a `totalPages`, ENTONCES responde 200 con `items` vacío y conserva `total` y `totalPages` del conjunto filtrado.
- SI marca, categoría o subcategoría son desconocidas, ENTONCES responde 200 vacío; un id inexistente o EAN válido inexistente responde 404, y un EAN inválido responde 400.
- SI `fail=true` se combina con filtros válidos, ENTONCES prevalece el fallo 500 después de la latencia y no se entrega una respuesta de catálogo.
- SI dos requests válidos difieren solo en orden de claves/items o espacios exteriores, ENTONCES comparten fingerprint; SI difieren en case, acentos, cantidad, moneda o contenido, ENTONCES la misma key recibe 409.
- SI `items` está vacío, repite un `productId`, referencia un producto inexistente, contiene propiedades extra o usa `quantity` 0, 100, negativa o no entera, ENTONCES el POST responde 400 y consultar la key devuelve 404 `not_created`.
- SI raíz o `shippingAddress` contienen propiedades adicionales, o los campos tienen solo espacios, teléfono/CP incluyen caracteres no numéricos o incumplen longitudes tras trim, ENTONCES el POST responde 400 sin intento ni reserva; `interiorNumber` vacío se normaliza como omitido.
- SI varios campos son inválidos, ENTONCES el 400 `VALIDATION_ERROR` incluye cada path afectado con su código estable, no incluye valores y conserva un mensaje general único.
- SI una key activa se reutiliza con contenido distinto, ENTONCES responde 409 `IDEMPOTENCY_KEY_REUSED` con estado/link de consulta no sensibles y el intento original continúa sin cambios.
- SI dos POST concurrentes solicitan más unidades que las disponibles en conjunto, ENTONCES solo las reservas atómicas cubiertas por stock crean pending y los restantes responden 409 `OUT_OF_STOCK` sin sobreventa.
- SI una cantidad válida supera stock, ENTONCES responde 409 `OUT_OF_STOCK` sin intento, reserva ni key activa; SI crea pending, la reserva permanece hasta confirmar o expirar y solo al confirmar se descuenta definitivamente.
- SI otras operaciones reducen el stock disponible después de crear un pending, ENTONCES ese intento conserva sus unidades reservadas y confirma normalmente; únicamente su expiración excepcional libera la reserva sin confirmar.
- SI `canonicalSubtotalMXN` es exactamente 800, ENTONCES `shipping` es 0; SI es menor, convierte 99 MXN y aplica half-up. Un valor situado exactamente a medio centavo incrementa el centavo y uno menor a medio centavo no lo incrementa.
- SI se repite el POST antes del intervalo, ENTONCES responde 202 con el mismo UUIDv4, `createdAt` y reserva; después de avanzar el reloj hasta confirmación responde 200 con la misma orden.
- SI el intervalo configurado mantiene pending al instante exacto de 24 horas, ENTONCES expira antes de confirmar, libera la reserva y GET/POST devuelven 410 durante el tombstone.
- SI el reloj está justo antes de 24 horas, ENTONCES aplica el estado activo; desde 24 horas inclusive hasta justo antes de 48 responde 410; desde 48 horas inclusive GET responde 404 y un POST puede crear un intento nuevo.
- SI GET consulta una key nunca creada o ya olvidada, ENTONCES responde 404 con `status: 'not_created'` y `ORDER_NOT_CREATED`; SI GET o POST usa una key en tombstone, responde 410 con `status: 'expired'` e `IDEMPOTENCY_KEY_EXPIRED`.
- SI cambia tema o escala de texto con la app abierta, ENTONCES los controles siguen legibles, etiquetados y operables sin reiniciar.

## Fuera de alcance
- Navegación completa y Home comercial, que corresponden al Día 2.
- Caché definitiva, listado y búsqueda interactiva, que corresponden al Día 3.
- Detalle, carrito, persistencia e intento de checkout, que corresponden al Día 4.
- Cámara, notificaciones, hápticos y módulo DeviceInsights, que corresponden al Día 5.
- Auditoría integral, suite final y simulacro de entrevista, que corresponden al Día 6.

## Criterios de finalización
- La base abre y se verifica en Android e iOS sin depender de Expo Go.
- El catálogo contiene exactamente 300 productos deterministas y los contratos RF-8 a RF-25 producen filtros remotos completos, estados HTTP definidos, registro idempotente activo durante 24 horas y tombstone hasta completar 48 horas.
- El contrato rechaza propiedades adicionales y cuerpos inválidos sin intento/reserva; UUIDv4, RFC 3339 UTC, quantities 1–99 y `retryAfterSeconds` entero positivo se validan de forma observable.
- Los 400 de validación exponen `VALIDATION_ERROR`, mensaje general y paths/códigos estables sin valores; otros errores omiten `fields`.
- Los importes demuestran la secuencia precio canónico sin redondeo → unitPrice redondeado → lineTotal → subtotal/shipping/total, además de MXN/USD, umbral 800 MXN, envío 99 MXN y half-up a 2 decimales.
- Requests semánticamente equivalentes producen el mismo fingerprint y cambios de case/acento/cantidad/moneda/contenido producen 409 con la misma key.
- Los casos 409 son distinguibles: `OUT_OF_STOCK` no crea intento ni reserva, mientras `IDEMPOTENCY_KEY_REUSED` conserva el intento/reserva original y entrega únicamente estado/link de consulta no sensibles.
- Un reloj controlable demuestra 202 pending, reserva atómica, 200 confirmed, liberación al expirar y las fronteras exactas de estado activo 0–24 h, tombstone 24–48 h y olvido desde 48 h.
- Las respuestas terminales demuestran simultáneamente status y error envelope: 404 `not_created`/`ORDER_NOT_CREATED` y 410 `expired`/`IDEMPOTENCY_KEY_EXPIRED`, con mensajes estables no sensibles.
- La inspección de estado, logs y respuestas confirma que solo el registro activo conserva key, fingerprint, timestamps/estado, reserva y resumen sanitizado; el tombstone no conserva dirección, fingerprint, reserva, resumen ni request reversible.
- La interfaz didáctica demuestra RF-5, temas, accesibilidad y textos español/inglés.
- Las verificaciones de RNF-2 concluyen sin errores.
- Se revisan ejercicio, 8–10 preguntas, checklist, registro de aprendizaje y commit del día.

## Dudas abiertas
- Ninguna.
