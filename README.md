# HerbStore

App móvil de e-commerce de suplementos para aprender React Native y preparar entrevistas técnicas mobile. Está construida con Expo SDK 57 y React Native 0.86 (New Architecture) y se compara de forma constante con Kotlin/Compose y Swift/SwiftUI.

> **HerbStore es una app ficticia y didáctica.** El catálogo (300 productos) lo genera un servidor mock con Faker y una semilla fija; no hay marcas, logos ni imágenes reales, ni tienda real, ni pagos reales. Cualquier parecido con productos o empresas existentes es casual.

## Qué incluye

- Catálogo remoto con listas paginadas, búsqueda con historial, categorías y detalle de producto.
- Carrito persistido y checkout con `Idempotency-Key` estable por intento.
- Interfaz en español e inglés, moneda MXN/USD con `Intl.NumberFormat`, tema claro/oscuro y preferencias persistidas.
- Funciones nativas: escáner de códigos EAN-13 (`expo-camera`), notificaciones locales, haptics y un Expo Module propio en Kotlin y Swift (`modules/device-insights`).
- Accesibilidad como requisito: objetivos táctiles de 44 pt / 48 dp, texto ampliado, movimiento reducido y contraste medido con una función pura.

## Stack

- Expo SDK 57, React Native 0.86, Development Build y New Architecture. **Nunca Expo Go.**
- TypeScript estricto, Expo Router, Redux Toolkit con RTK Query, redux-persist y MMKV.
- FlashList, expo-image, Reanimated, Gesture Handler y Gorhom Bottom Sheet.
- React Hook Form y Zod; i18next y expo-localization.
- Servidor mock independiente en `mock-server/` con Node, Express y Faker (semilla fija).

## Requisitos

- Node.js 22.18 o superior (`engines` de `package.json`).
- Xcode (iOS) y/o Android Studio con un dispositivo o emulador (Android).
- Un **Development Build** de la app instalado en el dispositivo o simulador. La app incluye módulos nativos propios, así que **no funciona en Expo Go**.

## Cómo arrancar

1. Instala las dependencias de la app y del servidor mock:

   ```bash
   npm install
   npm --prefix mock-server install
   ```

2. Arranca el servidor mock (puerto `3001` por defecto):

   ```bash
   npm --prefix mock-server run dev
   ```

3. Compila e instala el Development Build la primera vez (y cada vez que cambie una dependencia nativa, `app.json` o el módulo nativo):

   ```bash
   npx expo run:android --device
   npx expo run:ios --device
   ```

   `ios/` y `android/` son salidas generadas por Continuous Native Generation (CNG), están ignoradas por Git y no se editan a mano.

4. Arranca Metro para el Development Build:

   ```bash
   npx expo start --dev-client
   ```

### Dirección del servidor mock

La app resuelve el origen sola en desarrollo (`src/core/network/resolve-api-origin.ts`): `http://10.0.2.2:3001` en el emulador Android y `http://localhost:3001` en el simulador de iOS. Para un Android físico por USB:

```bash
adb reverse tcp:3001 tcp:3001
adb reverse tcp:8081 tcp:8081
```

Para forzar otro origen (por ejemplo un iPhone físico por LAN) define `EXPO_PUBLIC_API_ORIGIN` con un origen `http(s)://host[:puerto]` sin ruta, p. ej. en un `.env.local` ignorado por Git (hay una plantilla en `.env.example`), y reinicia Metro con `npx expo start --dev-client -c`. Los contratos y las direcciones por plataforma están en [`mock-server/README.md`](mock-server/README.md).

## Estructura

| Ruta | Contenido |
|---|---|
| `src/app/` | Rutas de Expo Router, delgadas: solo componen pantallas. |
| `src/features/` | Lógica y UI agrupadas por funcionalidad (carrito, checkout, búsqueda, producto, escáner...). |
| `src/core/` | Infraestructura compartida: red, store, almacenamiento, i18n, formato, accesibilidad. |
| `src/design-system/` | Tokens, paletas y componentes reutilizables. |
| `mock-server/` | Backend mock (Node, Express, Faker con semilla fija), con sus propias pruebas. |
| `modules/device-insights/` | Expo Module local en Kotlin y Swift. |
| `.maestro/` | Flujos E2E de Maestro. |
| `specs/` | Especificaciones, planes y tareas por día (método SDD). |
| `docs/` | Constitución del proyecto y evidencia de validación (`docs/evidence/`). |
| `locales/` | Textos nativos localizados (permisos). |

## Pruebas y comprobaciones

```bash
npm test                        # test:logic y test:jest, encadenados
npm run test:logic              # node:test, archivos *.test.ts (lógica pura)
npm run test:jest               # Jest + React Native Testing Library, archivos *.test.tsx
npm --prefix mock-server test   # pruebas del servidor mock
npx expo lint                   # ESLint
npx tsc --noEmit                # TypeScript estricto
npx expo install --check        # compatibilidad de dependencias con el SDK
npx expo-doctor@latest          # diagnóstico de Expo
```

La extensión del archivo decide el ejecutor: `*.test.ts` va por `node:test` y `*.test.tsx` por Jest. El flujo crítico de compra se prueba de extremo a extremo con [Maestro](https://maestro.mobile.dev), una herramienta externa que no está en `package.json`; el procedimiento exacto está en [`.maestro/README.md`](.maestro/README.md). Una integración continua en GitHub Actions ejecuta lint, typecheck y las pruebas de lógica y Jest, y las del servidor mock, en cada `push` y `pull_request` a `main`; Maestro y los dispositivos reales no forman parte de ella.

## Método de trabajo (SDD)

El proyecto sigue Spec-Driven Development: constitución, spec, plan, tareas, implementación y validación, sin pasar de fase sin aprobación.

- [`AGENTS.md`](AGENTS.md): reglas del proyecto para agentes y personas (stack, convenciones, comandos, límites).
- `specs/`: una carpeta por día con `spec.md`, `plan.md` y `tasks.md`.
- `.opencode/` (agentes y comandos) y `.agents/skills/sdd/` (método): fuente única compartida por OpenCode y Claude Code. `.claude/` contiene solo adaptadores finos.

Notas sobre estos archivos de agente:

- **`MEMORY.md` es memoria local de agente y no está versionada** (está en `.gitignore`). `AGENTS.md` y los comandos SDD indican «leer `MEMORY.md`»: en un clon nuevo ese archivo no existe y los agentes pueden crearlo; no contiene nada necesario para compilar ni ejecutar la app.
- Las skills de `.claude/skills/` son **enlaces simbólicos** a `.agents/skills/`. En Windows requieren `git config core.symlinks true` (y permisos para crear enlaces) antes de clonar; sin eso Git los deja como archivos de texto con la ruta.
- Las skills de terceros de `.agents/skills/` conservan su autoría y licencia: ver [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

## Documentación

- [`LEARNING.md`](LEARNING.md): registro de aprendizaje por día, en español, con las comparaciones Kotlin/Compose y Swift/SwiftUI, las decisiones y sus trade-offs.
- [`docs/evidence/`](docs/evidence): evidencia fechada de las validaciones en dispositivo (plataforma, condición, pasos, observación y resultado).
- [`docs/constitution.md`](docs/constitution.md): principios del proyecto.

El código, los nombres de archivo y los identificadores están en inglés; las explicaciones y el material de estudio, en español.

## Limitaciones conocidas

HerbStore es un proyecto de aprendizaje, no un producto en producción:

- No hay autenticación ni cuentas de usuario.
- No hay pagos reales: el checkout termina en una orden contra el servidor mock, cuyo estado vive en memoria y se pierde al reiniciarlo.
- No hay actualizaciones OTA (`expo-updates` no está instalado), ni CI/CD de producción, ni publicación en tiendas.
- El origen del catálogo en los perfiles de `eas.json` es un marcador de posición público (`https://api.example.test`); los builds remotos solo prueban la compilación, no la carga del catálogo.
- La accesibilidad se verificó con TalkBack real en un Android y con herramientas de inspección en el simulador de iOS: **VoiceOver real no se probó** y el **audio de los lectores de pantalla no está verificado** (solo foco, orden, nombre, rol y estado).
- El diálogo de permisos y el teclado los dibuja el sistema; la app no los controla.

Más detalle en `LEARNING.md` (sección «Decisiones y limitaciones que deben constar») y en `docs/evidence/`.

## Licencia

[MIT](LICENSE) © 2026 omarSanOc. Las skills de terceros de `.agents/skills/` mantienen sus propias licencias (ver [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)).
