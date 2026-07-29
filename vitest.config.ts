import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // Pure engine suites run in node; suites that need localStorage opt into
    // happy-dom with a `@vitest-environment` docblock.
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
