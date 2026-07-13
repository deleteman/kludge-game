import type { Brand } from "../shared/brand.types.js";
import type { Footprint, GridPosition } from "../geometry/grid-position.types.js";
import type { SectionId } from "../atmosphere/section.types.js";

/**
 * Plano físico de una nave (GDD 15.1): grid de secciones, grafo de adyacencia
 * por conducto y puntos de anclaje. Autorado en Tiled (JSON), estático y
 * versionado con el juego (GDD 15.4) — el estado dinámico de partida
 * (componentes, sustancias, cicatrices) vive aparte, en el blueprint.
 *
 * Reutiliza `SectionId` de atmósfera y `GridPosition`/`Footprint` de
 * `geometry/` (principio 7 de CLAUDE.md: un solo sistema de posicionamiento
 * compartido con la mesa de creación).
 */
export const SHIP_ARCHETYPES = ["investigacion", "guerra", "exploracion", "medica"] as const;

export type ShipArchetype = (typeof SHIP_ARCHETYPES)[number];

/** Los 4 tipos de capa del plano (GDD §10): ventilación, eléctrica, fluidos, señales. */
export const CONDUIT_KINDS = ["ventilacion", "electrico", "fluido", "senal"] as const;

export type ConduitKind = (typeof CONDUIT_KINDS)[number];

export interface FloorplanSection {
  readonly id: SectionId;
  /** Clave de traducción (localización ES/EN desde el MVP) — nunca texto literal. */
  readonly nameKey: string;
  /** Celdas ocupadas; varios rectángulos con el mismo id en Tiled se unen (formas en L). */
  readonly cells: readonly GridPosition[];
}

export interface ConduitConnection {
  readonly a: SectionId;
  readonly b: SectionId;
  readonly kind: ConduitKind;
  /**
   * Posición del marcador sobre la frontera entre `a` y `b`, en unidades de
   * celda (puede ser fraccional: el punto cae sobre una arista). La consume el
   * render y, en Fase 8, las partículas de flujo en conductos.
   */
  readonly position: GridPosition;
  /**
   * Apertura inicial en [0, 1]. Solo significativa para `ventilacion` (GDD
   * 5.5): 1 = abierta, 0 = sellada de fábrica (ej. sala de aislamiento de la
   * nave médica).
   */
  readonly initialAperture: number;
}

export type AnchorId = Brand<string, "AnchorId">;

/** Punto donde puede montarse un componente (GDD 15.1). La sección se deriva de la posición. */
export interface AnchorPoint {
  readonly id: AnchorId;
  readonly sectionId: SectionId;
  readonly position: GridPosition;
}

export interface ShipFloorplan {
  readonly id: string;
  readonly archetype: ShipArchetype;
  /** Clave de traducción del nombre de la nave. */
  readonly nameKey: string;
  /** Tamaño total del mapa en celdas. */
  readonly gridSize: Footprint;
  readonly sections: readonly FloorplanSection[];
  readonly conduits: readonly ConduitConnection[];
  readonly anchors: readonly AnchorPoint[];
}

/** Área de una sección en celdas — es también su volumen atmosférico (ver `atmosphere-projection.ts`). */
export function sectionArea(section: FloorplanSection): number {
  return section.cells.length;
}
