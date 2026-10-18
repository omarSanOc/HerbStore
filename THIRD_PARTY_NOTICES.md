# Avisos de terceros

HerbStore está bajo licencia MIT (ver [`LICENSE`](LICENSE)). Este documento recoge el material de terceros que se distribuye dentro del repositorio. Las dependencias de npm no se copian aquí: se instalan desde el registro y conservan sus propias licencias (consúltalas con `npm ls` o en `node_modules/<paquete>/LICENSE`).

## Skills de agentes de terceros (`.agents/skills/`)

Cuatro de las cinco skills de `.agents/skills/` **no son obra de este proyecto**: se instalaron desde los repositorios indicados. Las fuentes salen de [`skills-lock.json`](skills-lock.json); la licencia, del campo `license` del encabezado de cada `SKILL.md` (o de `POWER.md`).

| Skill | Fuente (GitHub) | Ruta en la fuente | Licencia declarada |
|---|---|---|---|
| `react-native-best-practices` | `callstackincubator/agent-skills` (Callstack) | `skills/react-native-best-practices/SKILL.md` | MIT |
| `react-native-testing` | `callstack/react-native-testing-library` | `skills/react-native-testing/SKILL.md` | no confirmada (el `SKILL.md` no declara licencia) |
| `upgrading-react-native` | `callstackincubator/agent-skills` (Callstack) | `skills/upgrading-react-native/SKILL.md` | MIT |
| `vercel-react-native-skills` | `vercel-labs/agent-skills` (Vercel) | `skills/react-native-skills/SKILL.md` | MIT |

La skill `sdd` (`.agents/skills/sdd/`) y los agentes y comandos de `.opencode/` y `.claude/` son obra de este proyecto y siguen la licencia MIT del repositorio.

Los nombres de las empresas y los proyectos citados pertenecen a sus titulares; su mención solo indica el origen del material y no implica patrocinio ni respaldo.

## Imágenes de herramientas de terceros

`.agents/skills/react-native-best-practices/references/images/` contiene capturas y diagramas de herramientas de terceros (por ejemplo Xcode Instruments, React DevTools, Expo Atlas, source-map-explorer, Flashlight o Emerge). **Esas imágenes pertenecen a sus autores** y se incluyen únicamente como parte de la skill de origen; no están cubiertas por la licencia MIT de este repositorio.

## Plantilla inicial

El proyecto se creó a partir de la plantilla de [Expo](https://expo.dev) (`create-expo-app`, licencia MIT, 650 Industries, Inc.). Los iconos y el icono de arranque de la plantilla se sustituyeron por otros propios y ficticios.

## Retirada

Si eres titular de alguno de estos materiales y quieres que se corrija la atribución o se retire, abre un issue en el repositorio.
