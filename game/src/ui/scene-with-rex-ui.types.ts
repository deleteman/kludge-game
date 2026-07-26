import type Phaser from "phaser";
import type UIPlugin from "phaser3-rex-plugins/templates/ui/ui-plugin.js";

/** Toda escena de menú recibe `rexUI` inyectado por el plugin scene-scoped registrado en `main.ts`. */
export type SceneWithRexUI = Phaser.Scene & { rexUI: UIPlugin };
