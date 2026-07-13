import type { ConduitKind } from "engine";

/**
 * Paleta placeholder de Fase 5, data-driven. Cuando se elija el pack de
 * pixel art (GDD §17) estos valores se sustituyen por el código de color por
 * tipo de recurso del GDD §10 + tint en runtime (GDD 11.0) — el renderer no
 * cambia, solo esta tabla.
 */
export const CONDUIT_COLORS: Readonly<Record<ConduitKind, number>> = {
  ventilacion: 0x3fd4e0,
  electrico: 0xf2d24b,
  fluido: 0x4a7bd4,
  senal: 0x64dc78,
};

/** Marca de válvula sellada (apertura 0) — debe distinguirse de una abierta (principio 6). */
export const SEALED_VALVE_COLOR = 0xe0483f;

/** Rellenos tenues por sección, asignados cíclicamente. */
export const SECTION_FILL_COLORS: readonly number[] = [
  0x24365c, 0x2c4a44, 0x4a3a2c, 0x3c2c4a, 0x2c3c5a, 0x44502e, 0x50372e, 0x2e5046,
];

export const SECTION_FILL_ALPHA = 0.55;
export const WALL_COLOR = 0x9aa4bc;
export const GRID_LINE_COLOR = 0x1a2030;
export const ANCHOR_COLOR = 0x8890a8;
export const LABEL_COLOR = "#d8dce8";
export const HEADER_COLOR = "#f0f2f8";
