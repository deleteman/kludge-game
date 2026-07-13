import Phaser from "phaser";

import { FloorplanScene } from "./scenes/floorplan-scene.js";

/**
 * Punto de entrada de /game (Fase 5: render estático del plano). 1280×720,
 * `pixelArt: true` (GDD §11) — el canvas escala con nearest-neighbor.
 */
new Phaser.Game({
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  backgroundColor: "#0a0a0f",
  pixelArt: true,
  scene: [FloorplanScene],
});
