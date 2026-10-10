# Spec 006 — Día 6: calidad y preparación de entrevista
Estado: aprobada

## Contexto y objetivo
El último día consolida HerbStore como evidencia para entrevista. Audita y corrige omisiones de localización, accesibilidad y rendimiento sin aceptar deuda conocida de días anteriores; valida el flujo crítico con pruebas proporcionales y cierra con un live coding de 45 minutos y un banco final separado del repaso diario.

## Usuarios
- Candidato que necesita practicar implementación, diagnóstico y comunicación bajo tiempo limitado.
- Entrevistador que quiere observar calidad, accesibilidad, rendimiento y criterio multiplataforma.
- Cliente ficticio que usa HerbStore en español o inglés y puede depender de tecnologías de asistencia.

## Historias de usuario
- HU-1. Como cliente, quiero elegir idioma, moneda y tema y conservar esas preferencias.
- HU-2. Como cliente, quiero consultar los pedidos confirmados en esta instalación después de reiniciar.
- HU-3. Como cliente con necesidades de accesibilidad, quiero completar el flujo con lector de pantalla, texto ampliado y movimiento reducido.
- HU-4. Como candidato, quiero una suite de regresión, un simulacro cronometrado y preguntas modelo para identificar vacíos antes de la entrevista.

## Definiciones
- **Flujo crítico:** buscar un producto, agregarlo, completar checkout y observar una única confirmación.
- **Baseline:** medición previa de la misma interacción, dispositivo, datos y configuración usada para comparar una optimización.

## Requisitos funcionales
- RF-1: ANTES de cada construcción o corrección, EL MATERIAL presenta un bloque teórico de máximo 10 minutos sobre pruebas, accesibilidad, localización o profiling que se practicará después.
- RF-2: EL MATERIAL compara Jest, React Native Testing Library y Maestro con enfoques Android/iOS, y para cada alternativa tratada registra elección, trade-off y opción descartada.
- RF-3: CUANDO se ejecutan pruebas unitarias, EL SISTEMA verifica de forma determinista reducers y selectors de cantidades, eliminación, subtotal convertido y umbral canónico de 800 MXN.
- RF-4: CUANDO se ejecutan pruebas de componentes, EL SISTEMA verifica conducta visible y accesible de carga, error, offline, vacío, validación, bloqueo y reintento sin depender de detalles internos.
- RF-5: CUANDO una prueba necesita datos remotos, EL SISTEMA usa respuestas controladas de RTK Query para éxito, vacío, 4xx, 5xx, timeout y latencia, sin depender de internet.
- RF-6: CUANDO se ejecuta el escenario Maestro desde un estado limpio, EL SISTEMA busca un producto, lo agrega, completa una dirección válida, protege el doble toque y verifica una sola confirmación de orden.
- RF-7: CUANDO la auditoría encuentra texto visible o accesible sin español o inglés, EL SISTEMA lo corrige antes de finalizar; nombres ficticios propios pueden conservarse y ningún texto nuevo de días anteriores queda deliberadamente pendiente.
- RF-8: CUANDO el usuario cambia idioma, EL SISTEMA actualiza textos, validaciones y anuncios y conserva la preferencia tras reiniciar.
- RF-9: CUANDO el usuario elige MXN o USD, EL SISTEMA aplica la tasa fija, formato local y umbral convertido definidos en el Día 4 y conserva la preferencia tras reiniciar.
- RF-10: CUANDO el usuario elige tema claro, oscuro o del sistema en Cuenta, EL SISTEMA lo aplica en toda la app y lo conserva; si sigue al sistema, refleja cambios con la app abierta.
- RF-11: CUANDO el usuario abre Mis pedidos, EL SISTEMA muestra solo resúmenes confirmados por esta instalación y los conserva tras reiniciar; nunca muestra dirección ni promete sincronización o recuperación externa.
- RF-12: CUANDO no existen pedidos locales, EL SISTEMA muestra un estado vacío bilingüe con acción para ir a Inicio.
- RF-13: CUANDO se auditan colores, EL SISTEMA alcanza WCAG AA: al menos 4.5:1 para texto normal y 3:1 para texto grande y componentes de interfaz.
- RF-14: CUANDO se audita con TalkBack y VoiceOver, EL MATERIAL registra evidencia en Android e iOS de orden de foco, nombre/rol/estado, retorno de foco al cerrar modal o bottom sheet, anuncios de errores y operación del flujo crítico.
- RF-15: CUANDO se audita texto ampliado, objetivos táctiles y movimiento reducido, EL SISTEMA evita truncar información necesaria, mantiene mínimos de 48 dp Android y 44 pt iOS y conserva un resultado estático para acciones animadas.
- RF-16: CUANDO se perfilan Home, listado y carrito, EL MATERIAL registra baseline de renders y duración de trabajo JavaScript/UI para una interacción repetible; después de un cambio repite las mismas condiciones y conserva el cambio solo si mejora una medida sin empeorar otra ni romper conducta o accesibilidad.
- RF-17: SI la app está offline durante catálogo o checkout, ENTONCES distingue datos previos, ofrece reintento y nunca muestra una orden confirmada sin respuesta idempotente; la prueba correspondiente verifica cada resultado.
- RF-18: CUANDO comienza el live coding, EL CANDIDATO dispone de exactamente 45 minutos para completar un flujo acotado que consume un endpoint dado, presenta una lista paginada, busca con debounce y muestra error con reintento.
- RF-19: CUANDO termina el minuto 45, EL EJERCICIO se detiene y se evalúan por separado resultado funcional, paginación, búsqueda, error/reintento, tipos, estado/efectos, accesibilidad, estrategia de pruebas, explicación Android/iOS y gestión del tiempo; lo incompleto se registra sin ampliar el plazo.
- RF-20: EL MATERIAL contiene exactamente 30 preguntas finales, separadas de las preguntas diarias, que cubren arquitectura, rendimiento, New Architecture, estado, navegación, offline, seguridad, CI/CD, releases y OTA; cada pregunta incluye una respuesta modelo y una frase específica de conexión con banca o Clean Architecture.
- RF-21: CUANDO concluye cada paso guiado, EL PROGRAMA se detiene hasta confirmar el resultado en Android y en iOS.
- RF-22: CUANDO finaliza el día, EL MATERIAL entrega un ejercicio sin solución distinto del live coding, entre 8 y 10 preguntas de repaso con respuestas cortas que no sustituyen el banco final y un checklist oral para la entrevista.
- RF-23: CUANDO todos los criterios están validados, EL PROGRAMA actualiza el registro acumulado de aprendizaje en español y crea un commit claro en inglés.

## Requisitos no funcionales
- RNF-1: CUANDO se ejecuta la suite desde el mismo estado inicial, EL SISTEMA produce los mismos resultados y no depende de internet, marcas reales, secretos ni datos personales.
- RNF-2: CUANDO se valida la versión final, EL PROYECTO supera lint, tipos estrictos, pruebas unitarias, componentes, flujo E2E y comprobaciones reales Android/iOS sin ignorar fallos.
- RNF-3: MIENTRAS cambian idioma, moneda o tema, EL SISTEMA mantiene la misma preferencia entre pantallas, reinicios y plataformas.
- RNF-4: CADA evidencia de accesibilidad, profiling o live coding registra plataforma, condición, pasos, observación y resultado para poder repetirla.

## Casos límite
- SI falta una traducción o interpolación, ENTONCES la auditoría falla hasta añadir ambas variantes y verificar el contexto.
- SI un importe es cero, tiene decimales o cambia simultáneamente idioma y moneda, ENTONCES usa la preferencia final y conserva el valor canónico.
- SI el tema sigue al sistema y este cambia, ENTONCES toda pantalla visible actualiza colores sin reiniciar.
- SI no hay pedidos, ENTONCES Mis pedidos muestra el estado vacío; si hay pedidos, sobreviven el reinicio sin dirección.
- SI Maestro encuentra datos previos, ENTONCES restablece el estado antes del flujo y no continúa sobre una compra existente.
- SI se cierra un modal o bottom sheet con lector activo, ENTONCES el foco vuelve al control que lo abrió.
- SI una optimización mejora duración pero aumenta renders o rompe accesibilidad, ENTONCES se descarta y se conserva el baseline funcional.
- SI el live coding queda incompleto al minuto 45, ENTONCES se detiene, se evalúa lo observable y no se extiende el tiempo.

## Fuera de alcance
- Pagos, autenticación, analítica, sincronización multi-dispositivo, servicios de producción y publicación en tiendas.
- Nuevas pantallas comerciales o dependencias fuera del alcance aprobado.
- Porcentajes de cobertura sin relación con riesgos o sustitución de las herramientas de prueba acordadas.

## Criterios de finalización
- Las pruebas cubren RF-3 a RF-6 y el E2E completa una sola orden desde estado limpio.
- Español/inglés, MXN/USD, tema y Mis pedidos se verifican tras reiniciar en Android e iOS.
- Contraste, TalkBack, VoiceOver, texto ampliado, foco, movimiento reducido y profiling dejan evidencia repetible y satisfacen RF-13 a RF-16.
- Se realiza exactamente un live coding de 45 minutos y se entregan 30 preguntas finales con respuesta y conexión individual, separadas del repaso diario.
- Se completan verificaciones, ejercicio adicional, 8–10 preguntas, checklist, registro y commit final.

## Dudas abiertas
- Ninguna.
