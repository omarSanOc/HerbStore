# Tareas 003 — Día 3: datos, listas y rendimiento

- [ ] **T1. Incorporar store y base de RTK Query con política de red.** RF-1, RF-2, RF-3, RF-5, RF-6, RF-8
- Hecho cuando: providers y hooks tipados funcionan, fresh dura 60 s, refresh fuerza red y red/5xx ejecuta exactamente dos retries mientras 4xx ejecuta cero.
- [ ] **T2. Migrar Home a RTK Query sin cambiar su UI.** RF-4, RF-5, RF-7
- Hecho cuando: Home conserva secciones/estados del Día 2, dos consumidores comparten request y la invalidación definida vuelve a consultar; parar y confirmar Android/iOS.
- [ ] **T3. Crear identidad de consulta, endpoints y merge paginado.** RF-9, RF-10, RF-11, RF-15
- Hecho cuando: páginas se agregan una vez, ids se deduplican, respuestas obsoletas no sustituyen datos y sort/filtros reinician en página 1.
- [ ] **T4. Construir cuadrícula, tarjeta y estados de lista.** RF-9, RF-10, RF-12, RF-19, RNF-1, RNF-2, RNF-3
- Hecho cuando: FlashList de dos columnas muestra contador, skeleton/footer/refresh/error/offline/empty y carga al entrar en los últimos cuatro; parar y validar scroll/texto/reduced motion en ambas plataformas.
- [ ] **T5. Añadir filtros rápidos, avanzados y orden remoto.** RF-13, RF-14, RF-15
- Hecho cuando: chips y sheet producen parámetros aprobados, Cancelar conserva selección y total/páginas provienen del servidor; confirmar gestos Android/iOS.
- [ ] **T6. Completar búsqueda e historial en memoria.** RF-16, RF-17, RF-18
- Hecho cuando: debounce es 400 ms, identidad ignora case/diacríticos/espacios, historial deduplica/mueve/limita a 10 y permite borrar individual/todo.
- [ ] **T7. Instalar el fallback global y medir antes de optimizar.** RF-20, RF-21, RF-22
- Hecho cuando: un error de render muestra fallback es/en y recuperación sin bucle, y `LEARNING.md` registra baseline/comparación de renders y duración.
- [ ] **T8. Cerrar y validar el Día 3.** RF-23, RF-24, RF-25, RNF-4
- Hecho cuando: lint/typecheck y matriz cache/retry/paginación/filtros/offline pasan; listado y búsqueda se validan Android/iOS; ejercicio, 8–10 respuestas, checklist, `LEARNING.md` y commit quedan completos; detenerse.
