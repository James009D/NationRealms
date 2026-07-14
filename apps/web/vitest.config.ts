import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["dist/**", "node_modules/**"],
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      reporter: ["text", "json-summary"],
      thresholds: { lines: 35, functions: 35, statements: 35, branches: 25 }
    }
  }
});
