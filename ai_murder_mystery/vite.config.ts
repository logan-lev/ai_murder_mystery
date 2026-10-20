import { defineConfig } from "vitest/config";

export default defineConfig({
  // Relative asset paths, so the build works under a GitHub Pages subpath like /dead-orbit/
  base: "./",
  // The WebLLM worker uses ES module imports
  worker: { format: "es" },
  test: {
    // A lightweight fake browser, so code that touches localStorage, the DOM, or the URL can run in Node
    environment: "happy-dom",
    include: ["src/**/*.test.ts"],
  },
});
