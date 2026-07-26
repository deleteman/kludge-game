import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

/**
 * El alias `engine` apunta al SRC del engine (no a dist/): hot reload
 * cross-workspace sin necesidad de compilar el engine antes de `npm run dev`.
 * El import del JSON de los mapas de Tiled lo resuelve Vite de forma nativa.
 *
 * `engine-maps` es un segundo alias, a propósito separado del anterior: da
 * acceso a los JSON crudos de Tiled (con sus tile layers) para que Phaser los
 * cargue con su propio parser de tilemaps (Fase 8) — un consumidor distinto
 * del parser lógico de `/engine`, que solo lee las object layers. Mismos
 * archivos, dos lectores.
 */
export default defineConfig({
  // Necesario para que Electron cargue el build empaquetado bajo `file://`
  // (rutas de assets relativas en vez de absolutas desde la raíz del servidor).
  base: "./",
  resolve: {
    alias: {
      engine: fileURLToPath(new URL("../engine/src/index.ts", import.meta.url)),
      "engine-maps": fileURLToPath(new URL("../engine/src/floorplan/maps", import.meta.url)),
    },
  },
  build: {
    outDir: "dist",
  },
});
