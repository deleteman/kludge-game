import type Phaser from "phaser";

import pointerDefaultUrl from "../../assets/sprites/ui/cursor/pointer_c_shaded.png?url";
import handPointUrl from "../../assets/sprites/ui/cursor/pointer_c_shaded.png?url";
import targetUrl from "../../assets/sprites/ui/cursor/target_round_b.png?url";
import wrenchUrl from "../../assets/sprites/ui/cursor/tool_wrench.png?url";
import disabledUrl from "../../assets/sprites/ui/cursor/cursor_disabled.png?url";
import busyUrl from "../../assets/sprites/ui/cursor/cursor_busy.png?url";

/**
 * Fase 12c.3: cursor contextual reactivo. El puntero del sistema se reemplaza
 * por un sprite del pack Kenney (`game/assets/sprites/ui/cursor/`, provisto por
 * el operador) según la acción válida bajo el ratón.
 *
 * Se implementa con `input.setDefaultCursor(url(...))` (cursor CSS del canvas),
 * NO con un sprite seguido cuadro a cuadro: así evita el bug de doble-cámara del
 * plano de misión y no compite con el paneo/zoom. Los botones que ya declaran
 * `setInteractive({ useHandCursor: true })` siguen imponiendo su propia mano al
 * pasar por encima — `set()` deduplica por tipo para no reescribir el cursor en
 * cada frame y así no pelear con ese comportamiento por objeto.
 */
export type CursorKind = "default" | "selectable" | "wire" | "dismantle" | "disabled" | "busy";

/** `url(<png>) <hotX> <hotY>, <fallback>` — el hotspot es el punto "activo" del sprite. */
const CURSOR_CSS: Readonly<Record<CursorKind, string>> = {
  default: `url(${pointerDefaultUrl}) 2 2, auto`,
  selectable: `url(${handPointUrl}) 8 2, pointer`,
  wire: `url(${targetUrl}) 15 15, crosshair`,
  dismantle: `url(${wrenchUrl}) 6 6, pointer`,
  disabled: `url(${disabledUrl}) 8 8, not-allowed`,
  busy: `url(${busyUrl}) 8 8, wait`,
};

/**
 * Cursor custom para UI clickeable (botones, filas de lista) — el MISMO sprite
 * "selectable" del cursor de mapa, para que un botón no revierta al puntero del
 * sistema (más chico) al pasar por encima (12c.7, obs #2). Se pasa a
 * `setInteractive({ cursor: UI_POINTER_CURSOR_CSS })` en vez de `useHandCursor`.
 */
export const UI_POINTER_CURSOR_CSS = CURSOR_CSS.selectable;

export class CustomCursor {
  private current?: CursorKind;

  constructor(private readonly scene: Phaser.Scene) {}

  /** Fija el cursor si cambió respecto al último tipo aplicado (evita reescrituras por frame). */
  set(kind: CursorKind): void {
    if (kind === this.current) return;
    this.current = kind;
    this.scene.input.setDefaultCursor(CURSOR_CSS[kind]);
  }

  /** Restaura el cursor por defecto (ej. al salir de la escena). */
  reset(): void {
    this.set("default");
  }
}
