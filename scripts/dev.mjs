import { spawn } from "node:child_process";

const isWindows = process.platform === "win32";

const children = [
  spawn("node", ["server/index.mjs"], {
    stdio: "inherit",
    shell: isWindows
  }),
  spawn("npm", ["run", "dev:web", "--", "--port", "5173"], {
    stdio: "inherit",
    shell: isWindows
  })
];

function shutdown(signal) {
  for (const child of children) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
}

process.on("SIGINT", () => {
  shutdown("SIGINT");
  process.exit(0);
});

process.on("SIGTERM", () => {
  shutdown("SIGTERM");
  process.exit(0);
});

for (const child of children) {
  child.on("exit", (code) => {
    if (code && code !== 0) {
      shutdown("SIGTERM");
      process.exit(code);
    }
  });
}
