import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["dist/**", "node_modules/**"],
    coverage: {
      reporter: ["text", "json-summary"],
      thresholds: { lines: 30, functions: 30, statements: 30, branches: 25 }
    }
  }
});
