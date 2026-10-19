// Cross-platform Python launcher used by the root npm scripts.
// Prefers the project virtualenv (backend/.venv) and falls back to the system Python.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const isWin = process.platform === "win32";
const venvPython = isWin
  ? join(root, "backend", ".venv", "Scripts", "python.exe")
  : join(root, "backend", ".venv", "bin", "python");

const candidates = existsSync(venvPython)
  ? [[venvPython, []]]
  : isWin
    ? [["py", ["-3"]], ["python", []], ["python3", []]]
    : [["python3", []], ["python", []]];

const args = process.argv.slice(2);
for (const [cmd, pre] of candidates) {
  const result = spawnSync(cmd, [...pre, ...args], { stdio: "inherit", cwd: root });
  if (result.error && result.error.code === "ENOENT") continue;
  process.exit(result.status ?? 1);
}
console.error("Python 3.11+ was not found. Install it from https://www.python.org/downloads/");
process.exit(1);
