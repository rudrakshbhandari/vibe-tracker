import { defineConfig } from "vitest/config";

const workerRoot = new URL(".", import.meta.url).pathname;

export default defineConfig({
  root: workerRoot,
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
