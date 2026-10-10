# Spec 002 — Día 2: navegación y Home
Estado: aprobada

## Contexto y objetivo
Con el servidor y el sistema visual del Día 1 disponibles, este día convierte la entrada inicial en una experiencia navegable y completa Home. Home consume los datos remotos necesarios; el Día 3 incorporará el comportamiento definitivo de caché y estado remoto sin cambiar ni duplicar su experiencia observable.

## Usuarios
- Cliente ficticio que quiere descubrir categorías y productos desde Inicio.
- Candidato que necesita relacionar Expo Router y React Navigation con Navigation Compose y SwiftUI NavigationStack.

## Historias de usuario
- HU-1. Como cliente, quiero moverme entre las cuatro áreas principales y conservar el contexto de cada una.
- HU-2. Como cliente, quiero descubrir banners, categorías y secciones de productos para iniciar una búsqueda o compra.
- HU-3. Como candidato, quiero demostrar tabs, stacks, modal, parámetros y deep links con comportamientos verificables.

## Definiciones
- **Estado de tab:** ruta activa, pila interna y posición de desplazamiento que existían antes de cambiar a otro tab.
- **Placeholder:** destino identificado y navegable cuya función final pertenece a otro día.

## Requisitos funcionales
- RF-1: ANTES de cada construcción guiada, EL MATERIAL presenta un bloque teórico de máximo 10 minutos sobre el patrón de navegación que se practicará.
- RF-2: EL MATERIAL explica layouts, tabs, stacks, modales, rutas dinámicas, parámetros y deep links de Expo Router, su relación con React Navigation y sus equivalentes en Navigation Compose y SwiftUI NavigationStack.
- RF-3: PARA cada alternativa de navegación tratada, EL MATERIAL documenta la elección de HerbStore, su trade-off y una alternativa descartada.
- RF-4: MIENTRAS la app está abierta, EL SISTEMA ofrece exactamente los tabs Inicio, Categorías, Carrito y Cuenta; Carrito muestra la suma de unidades como badge y oculta el badge cuando la suma es cero.
- RF-5: CUANDO el usuario cambia de tab y regresa, EL SISTEMA restaura la pila interna y la posición de desplazamiento previas; tocar repetidamente el tab activo no crea rutas duplicadas.
- RF-6: CUANDO el usuario abre desde un tab una pantalla secundaria, EL SISTEMA la añade a la pila de ese tab y Atrás vuelve al destino inmediatamente anterior sin cambiar de tab.
- RF-7: CUANDO el usuario abre el escáner desde Inicio, EL SISTEMA presenta un modal cerrable sobre Home; cerrarlo restaura Home con su posición previa.
- RF-8: CUANDO una ruta dinámica recibe un id de producto válido, EL SISTEMA abre el destino de ese producto; SI el id falta, es inválido o no existe, ENTONCES muestra un estado no encontrado con acciones para volver e ir a Inicio.
- RF-9: CUANDO la app recibe `herbstore://product/:id`, EL SISTEMA abre el producto indicado tanto en arranque frío como con la app activa; un enlace no reconocido muestra una salida controlada hacia Inicio.
- RF-10: CUANDO el usuario abre Home, EL SISTEMA solicita y presenta buscador, acceso al escáner, banners con indicadores de página, categorías circulares y las secciones Más vendidos, Nuevos y Ofertas.
- RF-11: CUANDO el usuario toca buscador, escáner, categoría, banner o producto, EL SISTEMA abre el destino o placeholder correspondiente con el parámetro seleccionado.
- RF-12: MIENTRAS un carrusel visible tiene más de un banner, EL SISTEMA avanza cada 5 segundos y actualiza el indicador; CUANDO el usuario toca o arrastra, pausa el avance y lo reanuda 5 segundos después de terminar la interacción.
- RF-13: MIENTRAS la app está en segundo plano, el carrusel está fuera de pantalla o está activo movimiento reducido, EL SISTEMA pausa el autoplay; al volver a primer plano y ser visible, reanuda una nueva espera completa salvo que movimiento reducido siga activo.
- RF-14: MIENTRAS Home espera su primera respuesta, EL SISTEMA muestra una representación de carga; SI falla sin datos previos, ENTONCES muestra error u offline con reintento; SI conserva datos previos al perder red, ENTONCES los mantiene visibles y muestra un aviso offline.
- RF-15: SI banners, categorías o una sección llegan vacíos, ENTONCES EL SISTEMA omite únicamente esa colección; SI todas llegan vacías, ENTONCES muestra un estado vacío con reintento.
- RF-16: EL SISTEMA ofrece en español e inglés todo texto visible añadido durante el día, incluidos tabs, estados, acciones y etiquetas accesibles.
- RF-17: CUANDO concluye cada paso guiado, EL PROGRAMA se detiene hasta confirmar la ruta o sección en Android y en iOS.
- RF-18: CUANDO finaliza el día, EL MATERIAL entrega un ejercicio sin solución sobre una ruta parametrizada, entre 8 y 10 preguntas con respuestas cortas y un checklist oral de layouts, tabs, stacks, modales y deep links.
- RF-19: CUANDO todos los criterios están validados, EL PROGRAMA actualiza el registro acumulado de aprendizaje en español y crea un commit claro en inglés; antes no da el día por completado.

## Requisitos no funcionales
- RNF-1: CUANDO se navega por Home y tabs, EL SISTEMA expone nombre, rol, selección y badge a tecnologías de asistencia, admite texto escalado y mantiene objetivos mínimos de 48 dp en Android y 44 pt en iOS.
- RNF-2: SI el usuario solicita movimiento reducido, ENTONCES el carrusel conserva paginación manual, desactiva autoplay y elimina transiciones no esenciales.
- RNF-3: MIENTRAS se cargan imágenes ficticias, EL SISTEMA reserva sus dimensiones y presenta una alternativa etiquetada si una imagen falla.
- RNF-4: CUANDO se valida el día, EL PROYECTO supera lint y comprobación estricta de tipos, y reproduce los mismos destinos en Android e iOS, tema claro/oscuro y texto ampliado.

## Casos límite
- SI llega un deep link durante arranque frío, ENTONCES abre un solo destino; SI llega otro con la app activa, reemplaza la intención pendiente sin duplicar pantallas.
- SI el usuario toca varias veces un destino durante una transición, ENTONCES se abre una sola instancia.
- SI hay cero banners, ENTONCES no se muestran indicadores ni autoplay; con un banner, se muestra sin autoplay.
- SI se pierde conexión con Home visible, ENTONCES se muestran datos previos con aviso o, si no existen, el estado offline con reintento.
- SI se activa movimiento reducido durante autoplay, ENTONCES el avance se detiene antes del siguiente cambio y permanece manual.
- SI se cambia de tab durante un desplazamiento y se regresa, ENTONCES se recuperan el tab, la pila y la posición anteriores.

## Fuera de alcance
- Filtros, búsqueda efectiva, paginación infinita y comportamiento definitivo de caché, que corresponden al Día 3.
- Detalle terminado, carrito y checkout, que corresponden al Día 4.
- Escaneo real y validación nativa de enlaces, que corresponden al Día 5.
- Auditoría final y automatización E2E, que corresponden al Día 6.

## Criterios de finalización
- Los cuatro tabs, badge, conservación de estado, pila, modal, ruta dinámica y deep link cumplen RF-4 a RF-9.
- Home presenta la composición exacta de RF-10, sus destinos, autoplay y estados carga/error/vacío/offline.
- Todo texto nuevo está disponible en español e inglés.
- Navegación y Home se verifican en Android e iOS con ambos temas, texto ampliado y movimiento reducido.
- Se revisan verificaciones, ejercicio, 8–10 preguntas, checklist, registro de aprendizaje y commit.

## Dudas abiertas
- Ninguna.
