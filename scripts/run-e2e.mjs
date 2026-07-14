import { spawn } from "node:child_process";
import net from "node:net";
import process from "node:process";

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

const apiPort = await findFreePort();
const webPort = await findFreePort();
const apiUrl = `http://127.0.0.1:${apiPort}`;
const webUrl = `http://127.0.0.1:${webPort}`;
const environment = {
  ...process.env,
  DATA_MODE: "memory",
  AUTH_MODE: "demo",
  API_HOST: "127.0.0.1",
  API_PORT: String(apiPort),
  RATE_LIMIT_MAX: "1000",
  CORS_ORIGIN: webUrl,
  VITE_API_URL: apiUrl,
  PLAYWRIGHT_BASE_URL: webUrl
};

const children = [
  spawn(process.execPath, ["apps/api/dist/server.js"], { env: environment, stdio: "inherit" }),
  spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "--config",
      "apps/web/vite.config.ts",
      "--host",
      "127.0.0.1",
      "--port",
      String(webPort),
      "--strictPort"
    ],
    { env: environment, stdio: "inherit" }
  )
];

async function waitFor(url) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // The process is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function stopChildren() {
  for (const child of children) child.kill();
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    stopChildren();
    process.exit(1);
  });
}

try {
  await Promise.all([waitFor(`${apiUrl}/health/ready`), waitFor(webUrl)]);
  const playwright = spawn(
    process.execPath,
    ["node_modules/@playwright/test/cli.js", "test", ...process.argv.slice(2)],
    { env: environment, stdio: "inherit" }
  );
  const exitCode = await new Promise((resolve) => playwright.on("exit", (code) => resolve(code ?? 1)));
  process.exitCode = Number(exitCode);
} finally {
  stopChildren();
}
