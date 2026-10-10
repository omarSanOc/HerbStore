# Spec 005 — Día 5: capacidades nativas y plataforma
Estado: aprobada

## Contexto y objetivo
Con el flujo comercial completo, este día cruza el límite entre React Native y las plataformas. El objetivo es demostrar DeviceInsights con capacidades equivalentes en Kotlin y Swift, integrar escaneo EAN-13 y realimentación del dispositivo, y producir evidencia verificable sobre perfiles EAS, variables y límites OTA.

## Usuarios
- Cliente ficticio que quiere localizar un producto mediante su código y recibir realimentación del dispositivo.
- Candidato que necesita explicar funciones, asincronía, eventos, vistas y permisos en Android e iOS.

## Historias de usuario
- HU-1. Como cliente, quiero escanear un EAN-13 válido para abrir el producto correspondiente.
- HU-2. Como cliente, quiero recibir hápticos, compartir un producto y obtener una notificación local después de una orden.
- HU-3. Como candidato, quiero demostrar un contrato nativo equivalente en Kotlin y Swift y distinguir cambios OTA de cambios de binario.

## Definiciones
- **DeviceInsights:** módulo didáctico propio con función síncrona, operación asíncrona, evento hacia React Native y vista nativa equivalentes en Android e iOS.
- **Rearmado del escáner:** momento explícito en que el sistema vuelve a aceptar un código después de procesar el anterior.

## Requisitos funcionales
- RF-1: ANTES de cada construcción guiada, EL MATERIAL presenta un bloque teórico de máximo 10 minutos sobre Expo Modules, JSI, Codegen, permisos, eventos, vistas, EAS u OTA que se practicará después.
- RF-2: EL MATERIAL contrasta DeviceInsights con un TurboModule de React Native CLI y compara responsabilidades, ciclo de vida, asincronía, eventos y vistas con Kotlin/Android y Swift/iOS.
- RF-3: PARA cada alternativa nativa o de plataforma tratada, EL MATERIAL registra la elección, el trade-off y una alternativa descartada, incluida la justificación de una diferencia específica de plataforma frente a comportamiento común.
- RF-4: CUANDO se invoca la capacidad síncrona de DeviceInsights, EL SISTEMA devuelve inmediatamente `android` o `ios` según la plataforma y no incluye identificadores sensibles.
- RF-5: CUANDO se solicita la actualización asíncrona de DeviceInsights, EL SISTEMA devuelve plataforma, modelo, versión del sistema e indicador de dispositivo físico, o un error controlado sin bloquear la interfaz.
- RF-6: CUANDO la actualización asíncrona termina correctamente, DeviceInsights emite exactamente un evento con un resumen de esos datos y timestamp de emisión; desmontar el observador impide entregas posteriores y no duplica suscripciones.
- RF-7: CUANDO se presenta la vista nativa de DeviceInsights, EL SISTEMA refleja una etiqueta y un color de acento recibidos; al pulsarla emite una sola interacción con plataforma y timestamp.
- RF-8: CUANDO el usuario abre el escáner, EL SISTEMA comprueba y, si procede, solicita cámara con un propósito bilingüe; permiso denegado o restringido muestra Volver y Abrir ajustes cuando la plataforma lo admite.
- RF-9: MIENTRAS el escáner está activo, EL SISTEMA acepta únicamente 13 dígitos cuyo checksum EAN-13 sea válido; formatos o checksum inválidos no consultan el catálogo y muestran una explicación.
- RF-10: CUANDO se acepta un EAN-13, EL SISTEMA desactiva nuevas lecturas durante consulta y navegación; si encuentra producto abre un solo detalle, y si no existe muestra No encontrado con una acción Escanear de nuevo que rearma el lector.
- RF-11: CUANDO el usuario regresa al escáner después de un detalle o pulsa Escanear de nuevo, EL SISTEMA lo rearma; eventos repetidos o diferentes recibidos antes del rearmado se ignoran.
- RF-12: CUANDO el permiso cambia mientras la app está fuera de primer plano, EL SISTEMA vuelve a comprobarlo al regresar y sustituye cámara o fallback sin requerir reinicio.
- RF-13: CUANDO el escáner se desmonta durante consulta o eventos rápidos, EL SISTEMA ignora resultados posteriores y no navega, muestra mensajes ni conserva una cámara activa.
- RF-14: CUANDO la cámara no está disponible, EL SISTEMA muestra una salida bilingüe hacia búsqueda y no permite una lectura ficticia.
- RF-15: CUANDO un producto se agrega correctamente, EL SISTEMA solicita exactamente una respuesta háptica si la plataforma la soporta; la ausencia de soporte o la no ejecución por el sistema no bloquea la compra y el badge comunica el resultado.
- RF-16: CUANDO se confirma una orden y el permiso de notificaciones está `undetermined`, EL SISTEMA lo solicita una vez; con permiso `granted` programa una notificación local con el id de orden y sin dirección, y con `denied` no programa notificación ni altera la confirmación.
- RF-17: CUANDO una respuesta idempotente o una recuperación devuelve un id de orden ya notificado, EL SISTEMA no programa otra notificación; cada id de orden puede originar como máximo una notificación local.
- RF-18: CUANDO el usuario comparte un producto, EL SISTEMA entrega texto bilingüe y `herbstore://product/:id` al mecanismo nativo; cancelar o no disponer de receptor regresa sin modificar estado comercial.
- RF-19: CUANDO se prueba un deep link válido con herramientas nativas de Android e iOS, EL SISTEMA abre el mismo producto en arranque frío y activo; un enlace inválido sigue el fallback del Día 2.
- RF-20: EL MATERIAL distingue perfiles EAS de development y preview, y mantiene para ambos una evidencia fechada de configuración válida, identificadores coherentes y resultado de validación; si el servicio de compilación está disponible, incluye además el resultado de una compilación de validación, sin exigir publicación.
- RF-21: EL MATERIAL mantiene un inventario de variables por nombre, propósito, entorno y clasificación pública/secreta sin registrar valores secretos, y demuestra que una variable ausente produce un diagnóstico controlado.
- RF-22: EL MATERIAL clasifica al menos un cambio solo de JavaScript/recursos como candidato OTA y al menos un cambio de permiso, dependencia o módulo nativo como nuevo binario, con evidencia del resultado de la comprobación de compatibilidad.
- RF-23: EL SISTEMA ofrece en español e inglés todo texto visible añadido durante el día.
- RF-24: CUANDO concluye cada paso guiado, EL PROGRAMA se detiene hasta confirmar la capacidad real en Android y en iOS; una limitación ambiental no satisface la finalización.
- RF-25: CUANDO finaliza el día, EL MATERIAL entrega un ejercicio sin solución sobre eventos o permisos, entre 8 y 10 preguntas con respuestas cortas y un checklist oral de módulos, cámara, perfiles, variables y OTA.
- RF-26: CUANDO todos los criterios están validados, EL PROGRAMA actualiza el registro acumulado de aprendizaje en español y crea un commit claro en inglés.

## Requisitos no funcionales
- RNF-1: EL SISTEMA no expone, registra ni persiste identificadores sensibles, secretos, tokens, certificados, imágenes de cámara ni direcciones.
- RNF-2: MIENTRAS cámara o DeviceInsights esperan una operación, LOS CONTROLES de cancelar o volver responden y la interfaz no espera trabajo síncrono pesado antes de reflejar el toque.
- RNF-3: CUANDO se muestra permiso, escaneo o acción nativa, EL SISTEMA proporciona texto y estado accesibles y una alternativa que no depende de color, vibración o animación.
- RNF-4: CUANDO se valida el día, EL PROYECTO supera lint, tipos estrictos, compatibilidad y diagnóstico, y DeviceInsights y cámara se prueban realmente en Android e iOS.

## Casos límite
- SI el permiso cambia en Ajustes, ENTONCES al volver la app refleja el nuevo estado antes de activar cámara.
- SI se leen rápidamente códigos iguales o distintos, ENTONCES solo el primero válido anterior al rearmado inicia consulta.
- SI el checksum es inválido, ENTONCES no hay consulta ni navegación y el escáner queda disponible para otra lectura.
- SI el producto no existe, ENTONCES se muestra No encontrado y solo Escanear de nuevo rearma la lectura.
- SI DeviceInsights falla o se desmonta durante una operación, ENTONCES devuelve error controlado o descarta el resultado sin evento tardío.
- SI la vista recibe etiqueta vacía o color no admitido, ENTONCES usa contenido accesible por defecto y mantiene un único evento al pulsar.
- SI una orden se confirma con permiso `undetermined`, ENTONCES se solicita una vez y se programa solo si el resultado es `granted`.
- SI la misma orden se recupera o responde de nuevo por idempotencia, ENTONCES conserva una sola notificación asociada a su id.
- SI un cambio afecta permiso o código nativo, ENTONCES la evidencia lo clasifica como nuevo binario y no como OTA.

## Fuera de alcance
- Push remoto, credenciales de producción, publicación en tiendas y despliegue OTA de producción.
- Lectura o almacenamiento de imágenes, biometría y datos sensibles del dispositivo.
- Suite final de regresión y simulacro de entrevista, que corresponden al Día 6.

## Criterios de finalización
- DeviceInsights cumple RF-4 a RF-7 de forma equivalente y real en Android e iOS.
- El escáner cumple permiso, checksum, bloqueo, rearmado, no encontrado, desmontaje y cambios de permiso en ambas plataformas.
- El háptico de agregado y los estados `undetermined`, `granted`, `denied` y deduplicado por id de notificaciones se validan realmente en Android e iOS.
- Perfiles, inventario de variables y matriz OTA/binario dejan las evidencias verificables de RF-20 a RF-22 sin secretos.
- Se completan verificaciones, localización, ejercicio, 8–10 preguntas, checklist, registro y commit.

## Dudas abiertas
- Ninguna.
