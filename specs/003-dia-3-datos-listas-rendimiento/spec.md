# Spec 003 — Día 3: datos, listas y rendimiento
Estado: aprobada

## Contexto y objetivo
Con Home y el servidor disponibles, este día establece el comportamiento definitivo de datos remotos con RTK Query para Home, listado y búsqueda, reutilizando la experiencia de Home sin duplicarla. El objetivo es dominar caché, invalidación, reintentos, paginación y listas grandes mediante resultados observables y mediciones previas a cualquier optimización.

## Usuarios
- Cliente ficticio que quiere explorar y encontrar productos por categoría, texto, filtros y orden.
- Candidato que debe explicar datos remotos y rendimiento frente a patrones Android e iOS.

## Historias de usuario
- HU-1. Como cliente, quiero recorrer una cuadrícula paginada sin duplicados ni pérdida de posición.
- HU-2. Como cliente, quiero buscar, filtrar y ordenar para obtener resultados coherentes y recuperarme de errores.
- HU-3. Como candidato, quiero demostrar cuándo se reutiliza, invalida o reintenta una consulta y medir el efecto de una optimización.

## Definiciones
- **Consulta equivalente:** consulta con la misma identidad normalizada de búsqueda, conjuntos de facets, orden, página y límite, independientemente del uso de mayúsculas, diacríticos o del orden de valores dentro de un facet.
- **Forma normalizada:** identidad de comparación obtenida al quitar espacios exteriores, reducir espacios internos consecutivos a uno, usar minúsculas y omitir diacríticos; la interfaz puede conservar el texto humano más reciente.
- **Historial:** hasta 10 búsquedas identificadas por su forma normalizada y ordenadas de la más reciente a la más antigua.

## Requisitos funcionales
- RF-1: ANTES de cada construcción guiada, EL MATERIAL presenta un bloque teórico de máximo 10 minutos sobre RTK Query, caché, tags, invalidación, refetch, paginación o listas que se practicará después.
- RF-2: EL MATERIAL compara el flujo remoto con Repository y Coroutines/Flow en Android y asincronía/observación en iOS; contrasta FlashList con FlatList, LazyVerticalGrid y LazyVGrid.
- RF-3: PARA cada alternativa de datos o listas tratada, EL MATERIAL registra la elección de HerbStore, el trade-off y una alternativa descartada.
- RF-4: CUANDO Home adopta el comportamiento remoto definitivo, EL SISTEMA conserva las secciones, destinos y estados del Día 2 y una consulta equivalente compartida no provoca dos solicitudes simultáneas.
- RF-5: MIENTRAS no hayan transcurrido 60 segundos desde una respuesta satisfactoria, EL SISTEMA considera fresca una consulta equivalente y la reutiliza sin red; después de 60 segundos, la siguiente apertura, foco o reconexión muestra la caché disponible y revalida en segundo plano una sola vez.
- RF-6: CUANDO el usuario hace pull-to-refresh, EL SISTEMA fuerza una solicitud aunque la caché esté fresca, descarta páginas incompatibles y conserva únicamente la respuesta más reciente para los parámetros vigentes.
- RF-7: CUANDO se confirma una orden, EL SISTEMA invalida Home, las consultas de productos y los detalles de los productos incluidos; las consultas activas revalidan y las inactivas lo hacen en su siguiente apertura.
- RF-8: SI una solicitud falla por red o 5xx, ENTONCES EL SISTEMA ejecuta exactamente dos reintentos automáticos con espera creciente y después ofrece reintento manual; ante 4xx ejecuta cero reintentos automáticos.
- RF-9: CUANDO el usuario abre una categoría, EL SISTEMA muestra contador total y productos en cuadrícula de dos columnas; regresar desde un producto restaura resultados, filtros, orden y posición.
- RF-10: CUANDO cualquiera de los últimos cuatro productos visibles entra en pantalla y `page < totalPages`, EL SISTEMA solicita una sola vez la página siguiente; con `page = totalPages` no solicita otra.
- RF-11: CUANDO llega una página adicional, EL SISTEMA agrega ids aún no presentes y conserva el primer ejemplar de cualquier id duplicado; una respuesta tardía de parámetros anteriores no reemplaza la lista vigente.
- RF-12: MIENTRAS carga la primera página, EL SISTEMA muestra skeletons con la forma de la cuadrícula; durante carga adicional conserva productos y muestra progreso al final; durante refresh conserva la lista hasta recibir la respuesta nueva.
- RF-13: CUANDO el usuario activa Disponible, 4★ o más, Marca propia o Suscríbete y ahorra, EL SISTEMA solicita remotamente `inStock=true`, `minRating=4`, `ownBrand=true` o `subscribeAndSave=true` y refleja cada selección activa.
- RF-14: CUANDO el usuario aplica marcas o subcategorías, EL SISTEMA envía cada facet como CSV, combina con OR los valores del mismo facet y con AND los facets distintos; resultados, contador y páginas proceden de la respuesta filtrada antes de paginar. Cancelar conserva los filtros anteriores.
- RF-15: CUANDO el usuario selecciona orden, EL SISTEMA usa exactamente `featured`, `price_asc`, `price_desc`, `rating` o `best_selling`, muestra la opción activa y reinicia la lista en la primera página.
- RF-16: CUANDO la forma normalizada no está vacía, EL SISTEMA espera 400 ms desde el último cambio antes de buscar en marca, nombre y descripción; respuestas anteriores no sustituyen la búsqueda más reciente.
- RF-17: CUANDO el usuario envía una búsqueda o selecciona un resultado, EL SISTEMA usa la forma normalizada como identidad, conserva como texto visible la variante humana más reciente y la mueve al inicio sin duplicarla; al superar 10 elimina la más antigua.
- RF-18: CUANDO el campo vacío obtiene foco, EL SISTEMA muestra el historial; el usuario puede ejecutar una entrada, borrar una entrada o borrar todo, y la acción se refleja inmediatamente. La persistencia tras reinicio se completa en el Día 4 sin cambiar estas reglas.
- RF-19: SI una consulta no tiene resultados, ENTONCES EL SISTEMA muestra estado vacío y acción para limpiar búsqueda/filtros; SI falla sin datos, muestra error u offline y reintento; SI existen datos previos, los conserva con su estado de desactualización visible.
- RF-20: SI ocurre un error inesperado de render en cualquier zona de la app, ENTONCES EL SISTEMA muestra un fallback global bilingüe y accesible que permite reintentar el render o volver al inicio con estado efímero reiniciado; los errores de API permanecen en sus estados locales.
- RF-21: CUANDO se evalúa una optimización, EL MATERIAL registra para la misma interacción el número de renders y la duración observada antes y después; solo conserva la optimización si al menos una medida mejora y ninguna conducta cambia.
- RF-22: EL SISTEMA ofrece en español e inglés todo texto visible añadido durante el día.
- RF-23: CUANDO concluye cada paso guiado, EL PROGRAMA se detiene hasta confirmar el estado en Android y en iOS.
- RF-24: CUANDO finaliza el día, EL MATERIAL entrega un ejercicio sin solución de filtro y paginación, entre 8 y 10 preguntas con respuestas cortas y un checklist oral de caché, reintentos, listas, debounce y medición.
- RF-25: CUANDO todos los criterios están validados, EL PROGRAMA actualiza el registro acumulado de aprendizaje en español y crea un commit claro en inglés.

## Requisitos no funcionales
- RNF-1: MIENTRAS se desplaza el catálogo de 300 productos, EL SISTEMA permite iniciar un toque o desplazamiento sin esperar a que termine una transformación síncrona de todo el catálogo.
- RNF-2: CUANDO cambia el tamaño de texto, LAS TARJETAS conservan nombre, precio, estado y acción visibles o accesibles sin depender solo del color.
- RNF-3: SI está activo movimiento reducido, ENTONCES skeletons, panel de filtros y cambios de lista eliminan movimiento no esencial y conservan indicadores estáticos.
- RNF-4: CUANDO se valida el día, EL PROYECTO supera lint, tipos estrictos y comprobaciones deterministas de normalización, filtros, paginación, reintentos e interacciones, además de Android e iOS.

## Casos límite
- SI dos páginas contienen el mismo id, ENTONCES la lista muestra una sola tarjeta y conserva el primer ejemplar recibido.
- SI refresh coincide con carga adicional, ENTONCES refresh invalida la carga anterior y el resultado final parte de la primera página nueva.
- SI cambian filtros u orden durante una solicitud, ENTONCES solo la respuesta de los parámetros más recientes puede actualizar la lista.
- SI la búsqueda contiene solo espacios, ENTONCES no consulta y muestra historial; sin coincidencias muestra vacío con acción para limpiar.
- SI dos búsquedas difieren solo en mayúsculas, diacríticos o espacios consecutivos, ENTONCES comparten identidad, conservan la variante humana más reciente y ocupan una sola entrada del historial.
- SI filtros combinados producen cero resultados, ENTONCES conserva las selecciones visibles y permite limpiarlas en una acción.
- SI vuelve la red tras un estado offline, ENTONCES el reintento actualiza datos y elimina el indicador offline solo después de una respuesta satisfactoria.
- SI el fallback global vuelve a fallar al reintentar, ENTONCES ofrece volver al inicio sin entrar en un bucle automático.

## Fuera de alcance
- Persistencia tras reinicio del historial y del carrito, que corresponde al Día 4.
- Detalle completo, gestos de carrito y checkout, que corresponden al Día 4.
- Escaneo y realimentación nativa, que corresponden al Día 5.
- Auditoría integral de rendimiento y E2E final, que corresponden al Día 6.

## Criterios de finalización
- Home, categoría y búsqueda cumplen caché, invalidación y reintentos medibles sin solicitudes simultáneas duplicadas.
- La cuadrícula cumple contador, filtros remotos, orden, debounce, paginación, refresh y estados de RF-9 a RF-19.
- El historial cumple alta, normalización, deduplicación, límite y borrado, y el fallback global cubre toda la app.
- Existe una comparación de rendimiento con baseline y resultado, y todo texto nuevo está en español e inglés.
- Se completan verificaciones en Android/iOS, ejercicio, 8–10 preguntas, checklist, registro y commit.

## Dudas abiertas
- Ninguna.
