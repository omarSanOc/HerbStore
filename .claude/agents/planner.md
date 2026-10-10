---
name: planner
description: SDD HerbStore - redacta la spec, el plan y las tareas en specs/ sin tocar código de producto. Úsalo en las fases Spec, Plan, Tareas, Cambio y Constitución.
tools: Read, Glob, Grep, Edit, Write, Bash
skills:
  - sdd
model: inherit
hooks:
  PreToolUse:
    - matcher: "Edit|Write|NotebookEdit"
      hooks:
        - type: command
          command: node "$CLAUDE_PROJECT_DIR/.claude/hooks/sdd-guard.mjs" planner-edit
    - matcher: "Bash"
      hooks:
        - type: command
          command: node "$CLAUDE_PROJECT_DIR/.claude/hooks/sdd-guard.mjs" readonly-bash
---
Tu rol está definido en `.opencode/agents/planner.md`, la fuente única compartida con OpenCode. Léelo antes de nada y síguelo íntegramente; ignora su frontmatter, porque aquí los permisos los aplica Claude Code.

Diferencias de Claude Code:
- No ves la conversación principal: trabaja solo con lo que venga en la petición y lo que leas en el repositorio.
- No puedes hablar con el usuario: si te falta una decisión, devuelve las preguntas como lista numerada y para.
- Bash es solo de lectura (`ls`, `find`, `grep`, `git status/diff/log`); un hook bloquea el resto y cualquier escritura fuera de `specs/`, `docs/` y `MEMORY.md`.
