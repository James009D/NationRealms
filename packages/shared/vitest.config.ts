import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["dist/**", "node_modules/**"],
    coverage: {
      reporter: ["text", "json-summary"],
      thresholds: { lines: 20, functions: 20, statements: 20, branches: 15 }
    }
  }
});
