# Spec 007 — Integración con API persistente
Estado: implementada

## Contexto y objetivo
HerbStore obtiene actualmente sus datos de un backend y de fixtures locales creados durante las etapas didácticas anteriores. Existe una API persistente de HerbStore, identificada en `http://localhost:3001/openapi.json` mediante OpenAPI 3.1 con título `HerbStore API` y versión `0.1.0`, cuyas operaciones principales son compatibles con los comportamientos ya consumidos por la aplicación.

El objetivo es que toda ejecución normal use esa API como única fuente remota de Home, catálogo, categorías, marcas, stock, imágenes y creación o consulta de órdenes. Carrito, preferencias, historial de búsqueda y resúmenes de pedidos confirmados por esta instalación continúan siendo datos locales y no se presentan como sincronizados. El cambio conserva la experiencia, seguridad, accesibilidad, localización e idempotencia aprobadas, pero deja de ocultar fallos mediante un backend o fixtures sustitutos de runtime.

El documento OpenAPI identifica el servicio y las operaciones o esquemas que sí declara, pero actualmente no detalla todos los parámetros de productos ni todas las respuestas de órdenes y errores. Por ello, la conformidad exige además el contrato funcional observable de esta spec y sus pruebas de compatibilidad; no depende de que esos detalles hayan sido incorporados al OpenAPI.

Las normas y la documentación activas del proyecto deberán dejar de exigir el backend mock local y sus comandos, y deberán describir la API persistente configurada. Las specs 001 a 006, el aprendizaje y la evidencia previos permanecen como registro histórico del uso del mock y no se reescriben retrospectivamente.

## Usuarios
- Cliente ficticio que quiere consultar un catálogo vigente y completar una compra simulada con datos coherentes entre sesiones.
- Desarrollador que necesita ejecutar HerbStore contra un origen alcanzable desde los destinos de validación.
- Candidato que necesita demostrar integración remota, caché por idioma, recuperación de errores, idempotencia y pruebas reproducibles sin depender de un backend reiniciable.

## Historias de usuario
- HU-1. Como cliente, quiero que todas las pantallas remotas usen una única API persistente para observar contenido y stock coherentes.
- HU-2. Como cliente bilingüe, quiero que el contenido remoto cambie con mi idioma y no se mezcle con contenido almacenado en otro idioma.
- HU-3. Como cliente, quiero conservar búsqueda, filtros, paginación, detalle, escáner y checkout aunque cambie la fuente remota.
- HU-4. Como cliente, quiero conservar localmente mi carrito, preferencias, historial y pedidos de esta instalación aunque un producto remoto desaparezca.
- HU-5. Como desarrollador, quiero errores explícitos cuando la configuración o la API fallan para no confundir datos sustitutos con datos reales.
- HU-6. Como desarrollador, quiero pruebas automáticas aisladas y comprobaciones opt-in contra la API viva para detectar regresiones sin presuponer un reset de stock u órdenes.

## Definiciones
- **API persistente:** servicio HerbStore identificado por el OpenAPI citado, cuyo origen se configura para cada entorno y cuyo stock y órdenes sobreviven entre ejecuciones sin un mecanismo de reinicio documentado.
- **Origen válido:** origen `http` o `https` sin credenciales, path, query ni fragmento. Un valor ausente, vacío o que no cumpla esas condiciones es una configuración no utilizable.
- **Ejecución normal:** cualquier uso interactivo fuera de un entorno de pruebas automatizadas, tanto en desarrollo como en una distribución verificable.
- **Fuente remota:** Home, catálogo, categorías, marcas, detalle y stock de producto, imágenes y creación o estado de órdenes.
- **Estado local:** carrito, preferencias, historial de búsqueda y resumen sanitizado de pedidos confirmados por esta instalación; no implica cuenta, recuperación externa ni sincronización entre dispositivos.
- **Sustituto de runtime:** servidor local, fixture o respuesta incorporada que reemplaza a la API durante una ejecución normal. No incluye dobles de red ni fixtures accesibles exclusivamente desde pruebas.
- **Doble de prueba:** respuesta controlada y aislada, disponible únicamente para pruebas automatizadas y ausente de los artefactos ejecutables del producto.
- **Contenido localizado:** títulos, nombres, descripciones, categorías, secciones y demás texto remoto que la API entrega en español o inglés.
- **Idioma vigente:** preferencia efectiva `es` o `en` al iniciar y al presentar una lectura remota.
- **Respuesta incompatible:** cuerpo ausente, no interpretable o que incumple la forma, tipos, coherencia de idioma o pareja de estado/código exigidos por esta spec.
- **Consulta equivalente:** lectura con el mismo dominio, idioma y parámetros normalizados; en productos incluye búsqueda, facets, orden, página y límite.
- **Verificación viva opt-in:** comprobación ejecutada solo cuando se solicita expresamente y existe un origen alcanzable; no forma parte de la suite determinista predeterminada.
- **Entorno exclusivo de E2E:** intervalo declarado en el que ningún otro cliente consulta para comprar ni modifica el stock del producto elegido.

## Requisitos funcionales

### Fuente, configuración y límites de datos
- RF-1: MIENTRAS la aplicación se usa en una ejecución normal con origen válido, EL SISTEMA obtiene toda fuente remota exclusivamente de la API persistente configurada y nunca de un backend o fixture sustituto de runtime.
- RF-2: SI el origen está ausente o es inválido, ENTONCES EL SISTEMA mantiene el gate bilingüe y accesible de configuración, distingue ambos casos y no inicia ninguna solicitud remota.
- RF-3: SI el origen es válido pero la API no está disponible, ENTONCES EL SISTEMA muestra el estado offline, error o datos desactualizados que corresponda y nunca activa una fuente sustituta.
- RF-4: MIENTRAS el usuario administra carrito, preferencias, historial de búsqueda o Mis pedidos, EL SISTEMA conserva esos datos como estado local según las specs anteriores y nunca afirma que estén sincronizados o que puedan recuperarse desde la API.
- RF-5: CUANDO se completa la sustitución, EL PROYECTO elimina del producto el backend local y los fixtures de runtime, conserva los dobles y fixtures exclusivos de pruebas, y actualiza las normas y documentación activas para dejar de exigir reglas o comandos del backend mock.
- RF-6: MIENTRAS se actualizan las normas y documentación activas, EL PROYECTO conserva las specs 001 a 006, el aprendizaje y la evidencia previa como registro histórico, y puede añadir una nota que explique la sustitución sin reescribir el pasado.

### Contrato funcional esperado de la API
- RF-7: CUANDO se comprueba `GET /health`, LA API responde satisfactoriamente e identifica que el servicio está disponible antes de una verificación viva; esta operación no sustituye los estados de error de las lecturas funcionales.
- RF-8: CUANDO se solicita `GET /home`, LA API devuelve un objeto con arrays `banners`, `categories` y `sections`: cada banner tiene id, título, subtítulo, imagen y categoría de destino; cada categoría tiene id, nombre, contador e imagen; y cada sección conocida (`best_sellers`, `new`, `offers`) tiene id, título y productos sin ids duplicados.
- RF-9: CUANDO se solicita `GET /categories`, LA API devuelve un array con ids de categoría únicos, nombre, contador no negativo y subcategorías con id único, nombre y contador no negativo; CUANDO se solicita `GET /brands`, devuelve un array de nombres únicos con contador no negativo.
- RF-10: CUANDO se solicita `GET /products`, LA API acepta `category`, `q`, `brand` CSV, `subcategory` CSV, `inStock`, `minRating`, `ownBrand`, `subscribeAndSave`, `sort`, `page` y `limit`, y devuelve `{ items, page, totalPages, total }`, con página basada en uno, totales enteros no negativos e ids no duplicados dentro de una página.
- RF-11: CUANDO `GET /products` recibe varias marcas o subcategorías, LA API combina con OR los valores del mismo facet y con AND los facets distintos; CUANDO recibe `q`, busca sobre marca, nombre y descripción normalizados antes de paginar.
- RF-12: CUANDO `GET /products` recibe orden, LA API acepta exactamente `featured`, `price_asc`, `price_desc`, `rating` o `best_selling`; CUANDO recibe filtros booleanos o `minRating=4`, aplica el filtro antes de calcular `total` y `totalPages`.
- RF-13: CUANDO una ruta devuelve un producto de catálogo, LA API proporciona id, marca, nombre, ids de categoría y subcategoría, precio no negativo, moneda `MXN` o `USD`, rating entre 0 y 5, contadores no negativos, badges, disponibilidad e imágenes; los campos opcionales de precio de lista y cupón son válidos cuando existen.
- RF-14: CUANDO se solicita `GET /products/{product_id}` o `GET /products/barcode/{code}` con un valor localmente válido, LA API devuelve el producto de catálogo más descripción no vacía, porción válida y stock entero no negativo, y `inStock` equivale a `stock > 0`.
- RF-15: CUANDO se solicita `GET /images/{kind}/{name}` para una referencia entregada por la API, LA API devuelve una imagen utilizable; SI la imagen no puede cargarse o su contenido no es una imagen válida, ENTONCES EL SISTEMA muestra el fallback accesible definido en RF-35.
- RF-16: CUANDO se envía `POST /orders`, EL SISTEMA entrega una clave de idempotencia y un cuerpo con uno o más items de `productId` y cantidad entera positiva, moneda `MXN` o `USD` y una dirección compuesta por nombre, teléfono, código postal, estado, ciudad, calle y número exterior, más número interior opcional, con las validaciones exactas de la spec 004.
- RF-17: CUANDO `POST /orders` o `GET /orders/status/{key}` responde `200`, LA API entrega `status: confirmed` y una orden con id, fecha, moneda, items, importes no negativos y totales; CUANDO responde `202`, entrega `status: pending` y `retryAfterSeconds` entero de al menos uno.
- RF-18: CUANDO `POST /orders` responde `400 VALIDATION_ERROR`, LA API puede entregar errores por path en `fields`; CUANDO responde `409 OUT_OF_STOCK`, informa indisponibilidad; y CUANDO responde `409 IDEMPOTENCY_KEY_REUSED`, entrega el enlace de estado para la misma clave.
- RF-19: CUANDO `GET /orders/status/{key}` responde `404`, LA API entrega la pareja `status: not_created` y `error.code: ORDER_NOT_CREATED`; CUANDO responde `410`, entrega `status: expired` y `error.code: IDEMPOTENCY_KEY_EXPIRED`.
- RF-20: SI una respuesta de orden usa un status HTTP, `status`, `error.code`, enlace o cuerpo que no corresponde a RF-17 a RF-19, ENTONCES EL SISTEMA la trata como incompatible, conserva o eleva el intento a `unresolved`, no confirma ni libera otra orden y ofrece consultar o reintentar el estado según la spec 004.
- RF-21: CUANDO se evalúa conformidad, EL PROYECTO usa el OpenAPI para identificar operaciones y esquemas declarados y usa pruebas de compatibilidad para verificar además RF-8 a RF-20, aunque sus parámetros o respuestas no estén descritos por completo en el OpenAPI actual.

### Idioma, caché y consultas
- RF-22: CUANDO el sistema solicita `GET /home`, `/categories`, `/brands`, `/products`, `/products/{product_id}` o `/products/barcode/{code}`, EL SISTEMA solicita `es` o `en` según el idioma vigente y solo presenta contenido localizado cuya declaración `Content-Language` sea exactamente coherente con el idioma solicitado.
- RF-23: SI `Content-Language` falta, es inválido, no es `es` o `en`, o no coincide con el idioma solicitado, ENTONCES EL SISTEMA trata la respuesta localizada como incompatible, muestra el estado de error aplicable y no la mezcla con caché válida de otro idioma.
- RF-24: CUANDO cambia el idioma vigente, EL SISTEMA conserva cachés separadas por idioma, solicita o reutiliza únicamente la del idioma nuevo y evita que una respuesta tardía del idioma anterior sustituya el contenido actual.
- RF-25: CUANDO el usuario busca, filtra, ordena, pagina o refresca productos, EL SISTEMA conserva normalización, CSV, combinación de facets, debounce, deduplicación, prioridad de parámetros recientes, posición de regreso y refresh definidos en la spec 003.
- RF-26: MIENTRAS existe una solicitud en vuelo para una consulta equivalente, EL SISTEMA no inicia una segunda solicitud simultánea para esa misma consulta; una consulta en otro idioma no es equivalente.
- RF-27: SI una lectura GET falla por transporte o 5xx, ENTONCES EL SISTEMA conserva la política vigente de exactamente dos reintentos automáticos antes del reintento manual; SI responde cualquier 4xx, incluido 422, ENTONCES ejecuta cero reintentos automáticos.

### Matriz observable de estados remotos
- RF-28: MIENTRAS Home no tiene datos y realiza su primera carga, EL SISTEMA muestra loading; CUANDO recibe `banners`, `categories` y `sections` válidos pero todos vacíos, muestra empty; SI hay fallo de transporte sin respuesta, muestra offline; SI hay 5xx, 4xx no reconocido o respuesta incompatible, muestra error; y SI ya había Home válido, conserva esos datos con aviso stale o actualización fallida y acción de reintento.
- RF-29: MIENTRAS un listado de productos no tiene datos y realiza su primera carga, EL SISTEMA muestra loading; CUANDO una página válida inicial tiene cero resultados, muestra empty; SI hay fallo de transporte sin respuesta, muestra offline; SI hay 5xx, 4xx no reconocido o respuesta incompatible, muestra error; y SI existe una lista válida previa, la conserva con el aviso stale o actualización fallida definido en las specs 003 y 006.
- RF-30: MIENTRAS categorías o marcas cargan dentro del panel de opciones, EL SISTEMA muestra loading en ese panel; CUANDO recibe un array válido vacío, muestra “sin opciones”; SI hay fallo de transporte, muestra offline con reintento; SI hay 4xx, 5xx o respuesta incompatible, muestra error con reintento; y SI existen opciones válidas previas, las conserva con aviso de actualización fallida.
- RF-31: MIENTRAS un detalle o búsqueda por código de barras no tiene datos y realiza su primera carga, EL SISTEMA muestra loading; SI la API responde 404, muestra no encontrado; SI falla el transporte, muestra offline; SI responde 4xx distinto de 404, 5xx o un cuerpo incompatible, muestra error; y SI existe detalle válido previo, lo conserva como stale con aviso de actualización fallida.
- RF-32: MIENTRAS una imagen remota carga, EL SISTEMA muestra su espacio de carga sin anunciar una acción inexistente; SI falla el transporte sin respuesta, representa la imagen como no disponible mediante el fallback accesible; SI la referencia está vacía, responde 4xx o 5xx o el contenido no es una imagen válida, muestra el mismo fallback y mantiene utilizables texto y navegación. Una imagen no tiene estado empty de colección ni aviso stale: si ya está disponible puede permanecer visible y, si no, usa el fallback.
- RF-33: MIENTRAS se consulta un intento de orden sin resultado terminal, EL SISTEMA muestra loading o `pending` sin liberar el bloqueo; ante 200, 202, 400, 404, 409 o 410 aplica RF-17 a RF-20 y la spec 004; ante transporte sin respuesta muestra offline, y ante 5xx, 4xx no reconocido incluido 422 o cuerpo incompatible muestra error seguro con acción de consulta o reintento. Order status no tiene estado empty ni libera por datos stale: en todos esos fallos conserva `unresolved` y nunca afirma confirmación.
- RF-34: SI un endpoint de lectura responde 422 o cualquier otro 4xx no reconocido, ENTONCES EL SISTEMA muestra un error seguro, no reintenta automáticamente y no refleja en pantalla ni registros el id, código, búsqueda u otra entrada rechazada.
- RF-35: SI una imagen usa fallback, ENTONCES EL SISTEMA ofrece texto alternativo localizado o una inicial/nombre accesible según el contexto, no expone una acción fantasma y conserva visibles o accesibles el nombre, precio, destino y demás información necesaria del elemento.

### Checkout, persistencia local y casos de datos desaparecidos
- RF-36: CUANDO comienza un intento nuevo de orden, EL SISTEMA genera dentro de la instalación una clave con entropía criptográfica que no reutiliza para otro intento; MIENTRAS recupera o consulta el mismo intento, reutiliza exclusivamente esa clave.
- RF-37: CUANDO hay doble toque, timeout, reinicio o respuesta incierta, EL SISTEMA conserva la idempotencia y transiciones `preliminary` y `unresolved` de la spec 004, sin crear una segunda orden ni reenviar datos personales a ciegas.
- RF-38: EL SISTEMA no persiste ni registra nombre, teléfono, dirección, cuerpo reversible de la orden, secretos, claves de idempotencia completas ni otros datos personales durante solicitudes, errores, diagnósticos o recuperación.
- RF-39: SI un producto guardado localmente deja de existir en la API, ENTONCES el carrito conserva su snapshot hasta que el usuario lo ajuste, checkout procesa el resultado contractual de validación o `OUT_OF_STOCK` y permite corregir según la spec 004, el historial de búsqueda permanece utilizable y un pedido confirmado conserva su resumen local sanitizado.
- RF-40: SI un id de producto no cumple `product-` seguido de seis dígitos, guion y tres dígitos, o un código no es un EAN-13 válido, ENTONCES EL SISTEMA lo rechaza localmente sin solicitarlo; una respuesta remota 422 inesperada sigue RF-34.

### Pruebas, E2E y plataformas
- RF-41: CUANDO se ejecuta la suite automática predeterminada, EL SISTEMA verifica el contrato y la matriz de RF-7 a RF-40 y RF-50 a RF-53 mediante datos controlados, sin iniciar ni requerir la API viva y sin depender de su stock u órdenes persistentes.
- RF-42: CUANDO se habilita la verificación viva, EL SISTEMA comprueba salud, rutas, formas, filtros, órdenes, errores e idioma exigidos por esta spec contra el origen configurado, sin modificar el servicio salvo durante el escenario de compra declarado.
- RF-43: CUANDO una verificación E2E viva intenta medir stock, LA VERIFICACIÓN exige antes stock mayor que cero y entorno exclusivo para el producto; registra el stock inicial, compra exactamente una unidad con una clave nueva, observa una única orden confirmada añadida al historial local y comprueba stock final igual a inicial menos uno.
- RF-44: SI no puede garantizarse exclusividad, el stock inicial es cero o se detecta interferencia concurrente, ENTONCES LA VERIFICACIÓN E2E se detiene como `INCONCLUSA` con la causa y los valores observados, no atribuye un fallo al producto, no crea otra orden y no inventa, ejecuta ni presupone un reset.
- RF-45: CUANDO se valida Android de forma bloqueante, EL SISTEMA completa la matriz de RF-48 en el Samsung físico conectado por USB, con redirección de los puertos 3001 y 8081 y origen `localhost`, incluido el escaneo de QR con payload EAN-13 válido, inexistente e inválido.
- RF-46: CUANDO se valida iOS de forma bloqueante, EL SISTEMA completa la parte aplicable de la matriz de RF-48 en iOS Simulator con origen `localhost`; SI el simulador no permite validar la cámara, ENTONCES la limitación se documenta explícitamente y no se presenta como una validación manual de cámara superada.
- RF-47: EL MATERIAL documenta Android Emulator con origen `10.0.2.2` como alternativa no bloqueante e iPhone físico mediante un origen LAN alcanzable como escenario fuera de la matriz bloqueante.
- RF-48: EN CADA destino bloqueante de RF-45 y RF-46, EL SISTEMA verifica: gate de origen ausente e inválido sin solicitudes; Home; categorías y marcas; catálogo con búsqueda, filtros, orden y paginación; cambio `es`/`en` sin mezcla; detalle y 404; EAN-13 directo; QR válido existente que contiene un EAN-13; QR válido cuyo EAN-13 no existe; QR inválido, URL, id, deep link y payload arbitrario rechazados sin solicitud; imagen válida y fallback; offline, stale y recuperación; checkout idempotente y consulta de estado; accesibilidad del contenido y errores; y ejecución del E2E de RF-43 o su clasificación `INCONCLUSA` según RF-44. La comprobación manual de QR con cámara es obligatoria en Samsung físico; en iOS Simulator se registra la limitación de cámara si aplica.
- RF-49: CUANDO se audita la ausencia de código no productivo, EL PROYECTO demuestra que los bundles o exportaciones de producción de Android e iOS y la aplicación instalada usada para la validación no contienen ni permiten activar backend, fixtures o dobles de runtime; los archivos y utilidades de pruebas pueden permanecer fuera de esos artefactos.

### Escáner: QR restringido a EAN-13
- RF-50: CUANDO el lector recibe una simbología QR, EL SISTEMA extrae su texto, elimina únicamente los espacios en blanco iniciales y finales y considera válido el resultado solo si es un EAN-13 válido; CUANDO el resultado es válido, EL SISTEMA reutiliza la consulta existente `GET /products/barcode/{ean13}` con ese EAN-13, sin cambiar ni ampliar el contrato de la API.
- RF-51: SI el texto de un QR, después del recorte indicado, no es exactamente un EAN-13 válido, ENTONCES EL SISTEMA lo rechaza localmente sin iniciar una solicitud remota; EL SISTEMA no interpreta URLs, ids de producto, deep links ni otros payloads arbitrarios como códigos de producto.
- RF-52: MIENTRAS se procesa un EAN-13 recibido directamente o extraído de un QR, EL SISTEMA conserva la deduplicación y el bloqueo contra dobles lecturas, y presenta los estados existentes de loading, error, no encontrado, offline y reintento sin crear un flujo remoto alternativo.
- RF-53: CUANDO un QR contiene un EAN-13 localmente válido que no existe en el catálogo, EL SISTEMA consulta el endpoint de código de barras existente y presenta no encontrado; CUANDO contiene un EAN-13 válido existente, EL SISTEMA conserva la navegación al producto correspondiente.

### Matriz de aceptación específica del escáner
| Escenario | Entrada | Resultado exigido | Validación |
|---|---|---|---|
| EAN-13 directo, regresión | Simbología EAN-13 con código válido | Una consulta al endpoint existente y conservación del flujo actual | Samsung físico e iOS mediante pruebas aplicables |
| QR válido existente | QR cuyo texto, tras recortar espacios externos, es un EAN-13 válido presente en el catálogo | Una consulta con el EAN-13 normalizado, navegación al producto y ningún contrato nuevo de API | Obligatorio en Samsung físico |
| QR válido inexistente | QR cuyo texto es un EAN-13 válido ausente del catálogo | Una consulta al endpoint existente y estado no encontrado, sin reintento automático por 404 | Obligatorio en Samsung físico |
| QR inválido | QR vacío, con longitud o checksum incorrectos, caracteres no permitidos o espacios internos | Rechazo local, estado invalid-code accesible y cero solicitudes | Obligatorio en Samsung físico y en pruebas automatizadas |
| QR no interpretable como producto | URL, id de producto, deep link u otro payload arbitrario | Rechazo local, sin abrir enlaces, resolver ids ni hacer solicitudes | Obligatorio en Samsung físico y en pruebas automatizadas |
| Doble lectura | Dos lecturas del mismo frame o durante una consulta | Una sola consulta y conservación del bloqueo y estados existentes | Pruebas automatizadas y comprobación manual en Samsung físico |

Los escenarios de QR se ejecutan con la API persistente, sin modificarla ni restaurar su catálogo. La validación manual de cámara se exige en Samsung físico; si iOS Simulator no permite cámara, la limitación se registra y no se declara superada esa comprobación manual.

## Requisitos no funcionales
- RNF-1: CUANDO se valida una ejecución normal, TODA fuente remota procede de la API configurada, mientras que los estados locales definidos en esta spec permanecen locales y no se confunden con respuestas remotas.
- RNF-2: CUANDO se ejecutan pruebas automáticas aisladas desde el mismo estado, EL SISTEMA produce resultados deterministas sin depender de red, stock u órdenes de la API viva.
- RNF-3: CUANDO cambia el idioma o llega una respuesta tardía, EL SISTEMA mantiene coherencia entre idioma de interfaz, `Content-Language` y caché presentada.
- RNF-4: CUANDO se usa texto ampliado, lector de pantalla, tema oscuro o movimiento reducido, EL SISTEMA conserva nombres, roles, estados, errores, contenido necesario y objetivos mínimos de 48 dp en Android y 44 pt en iOS, conforme a las specs anteriores.
- RNF-5: MIENTRAS se desplaza, busca, filtra o pagina el catálogo, EL SISTEMA satisface como umbrales bloqueantes una sola solicitud en vuelo por consulta equivalente, caché separada por idioma y ninguna transformación síncrona de todo el catálogo que obligue a una interacción a esperar a que termine.
- RNF-6: CUANDO se valida rendimiento, EL PROYECTO comprueba los tres umbrales de RNF-5 de forma dirigida y no repite la auditoría completa de profiling del Día 6.
- RNF-7: CUANDO la API devuelve una respuesta incompatible, EL SISTEMA falla de forma controlada, no cierra inesperadamente y no presenta datos parciales como válidos.
- RNF-8: CUANDO se valida la integración, EL PROYECTO supera comprobaciones de estilo, tipos estrictos, pruebas aisladas de lógica y componentes, auditoría de artefactos, verificación viva opt-in y la matriz bloqueante Android/iOS sin ignorar fallos; un E2E inconcluso se registra como tal y no como fallo del producto ni como prueba superada.
- RNF-9: CADA comprobación viva registra origen sin credenciales, plataforma, precondiciones, pasos, observación y resultado, pero nunca datos personales, claves completas, secretos ni identificadores privados de dispositivos.
- RNF-10: CUANDO se procesa un payload QR, EL SISTEMA no persiste ni registra el texto bruto, una URL, un id, un deep link, un payload arbitrario ni un código rechazado; el valor normalizado solo se usa para la consulta permitida del EAN-13.
- RNF-11: CUANDO se rechaza un QR, EL SISTEMA comunica el estado mediante el flujo localizado y accesible existente, conserva la acción para escanear de nuevo y respeta texto ampliado, lector de pantalla, tema oscuro, movimiento reducido y los objetivos táctiles mínimos de RF-4.

## Casos límite
- SI el usuario cambia de español a inglés o viceversa mientras una lectura está en vuelo, ENTONCES la respuesta del idioma anterior no sustituye ni etiqueta como vigente a la del idioma nuevo.
- SI `Content-Language` falta, contiene un valor no soportado o no coincide, ENTONCES el payload localizado completo es incompatible aunque su cuerpo tenga forma válida.
- SI solo existe caché del idioma anterior y la API no responde, ENTONCES el sistema no la presenta como contenido del idioma actual y muestra el estado de recuperación correspondiente.
- SI una combinación válida de búsqueda y filtros devuelve cero productos, ENTONCES conserva las selecciones y ofrece limpiarlas, sin recurrir a fixtures.
- SI categorías o marcas son arrays vacíos, ENTONCES el panel informa que no hay opciones y permanece operable; no presenta el panel como carga infinita.
- SI una página repite ids o llega después de que cambiaron idioma, búsqueda, filtros u orden, ENTONCES el payload duplicado se considera incompatible o se aplica la deduplicación histórica entre páginas, y nunca reemplaza la consulta vigente.
- SI un producto desaparece entre listado, carrito y checkout, ENTONCES se aplican RF-39 y las respuestas contractuales de orden sin borrar silenciosamente el snapshot o el historial local.
- SI un código de barras válido no existe, ENTONCES muestra no encontrado; SI el código es malformado, no inicia una solicitud.
- SI un QR contiene espacios externos alrededor de un EAN-13 válido, ENTONCES se recortan esos espacios antes de validar y consultar; SI contiene espacios internos, caracteres adicionales o un checksum incorrecto, ENTONCES se rechaza sin solicitud.
- SI un QR contiene una URL, un id de producto, un deep link o un payload arbitrario, ENTONCES se rechaza como entrada local no válida, sin abrirlo, interpretarlo, persistirlo ni enviarlo a la API.
- SI dos lecturas QR llegan antes de que React actualice el estado, ENTONCES solo una puede iniciar la consulta y la segunda no crea otra solicitud.
- SI el QR válido apunta a un EAN-13 inexistente, ENTONCES se muestra no encontrado; SI apunta a uno existente, ENTONCES se conserva la navegación al producto como en el escaneo EAN-13 directo.
- SI iOS Simulator no ofrece una cámara utilizable, ENTONCES la limitación se documenta y no se confunde con una validación manual QR superada; el Samsung físico sigue siendo el destino obligatorio para la comprobación de cámara.
- SI una imagen se rompe después de mostrar una tarjeta o banner, ENTONCES aparece el fallback de RF-35 sin eliminar texto, precio o navegación ni añadir un control accionable inexistente.
- SI el stock cambia sin exclusividad entre la lectura inicial y la confirmación, ENTONCES no se usa el delta para aprobar o reprobar el producto y la verificación termina inconclusa.
- SI el stock inicial exclusivo es uno y la compra se confirma, ENTONCES el stock final esperado es cero y el producto puede quedar agotado sin que la prueba intente restaurarlo.
- SI una orden queda `pending`, hay timeout o se interrumpe la app, ENTONCES la recuperación usa la misma clave del intento y consulta su estado sin reenvío ciego.
- SI una pareja 404/410 de order status es incompleta o inconsistente, ENTONCES el intento permanece `unresolved` y otra compra sigue bloqueada.
- SI se repite una verificación viva en un servidor que conserva órdenes, ENTONCES usa una clave de un intento nuevo y calcula expectativas desde el estado observado, no desde cifras históricas.
- SI la API viva no está configurada o no es alcanzable, ENTONCES la suite aislada sigue siendo ejecutable y la verificación opt-in informa la precondición incumplida sin sustituir el servicio.
- SI un fixture o doble de prueba aparece en un artefacto definido por RF-49 o puede activarse en la aplicación instalada, ENTONCES la integración no cumple el criterio de aislamiento.

## Fuera de alcance
- Autenticación, autorización, cuentas reales o sincronización de carrito, historial, preferencias u órdenes entre usuarios o dispositivos.
- Pagos reales, datos comerciales reales, analítica, publicación en tiendas o despliegue y operación del backend.
- Cambiar, completar o regenerar la API, su OpenAPI, sus datos, su política de persistencia o añadirle un mecanismo de reset.
- Asumir, restaurar o sembrar un stock inicial para verificaciones contra la API viva.
- Repetir la auditoría completa de profiling del Día 6 o introducir un nuevo objetivo temporal de rendimiento fuera de RNF-5.
- Eliminar dobles de red o fixtures que sean exclusivos de pruebas deterministas y estén fuera de los artefactos del producto.
- Convertir Android Emulator o iPhone físico en destinos bloqueantes de esta spec.
- Reescribir las specs 001 a 006, el aprendizaje o la evidencia histórica como si el backend mock nunca hubiera existido.

## Criterios de finalización
- El contrato de RF-7 a RF-21 queda cubierto por pruebas aisladas y por una verificación viva opt-in que no depende de que todos sus detalles figuren en OpenAPI.
- La matriz de RF-28 a RF-35 cubre de forma observable loading, empty o sin opciones cuando aplica, offline, 4xx, 5xx, stale/actualización fallida, respuesta incompatible, reintento y estados de dominio para cada fuente remota.
- Origen ausente e inválido mantienen el gate bilingüe accesible sin solicitudes, y un origen válido nunca activa un backend o fixture sustituto.
- Español e inglés quedan verificados con `Content-Language` coherente, cachés separadas y cambio de idioma durante una solicitud sin mezcla visible.
- Carrito, preferencias, historial y pedidos confirmados de esta instalación continúan locales; la desaparición de un producto cumple RF-39 y no promete sincronización externa.
- La clave de cada intento cumple RF-36, checkout conserva la spec 004 y el E2E verifica stock inicial menos uno y una sola orden local confirmada bajo exclusividad, o queda `INCONCLUSA` por RF-44 sin registrarse como aprobada.
- La matriz del escáner cubre RF-50 a RF-53: EAN-13 directo, QR válido existente, QR válido inexistente, QR inválido, payloads no interpretables, deduplicación y estados accesibles; la comprobación de cámara QR queda confirmada en Samsung físico o documentada como pendiente/limitada en iOS Simulator.
- Los tres umbrales bloqueantes de RNF-5 se verifican sin repetir la auditoría completa del Día 6.
- Samsung físico por USB completa RF-48, incluido QR mediante cámara; iOS Simulator completa la parte aplicable de RF-48 y documenta cualquier limitación de cámara; Android Emulator queda documentado como alternativa y el iPhone físico queda fuera de la matriz bloqueante.
- Los artefactos de RF-49 no contienen ni permiten activar backend, fixtures o dobles de runtime, mientras las pruebas aisladas conservan sus datos controlados fuera del producto.
- Las normas y documentación activas describen la API persistente y dejan de exigir mock-server; las specs 001 a 006, el aprendizaje y la evidencia previa permanecen como historia sin reescritura retrospectiva.
- La T10 queda cerrada con la confirmación manual registrada en `docs/evidence/spec-007-api-persistente.md`: Samsung completa RF-48; iOS Simulator cubre la parte aplicable y conserva la limitación explícita de cámara QR, sin presentarla como PASS físico. No cambian los requisitos RF-50 a RF-53.

## Dudas abiertas
- Ninguna.
