import type ScrollablePanel from "phaser3-rex-plugins/templates/ui/scrollablepanel/ScrollablePanel.js";
import { UI_FONT_FAMILY } from "../fonts.js";
import { LABEL_COLOR, SECTION_FILL_COLORS } from "../../render/palette.js";
import type { SceneWithRexUI } from "../scene-with-rex-ui.types.js";

export interface KenneyListItem {
  readonly text: string;
  readonly onClick: () => void;
  readonly enabled?: boolean;
}

/**
 * Lista vertical con scroll (explorador de blueprints/creaciones, "Continuar"
 * con varias partidas). El pack Kenney no trae asset de scrollbar (búsqueda
 * exhaustiva, ver `ui-asset-registry.ts`) — se usa el `slider`/`scrollBar`
 * shape-based nativo de rexUI (color plano para track/thumb), mismo criterio
 * que la paleta placeholder de Fase 5.
 *
 * IMPORTANTE: track/thumb deben ser `Rectangle` (Shape con `width`/`height`
 * reales), no `Graphics` — rexUI llama `scene.input.setDraggable(thumb)`
 * internamente al construir el `ScrollBar`, y un `Graphics` sin tamaño propio
 * (siempre 0×0 salvo que se le asigne a mano) nunca queda con un componente
 * de input válido, lo que hacía crashear `setDraggable` (`gameObject.input`
 * null) apenas se abría cualquier lista.
 *
 * IMPORTANTE 2: `(x, y)` es el CENTRO del panel (origin 0.5 por defecto de
 * rexUI), NO su borde superior-izquierdo. Pasarlo como si fuera el tope hace
 * que la lista quede centrada demasiado arriba y sobresalga de su contenedor
 * (fue la causa del overflow vertical del selector de instalación, ajuste
 * post-playtest #5). Para ubicarla en una caja `[top, bottom]`, pasar
 * `y = (top + bottom) / 2` y `height = bottom - top`.
 */
export function createKenneyList(
  scene: SceneWithRexUI,
  x: number,
  y: number,
  width: number,
  height: number,
  items: ReadonlyArray<KenneyListItem>,
): ScrollablePanel {
  const track = scene.add.rectangle(0, 0, 8, 10, 0x1a2030, 1);
  const thumb = scene.add.rectangle(0, 0, 8, 40, 0x8890a8, 1);

  const sizer = scene.rexUI.add.sizer({ orientation: "y", space: { item: 6 } });

  if (items.length === 0) {
    sizer.add(
      scene.add.text(0, 0, "—", {
        fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
        fontSize: "14px",
        color: LABEL_COLOR,
      }),
      { padding: { top: 8, bottom: 8 } },
    );
  }

  for (const item of items) {
    const enabled = item.enabled ?? true;
    const row = scene.add
      .rectangle(0, 0, width - 24, 32, SECTION_FILL_COLORS[0], enabled ? 0.6 : 0.25)
      .setOrigin(0.5);
    const rowLabel = scene.rexUI.add
      .label({
        width: width - 24,
        height: 32,
        background: row,
        // `wordWrap` explícito (ajuste post-playtest #2): sin esto, un nombre
        // largo (frecuente en la pestaña "Catálogo") desbordaba el ancho
        // declarado de la fila — el `label` de rexUI sigue calculando su
        // layout con el `width` fijo de arriba, pero el `Text` interno se
        // renderizaba más ancho que eso, dando la impresión de una lista más
        // angosta con la scrollbar desalineada respecto al texto.
        // "sans-serif", NO `UI_FONT_FAMILY` (Kenney Future, mayúsculas por
        // diseño — mismo criterio ya aplicado a mission-tooltip.ts/
        // composition-list.ts/scrollable-text.ts): el texto de fila es
        // contenido largo (nombre de componente/sustancia), no un
        // encabezado corto, e ilegible en mayúsculas todo el tiempo.
        text: scene.add.text(0, 0, item.text, {
          fontFamily: "sans-serif",
          fontSize: "13px",
          color: enabled ? LABEL_COLOR : "#8890a8",
          wordWrap: { width: width - 24 - 20 },
        }),
        space: { left: 10 },
      })
      .layout();
    if (enabled) {
      rowLabel.setInteractive({ useHandCursor: true }).on("pointerdown", item.onClick);
    }
    sizer.add(rowLabel, { padding: { left: 4, right: 4 } });
  }

  const panel = scene.rexUI.add
    .scrollablePanel({
      x,
      y,
      width,
      height,
      scrollMode: 0,
      panel: { child: sizer, mask: { padding: 2 } },
      slider: { track, thumb },
      // `focus: 2` registra el listener de `wheel` a nivel de escena con un
      // chequeo de bounds en vivo (`IsPointerInBounds`) — con `focus: true`
      // rexUI llama `setInteractive()` sobre el bloque scrolleable ANTES de
      // `.layout()`, dejando el hit-area congelado en ~1×1px y la rueda casi
      // sin disparar bajo el cursor real (ajuste post-playtest #4).
      mouseWheelScroller: { focus: 2, speed: 0.3 },
      space: { left: 8, right: 8, top: 8, bottom: 8, panel: 8 },
    })
    .layout();

  return panel;
}
