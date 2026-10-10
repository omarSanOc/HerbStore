# HerbStore mock server

Servidor Node independiente de la aplicación Expo. Sus dependencias se instalan y ejecutan desde `mock-server`.

```bash
npm --prefix mock-server install
npm --prefix mock-server run dev
```

El puerto predeterminado es `3001` y el proceso escucha en todas las interfaces locales. `MOCK_LATENCY_MS` configura una latencia artificial no negativa para los endpoints de catálogo; `fail=true` responde 500 después de esa espera. Las órdenes no aceptan `fail`: `ORDER_PROCESSING_MS` configura su intervalo pending (1000 ms por defecto) sin aplicar la simulación de fallo del catálogo.

Contratos disponibles en este checkpoint:

- `GET /health` → `{ "status": "ok" }`
- `GET /home` → banners ficticios, categorías destacadas y secciones derivadas del catálogo.
- `GET /categories` → árbol de categorías/subcategorías con conteos.
- `GET /products` → filtros, búsqueda, sort y paginación `{ items, page, totalPages, total }`.
- `GET /products/:id` y `GET /products/barcode/:code` → detalle por identidad.
- `GET /brands` → marcas ficticias con conteos.
- `POST /orders` → recibe `Idempotency-Key` y un body strict `{ items, shippingAddress, currency }`; crea un único intento pending o devuelve el mismo resultado para un retry semánticamente equivalente.
- `GET /orders/status/:key` → devuelve 200 `confirmed`, 202 `pending`, 404 `not_created` o 410 `expired`.

Las rutas inexistentes responden 404 `NOT_FOUND` y los bodies que superan el límite de `express.json()` responden 413 `PAYLOAD_TOO_LARGE`, ambos con el envelope `{ error: { code, message } }` en JSON y sin eco de la ruta.

## Contrato de órdenes

- Cada item contiene exclusivamente `{ productId, quantity }`, sin ids duplicados y con quantity entera entre 1 y 99. El servidor toma precios del catálogo y no acepta totales enviados por el cliente.
- `shippingAddress` usa los campos MX definidos por la spec; se valida y se descarta después de calcular SHA-256. Ni la dirección ni el request reversible se conservan o se incluyen en respuestas.
- Una orden válida reserva stock y responde 202. Tras `ORDER_PROCESSING_MS`, la consulta o el retry confirma la misma identidad. Una key ligada a otro body responde 409 `IDEMPOTENCY_KEY_REUSED`; stock insuficiente responde 409 `OUT_OF_STOCK` sin activar la key. Las transiciones son diferidas (sin temporizadores): cada POST/GET reconcilia todos los intentos en orden cronológico (confirmar, expirar a 24 h, olvidar a 48 h) antes de actuar, de modo que un pending no consultado se confirma o libera su reserva igualmente.
- La asociación activa dura 24 horas. Entre 24 y 48 horas queda solo un tombstone y GET/POST responden 410; desde 48 horas se olvida y GET vuelve a 404.
- Los 400 de payload usan `VALIDATION_ERROR` y un mapa `fields` de paths a códigos estables, nunca valores recibidos.

## Direcciones desde cada plataforma

Con el servidor ejecutándose en el equipo de desarrollo:

- Android Emulator: `http://10.0.2.2:3001`
- iOS Simulator: `http://localhost:3001`
- Dispositivo físico en la misma red: `http://<LAN_IP_DEL_EQUIPO>:3001`

En un Android físico conectado por USB también puede usarse `adb reverse tcp:3001 tcp:3001` y acceder a `http://localhost:3001`. Para la conexión por red local, el firewall debe permitir conexiones entrantes a Node y ambos dispositivos deben estar en la misma red.

Comprueba una dirección añadiendo `/health`, por ejemplo `http://10.0.2.2:3001/health`.
