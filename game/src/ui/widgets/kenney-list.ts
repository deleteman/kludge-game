import type ScrollablePanel from "phaser3-rex-plugins/templates/ui/scrollablepanel/ScrollablePanel.js";
import { UI_FONT_FAMILY } from "../fonts.js";
import { LABEL_COLOR, SECTION_FILL_COLORS } from "../../render/palette.js";
import type { SceneWithRexUI } from "../scene-with-rex-ui.types.js";
import { UI_POINTER_CURSOR_CSS } from "../custom-cursor.js";
import { AUDIO_KEYS } from "../../audio/audio-asset-registry.js";
import { pickSoundKey } from "../../audio/audio-utils.js";

/** Alpha de fondo de fila: base vs. realce al pasar el cursor (12c.7, obs #6). */
const ROW_BG_ALPHA = 0.6;
const ROW_BG_ALPHA_HOVER = 0.95;

export interface KenneyListItem {
  readonly text: string;
  readonly onClick: () => void;
  readonly enabled?: boolean;
  /**
   * Atenuado visual INDEPENDIENTE de `enabled` (13e ronda 9): una fila puede
   * seguir siendo clickeable (para ver su detalle) aunque se vea "deshabilitada"
   * porque la acción real que representa está bloqueada — ver
   * `install-picker-modal.ts`, donde un ítem sin stock necesita poder
   * seleccionarse para mostrar su ficha, pero debe leerse atenuado.
   */
  readonly muted?: boolean;
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
    // Atenuado visual: `enabled` (clickeable) y `muted` (se ve bloqueado) son
    // ejes independientes desde la ronda 9 — una fila deshabilitada siempre se
    // ve atenuada, pero una fila habilitada Y `muted` también, sin dejar de
    // responder al click.
    const dimmed = !enabled || (item.muted ?? false);
    const row = scene.add
      .rectangle(0, 0, width - 24, 32, SECTION_FILL_COLORS[0], dimmed ? 0.25 : ROW_BG_ALPHA)
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
          color: dimmed ? "#8890a8" : LABEL_COLOR,
          wordWrap: { width: width - 24 - 20 },
        }),
        space: { left: 10 },
      })
      .layout();
    if (enabled) {
      // Cursor custom + feedback de hover/click (12c.7, obs #2/#6): sonido y
      // realce del fondo al pasar el cursor; sonido de click antes del onClick.
      rowLabel
        .setInteractive({ cursor: UI_POINTER_CURSOR_CSS })
        .on("pointerover", () => {
          row.setFillStyle(SECTION_FILL_COLORS[0], ROW_BG_ALPHA_HOVER);
          scene.sound.play(pickSoundKey(AUDIO_KEYS.uiButtonHover), { volume: 0.25 });
        })
        // Ronda 11: restaurar al alpha ATENUADO de la fila, no siempre al
        // normal — una fila `muted` (0.25) se quedaba en 0.6 tras el
        // hover-out, indistinguible de una fila habilitada hasta que el
        // modal se reconstruía por completo al clickear cualquier ítem.
        .on("pointerout", () => row.setFillStyle(SECTION_FILL_COLORS[0], dimmed ? 0.25 : ROW_BG_ALPHA))
        .on("pointerdown", () => {
          scene.sound.play(pickSoundKey(AUDIO_KEYS.uiButtonClick), { volume: 0.4 });
          item.onClick();
        });
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
