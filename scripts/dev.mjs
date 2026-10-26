import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const python = join(
  root,
  ".venv",
  process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
);
const vite = join(root, "bench-core-dashboard/node_modules/vite/bin/vite.js");
if (!existsSync(python) || !existsSync(vite)) {
  console.error(
    "Setup required. Create .venv and install requirements.txt, then run npm install --prefix bench-core-dashboard.",
  );
  process.exit(1);
}
console.log(
  "GeoGuard dashboard: http://127.0.0.1:8051\nAPI documentation: http://127.0.0.1:8000/docs",
);
const envFile = existsSync(join(root, ".env.local")) ? ".env.local" : ".env";
const children = [
  spawn(
    python,
    [
      "-m",
      "uvicorn",
      "api.server:app",
      "--host",
      "127.0.0.1",
      "--port",
      "8000",
      ...(existsSync(join(root, envFile))
        ? ["--env-file", join(root, envFile)]
        : []),
    ],
    { cwd: root, stdio: "inherit", windowsHide: true },
  ),
  spawn(
    process.execPath,
    [vite, "--host", "127.0.0.1", "--port", "8051", "--strictPort"],
    {
      cwd: join(root, "bench-core-dashboard"),
      stdio: "inherit",
      windowsHide: true,
    },
  ),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  children.forEach((child) => child.kill());
  process.exitCode = code;
}
children.forEach((child) => {
  child.on("error", (error) => {
    console.error(error.message);
    stop(1);
  });
  child.on("exit", (code) => {
    if (!stopping) stop(code ?? 1);
  });
});
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
