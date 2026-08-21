import type Phaser from "phaser";
import { UI_FONT_FAMILY } from "../fonts.js";
import { LABEL_COLOR, WIRE_HIGHLIGHT_COLOR } from "../../render/palette.js";
import type { SceneWithRexUI } from "../scene-with-rex-ui.types.js";
import { t } from "../../i18n/i18n.js";
import type { CompositionIngredient } from "./mission-action-panel.js";

const HIGHLIGHT_COLOR_CSS = `#${WIRE_HIGHLIGHT_COLOR.toString(16).padStart(6, "0")}`;
/** Mismo gris que `kenney-list.ts` usa para texto de fila deshabilitada — ronda 9, sin inventar un color nuevo. */
const NO_STOCK_COLOR_CSS = "#8890a8";

/**
 * Desglose "Composición" reutilizado por `mission-tooltip.ts` (hover sobre una
 * instancia colocada) e `install-picker-modal.ts` (ficha del selector): un
 * compuesto muestra sus piezas atómicas, resaltando en ámbar
 * (`WIRE_HIGHLIGHT_COLOR`, mismo color que el resaltado de nodos cableables)
 * la que tiene el tag funcional que la crisis activa necesita — así el
 * jugador puede razonar "si desarmo esto, obtengo la pieza que resuelve la
 * crisis" sin que el juego se lo diga directamente (principio 1). El
 * resaltado es SOLO de color (ajuste post-playtest): no agrega texto de badge,
 * para no ser tan explícito como "contiene la función requerida".
 */
export function renderCompositionLines(
  scene: SceneWithRexUI,
  x: number,
  startY: number,
  width: number,
  title: string,
  ingredients: ReadonlyArray<CompositionIngredient>,
): { readonly container: Phaser.GameObjects.Container; readonly bottomY: number } {
  const container = scene.add.container(0, 0);
  if (ingredients.length === 0) {
    return { container, bottomY: startY };
  }

  container.add(
    scene.add
      .text(x, startY, title, {
        fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
        fontSize: "11px",
        color: LABEL_COLOR,
        wordWrap: { width },
      })
      .setOrigin(0, 0),
  );

  // Líneas de ingrediente en "sans-serif" (playtest ronda 2): `UI_FONT_FAMILY`
  // es mayúsculas por diseño, ilegible para texto de cuerpo — se reserva
  // para el título de la sección arriba. Separador "×" en vez de "x": a
  // 11px en la fuente de display, "x1" se confundía con "H1".
  let lineY = startY + 18;
  for (const ingredient of ingredients) {
    // Ronda 9: "sin stock" es un motivo de bloqueo REAL de la ficha —
    // prioridad sobre el resaltado de objetivo de misión (que además el
    // selector de instalación ya pide en `false` vía `hasRequiredTag`).
    const missingStock = ingredient.hasStock === false;
    const text = `• ×${ingredient.quantity} ${ingredient.name}${missingStock ? ` (${t("ui.floorplan.mission.composition-no-stock")})` : ""}`;
    container.add(
      scene.add
        .text(x, lineY, text, {
          fontFamily: "sans-serif",
          fontSize: "11px",
          color: missingStock ? NO_STOCK_COLOR_CSS : ingredient.hasRequiredTag ? HIGHLIGHT_COLOR_CSS : LABEL_COLOR,
          fontStyle: !missingStock && ingredient.hasRequiredTag ? "bold" : "normal",
          wordWrap: { width },
        })
        .setOrigin(0, 0),
    );
    lineY += 18;
  }

  return { container, bottomY: lineY };
}
