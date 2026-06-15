import { spawn } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const services = [
  { name: "web", args: ["run", "dev:web"] },
  { name: "api", args: ["run", "dev:api"] },
  { name: "worker", args: ["run", "dev:worker"] },
];

const children = new Map();
let shuttingDown = false;

function stopAll(signal = "SIGTERM") {
  shuttingDown = true;
  for (const child of children.values()) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
}

for (const service of services) {
  const child = spawn(npmCommand, service.args, {
    stdio: "inherit",
    env: {
      ...process.env,
      FORCE_COLOR: process.env.FORCE_COLOR ?? "1",
    },
  });

  children.set(service.name, child);

  child.on("exit", (code, signal) => {
    children.delete(service.name);

    if (shuttingDown) {
      return;
    }

    const reason = signal ? `signal ${signal}` : `code ${code ?? 0}`;
    console.error(`[dev:all] ${service.name} exited with ${reason}. Stopping remaining services.`);
    stopAll();
    process.exitCode = code ?? 1;
  });
}

process.on("SIGINT", () => {
  stopAll("SIGINT");
});

process.on("SIGTERM", () => {
  stopAll("SIGTERM");
});
