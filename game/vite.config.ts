import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

/**
 * El alias apunta al SRC del engine (no a dist/): hot reload cross-workspace
 * sin necesidad de compilar el engine antes de `npm run dev`. El import del
 * JSON de los mapas de Tiled lo resuelve Vite de forma nativa.
 */
export default defineConfig({
  resolve: {
    alias: {
      engine: fileURLToPath(new URL("../engine/src/index.ts", import.meta.url)),
    },
  },
  build: {
    outDir: "dist",
  },
});
