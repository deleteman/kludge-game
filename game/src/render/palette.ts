import type { ChemicalSubstanceId, ChemicalTag, ComponentCondition, ConduitKind, CoreLoopMode, SignalNodeRole } from "engine";

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

/** Opacidad de una capa del plano desactivada por el toggle de HUD (Fase 11f) — atenuada, nunca oculta del todo. */
export const CONDUIT_LAYER_INACTIVE_ALPHA = 0.25;

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
/** Texto de un objetivo ya cumplido en el checklist (verde, playtest #15). */
export const OBJECTIVE_DONE_COLOR = "#64dc78";

/**
 * Color de nodo de señal por rol — mismos valores que usaba
 * `workbench-renderer.ts` en solitario (Fase 9.5), factorizados acá (Fase
 * 10d) para que el plano real de una misión los reutilice sin duplicar la
 * tabla.
 */
export const SIGNAL_NODE_COLORS: Readonly<Record<SignalNodeRole, number>> = {
  emitter: 0xf2d24b,
  receptor: 0x4a7bd4,
  conductor: 0x64dc78,
};

/**
 * Tinte por `condition` de una instancia colocada (Fase 10d, principio 6 de
 * CLAUDE.md: un actuador atascado nunca debe lucer igual que uno operativo).
 * `ok` no tiñe — usa el color de sección normal ya asignado por índice.
 */
export const COMPONENT_CONDITION_TINT: Readonly<Partial<Record<ComponentCondition, number>>> = {
  jammed: 0xe0a33f,
  destroyed: 0x4a4a52,
};

/** Colores de token de tripulante (Fase 10d), asignados cíclicamente por índice de actor activo. */
export const CREW_TOKEN_COLORS: readonly number[] = [
  0xf0f2f8, 0x64dc78, 0x4a7bd4, 0xf2d24b, 0xe0483f, 0xb47bd4,
];

/** Resaltado de la celda bajo el cursor (Fase 10d, ajuste post-playtest #4). */
export const HOVER_HIGHLIGHT_COLOR = 0xf0f2f8;

/** Resaltado PERSISTENTE de la celda seleccionada (sobre la que se va a actuar) — color distinto del hover (playtest #8). */
export const SELECTED_CELL_COLOR = 0x64dc78;

/** Anillos de nodos de señal clickeables en modo cableado (playtest #15) — ámbar, distinto del verde de selección. */
export const WIRE_HIGHLIGHT_COLOR = 0xffc24d;

/**
 * Color por modo del core loop (Fase 10d, ajuste post-playtest #4): el estado
 * pausa/ejecución debe notarse de un vistazo (principio 6 de CLAUDE.md, dos
 * estados nunca deben verse igual). Verde = corriendo, ámbar = congelado.
 */
export const CORE_LOOP_MODE_COLORS: Readonly<Record<CoreLoopMode, number>> = {
  execution: 0x64dc78,
  planning: 0xe0a33f,
};

/**
 * Color del texto del temporizador de crisis (cap. 2) por urgencia: calmo
 * mientras hay margen, ámbar cuando empieza el castigo progresivo, rojo cuando
 * queda poco (principio 6: la urgencia debe verse de un vistazo). Strings CSS
 * porque el color de un `Phaser.Text` es una cadena, no un número.
 */
export const TIMER_TEXT_COLORS = {
  calm: "#d8dce8",
  warning: "#e0a33f",
  danger: "#e0483f",
} as const;

/**
 * Trayectoria fantasma en pausa táctica (Fase 11a.3, ASA 3). Mismo tono cian
 * que la estela de aceleración magnética (`kinetics-effect.ts`, doc §4,
 * principio 6): el fantasma es la promesa de esa estela, no un color
 * arbitrario nuevo.
 */
export const TRAJECTORY_GHOST_COLOR = 0x9fd8ff;

/**
 * Cicatriz de "sección sin energía" (Fase 11b). Color EXCLUSIVO — no
 * reutilizado por `SECTION_FILL_COLORS` ni `COMPONENT_CONDITION_TINT` — para
 * que no se confunda con un simple "todavía no cableado" (principio 6: dos
 * fenómenos distintos nunca deben verse igual). El parpadeo (no solo el
 * tinte) es lo que lo hace inconfundible: ver `sectionScarFlickerAlpha`.
 */
export const UNPOWERED_SECTION_TINT = 0x050810;
export const UNPOWERED_SECTION_MIN_ALPHA = 0.35;
export const UNPOWERED_SECTION_MAX_ALPHA = 0.7;
/** Un ciclo de parpadeo completo cada 1.6s — lento, para no distraer del resto de la lectura del plano. */
export const UNPOWERED_SECTION_FLICKER_PERIOD_SECONDS = 1.6;

/**
 * Color curado por elemento base (GDD 5.4.1, mesa de creación modo química,
 * Fase 11c.3) — inspirado en color de llama/estado real (ej. sodio amarillo
 * de flama, cobre cobrizo, azufre amarillo), no en física exacta, mismo
 * criterio de simplificación de gameplay que el resto del catálogo químico.
 * Data-driven: un color por `ChemicalSubstanceId` de `ELEMENT_CATALOG`, no
 * lógica embebida en el renderer.
 */
export const CHEMICAL_ELEMENT_COLORS: Readonly<Record<string, number>> = {
  hidrogeno: 0xdff3ff,
  oxigeno: 0x8ec8ff,
  nitrogeno: 0xb9c9d6,
  carbono: 0x2b2b2b,
  cloro: 0xb7d436,
  sodio: 0xffd35c,
  potasio: 0xc98bd9,
  hierro: 0xa6664c,
  cobre: 0xc77a45,
  aluminio: 0xc8ccd0,
  azufre: 0xf2e04c,
  fosforo: 0xe0703f,
  fluor: 0xd9e86a,
  helio: 0xffd6e8,
  neon: 0xff6b4a,
  argon: 0x9b6bd9,
  silicio: 0x4a4f57,
  calcio: 0xff8a4c,
  magnesio: 0xf5f5f0,
  plomo: 0x6b7280,
  zinc: 0x9fb0c3,
  niquel: 0xc9c0a0,
  platino: 0xd9d4c8,
  litio: 0xe0435c,
  yodo: 0x8b3aa0,
  bromo: 0x8b2e1f,
  xenon: 0x5b8fd9,
  titanio: 0x8a949e,
  "nitrogeno-liquido": 0xc3e8ff,
};

/** Color neutro para una sustancia sin entrada curada (no debería ocurrir con el catálogo real, pero evita `undefined`). */
export const CHEMICAL_ELEMENT_FALLBACK_COLOR = 0x8890a8;

export function chemicalElementColor(id: ChemicalSubstanceId | string): number {
  return CHEMICAL_ELEMENT_COLORS[id as string] ?? CHEMICAL_ELEMENT_FALLBACK_COLOR;
}

/**
 * Color por tag químico (GDD 5.3) — usado para el resultado de una síntesis,
 * cuya identidad es la que el motor resuelve (receta/regla/fallback), no una
 * sustancia curada individualmente. TOX/CORR reutilizan los mismos valores
 * que `CLOUD_TINT` (`game/src/particles/effects/hazard-effect.ts`) para que
 * un mismo fenómeno se vea igual en la mesa y en el plano (principio 6).
 */
export const CHEMICAL_TAG_COLORS: Readonly<Record<ChemicalTag["name"], number>> = {
  OXI: 0x4fd8e0,
  COMB: 0xff8c42,
  ACID: 0xc9e04c,
  BASE: 0x4c8ce0,
  INERTE: 0x8a949e,
  VOLAT: 0xe04ca0,
  TOX: 0x6adc7a,
  CORR: 0xd4a83f,
};

export function chemicalResultColor(tags: ReadonlyArray<ChemicalTag>): number {
  return tags[0] ? CHEMICAL_TAG_COLORS[tags[0].name] : CHEMICAL_ELEMENT_FALLBACK_COLOR;
}

/**
 * Color por fracción [0,1] de un valor "de salud" genérico (verde → ámbar →
 * rojo) — extraído de `crew-strip.ts` (Fase 9) a la paleta compartida en
 * Subfase 11g para que `ship-status-hud.ts` use el mismo corte de 3 niveles
 * sin duplicar la función. Mismo corte que `fractionToLevel` del motor
 * (`engine/src/ship-status/ship-status-aggregation.ts`): >0.5 / >0.25 / resto.
 */
export function healthFractionColor(fraction: number): number {
  if (fraction > 0.5) return 0x64dc78;
  if (fraction > 0.25) return 0xe0a33f;
  return 0xe0483f;
}

/** Alpha del tinte de cicatriz de energía en un instante dado (Fase 11b) — parpadeo sinusoidal continuo, no un toggle discreto. */
export function sectionScarFlickerAlpha(elapsedSeconds: number): number {
  const phase = (elapsedSeconds / UNPOWERED_SECTION_FLICKER_PERIOD_SECONDS) * Math.PI * 2;
  const wave = (Math.sin(phase) + 1) / 2;
  return UNPOWERED_SECTION_MIN_ALPHA + wave * (UNPOWERED_SECTION_MAX_ALPHA - UNPOWERED_SECTION_MIN_ALPHA);
}
