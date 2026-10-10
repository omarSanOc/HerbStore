// PreToolUse guard for SDD subagents. Mirrors the OpenCode permissions in
// .opencode/agents/planner.md, which Claude Code frontmatter cannot express:
//   planner-edit   -> Edit/Write only inside specs/, docs/ and MEMORY.md
//   readonly-bash  -> Bash limited to read-only inspection commands
// Exit code 2 blocks the tool call and sends stderr back to the agent.
import { readFileSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';

const mode = process.argv[2];
const input = JSON.parse(readFileSync(0, 'utf8'));
const projectDir = process.env.CLAUDE_PROJECT_DIR ?? input.cwd;

// macOS and Windows file systems are case-insensitive by default.
const normalize = (path) =>
  process.platform === 'darwin' || process.platform === 'win32' ? path.toLowerCase() : path;

function block(reason) {
  console.error(reason);
  process.exit(2);
}

function checkPlannerEdit() {
  const filePath = input.tool_input?.file_path ?? input.tool_input?.notebook_path;
  if (!filePath) return;
  const rel = relative(normalize(projectDir), normalize(resolve(projectDir, filePath)))
    .split(sep)
    .join('/');
  const allowed = rel === 'memory.md' || rel.startsWith('specs/') || rel.startsWith('docs/');
  if (!allowed) block(`planner solo puede editar specs/, docs/ y MEMORY.md; bloqueado: ${filePath}`);
}

const READ_ONLY_COMMANDS = new Set(['ls', 'find', 'grep', 'rg', 'cat', 'head', 'tail', 'wc', 'sort', 'uniq']);
const READ_ONLY_GIT = new Set(['status', 'diff', 'log', 'show', 'ls-files']);

function checkReadOnlyBash() {
  // Discarding stderr is harmless and common in inspection commands.
  const command = String(input.tool_input?.command ?? '').replaceAll('2>/dev/null', '');
  if (/[>`]|\$\(|-delete\b|-exec\b|-ok\b/.test(command)) {
    block(`Bash de solo lectura: redirecciones, sustituciones y find -exec/-delete no están permitidos: ${command}`);
  }
  for (const segment of command.split(/\|\||&&|[|;&\n]/)) {
    const [program, subcommand] = segment.trim().split(/\s+/);
    if (!program) continue;
    const allowed =
      READ_ONLY_COMMANDS.has(program) || (program === 'git' && READ_ONLY_GIT.has(subcommand));
    if (!allowed) block(`Bash de solo lectura: "${program}" no está permitido para este agente.`);
  }
}

if (mode === 'planner-edit') checkPlannerEdit();
else if (mode === 'readonly-bash') checkReadOnlyBash();
else block(`sdd-guard: modo desconocido "${mode}"`);
