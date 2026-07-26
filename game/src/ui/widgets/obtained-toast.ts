import type Phaser from "phaser";
import { UI_FONT_FAMILY } from "../fonts.js";
import { OBJECTIVE_DONE_COLOR } from "../../render/palette.js";

/**
 * Toast "Obtuviste: x1 {nombre}" (playtest de Fase 11d: desarmar un compuesto
 * acreditaba stock sin ningún feedback visual — principio 6, todo estado
 * relevante del motor necesita representación). Mismo patrón de tween que
 * `flashCrewCard`/`flashCrewToken` en `floorplan-scene.ts`: aparece, deriva
 * hacia arriba y se desvanece; se autodestruye al terminar.
 */
export function fireObtainedToast(
  scene: Phaser.Scene,
  worldX: number,
  worldY: number,
  text: string,
): Phaser.GameObjects.Text {
  const label = scene.add
    .text(worldX, worldY, text, {
      fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
      fontSize: "13px",
      color: OBJECTIVE_DONE_COLOR,
      fontStyle: "bold",
      backgroundColor: "#0a0a0fcc",
      padding: { x: 6, y: 3 },
    })
    .setOrigin(0.5, 1);
  scene.tweens.add({
    targets: label,
    y: worldY - 28,
    alpha: 0,
    duration: 1400,
    delay: 300,
    onComplete: () => label.destroy(),
  });
  return label;
}
