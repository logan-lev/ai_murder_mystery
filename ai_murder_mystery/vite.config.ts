import { defineConfig } from "vite";

export default defineConfig({
  // Relative asset paths, so the build works under a GitHub Pages subpath like /dead-orbit/
  base: "./",
  // The WebLLM worker uses ES module imports
  worker: { format: "es" },
});
