# Tareas 002 — Día 2: navegación y Home

- [ ] **T1. Sustituir la navegación del template por el stack raíz y cuatro tabs delgados.** RF-1, RF-2, RF-3, RF-4, RF-5, RF-6
- Hecho cuando: Inicio/Categorías/Carrito/Cuenta abren, no duplican rutas al reseleccionar y conservan pila/posición; parar y confirmar back y tabs en Android e iOS.
- [ ] **T2. Añadir modal, ruta dinámica y fallbacks.** RF-7, RF-8
- Hecho cuando: escáner abre/cierra como modal sin perder Home y producto válido/inválido ofrece el destino definido; parar y validar ambas plataformas.
- [ ] **T3. Resolver deep links en arranque frío y app activa.** RF-9
- Hecho cuando: `herbstore://product/:id` abre una sola pantalla y un enlace inválido vuelve a Inicio de forma controlada en Android e iOS.
- [ ] **T4. Crear el cliente aislado y los estados base de Home.** RF-10, RF-14, RF-15
- Hecho cuando: `/home` produce loading/success/error/offline/empty sin fetch dentro de componentes y las colecciones vacías siguen las reglas aprobadas.
- [ ] **T5. Construir cabecera, categorías y secciones de Home.** RF-10, RF-11, RF-16, RNF-1, RNF-3
- Hecho cuando: buscador/escáner, categorías circulares y Más vendidos/Nuevos/Ofertas navegan, cargan imágenes reservadas y están localizados/accesibles.
- [ ] **T6. Completar carrusel y ciclo de vida.** RF-12, RF-13, RNF-2
- Hecho cuando: avanza cada 5 s, pausa/reanuda según interacción/visibilidad/background y queda manual con reduced motion; parar y confirmar Android/iOS.
- [ ] **T7. Cerrar y validar el Día 2.** RF-17, RF-18, RF-19, RNF-4
- Hecho cuando: lint/typecheck pasan; matriz de navegación, Home, temas, texto ampliado y movimiento reducido se valida en Android/iOS; `LEARNING.md`, ejercicio, 8–10 respuestas, checklist y commit quedan completos; detenerse.
