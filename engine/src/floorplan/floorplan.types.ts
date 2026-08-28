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

/**
 * Identidad estable de un conducto (Subfase 13h). Hasta acá un
 * `ConduitConnection` no tenía id y `/game` improvisaba claves compuestas
 * `${a}-${b}-${kind}` para indexar sus efectos de flujo — suficiente mientras
 * nadie pudiera OPERAR un conducto, insuficiente desde que el jugador puede
 * mandar a un tripulante a cerrar una válvula concreta.
 *
 * Se deriva determinísticamente al parsear (no vive en los JSON de Tiled), así
 * que es estable entre cargas sin tocar los mapas ya autorados.
 */
export type ConduitId = Brand<string, "ConduitId">;

export interface ConduitConnection {
  readonly id: ConduitId;
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

export type ComponentSeedId = Brand<string, "ComponentSeedId">;

/**
 * Objeto compuesto autorado directamente en Tiled, capa `semillas` (estándar
 * nuevo, rework del capítulo 1: "sin stock → inspeccionar → desarmar →
 * reutilizar"). Solo compuestos (GDD 7.1-7.2: los átomos no se "encuentran"
 * sueltos con identidad propia dando vueltas por la nave) — la validación de
 * que `componentId` resuelve a un compuesto real del catálogo vive en
 * `instantiate-component-seeds.ts`, no acá: este parser no conoce el
 * `componentRegistry` (se mantiene puro, igual que el resto de
 * `floorplan-parser.ts`).
 */
export interface ComponentSeedPoint {
  readonly id: ComponentSeedId;
  readonly sectionId: SectionId;
  readonly position: GridPosition;
  /** Debe resolver a un `ComponentId` compuesto — validado al instanciar, no al parsear. */
  readonly componentId: string;
  readonly condition?: string;
  /** Si se omite, se deriva del `id` del propio objeto Tiled (estable entre parseos). */
  readonly instanceId?: string;
  /** Si está presente, la semilla solo se instancia cuando ese capítulo pasa a ser el activo. Si se omite, se instancia siempre (kit inicial de la nave). */
  readonly chapterId?: string;
}

export type DoorSeedId = Brand<string, "DoorSeedId">;

/**
 * Puerta autorada en Tiled, capa `puertas` (Subfase 13h). Points con
 * propiedades `a`/`b`, molde exacto de la capa `conductos`.
 *
 * Una puerta autorada NO es una pieza del catálogo: es parte del casco, como
 * una pared. Las puertas CONSTRUIBLES son otra cosa —cualquier componente con
 * `ACT` + `EST` que el jugador instale sobre un umbral— y se resuelven en
 * runtime por propiedades, no acá.
 *
 * `a`/`b` son las secciones que el umbral separa; la posición da la celda que
 * bloquea cuando está cerrada.
 */
export interface DoorSeedPoint {
  readonly id: DoorSeedId;
  readonly a: SectionId;
  readonly b: SectionId;
  readonly position: GridPosition;
  /**
   * Celdas que ocupa el umbral, contadas desde `position` a lo largo de `axis`.
   *
   * Existe porque los vanos reales del mapa no son todos de una celda: en
   * `nave-exploracion`, sala-hibernacion↔pasillo y bodega↔pasillo tienen vanos
   * de dos. Modelarlos como DOS puertas sería peor que un detalle cosmético —
   * cada puerta aporta su propia arista de difusión, así que un vano de dos
   * celdas intercambiaría aire al doble de velocidad que uno de una.
   */
  readonly span: number;
  readonly axis: "x" | "y";
  /** Apertura inicial. Por defecto cerrada: la nave arranca compartimentada. */
  readonly initialOpen: boolean;
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
  /** Objetos compuestos sembrados vía la capa Tiled `semillas`. Capa opcional: mapas sin ella parsean `[]`. */
  readonly componentSeeds: readonly ComponentSeedPoint[];
  /** Puertas autoradas vía la capa Tiled `puertas` (13h). Capa opcional: mapas sin ella parsean `[]`. */
  readonly doors: readonly DoorSeedPoint[];
}

/** Área de una sección en celdas — es también su volumen atmosférico (ver `atmosphere-projection.ts`). */
export function sectionArea(section: FloorplanSection): number {
  return section.cells.length;
}

/**
 * Sección que contiene una celda dada, o `undefined` si la celda no pertenece
 * a ninguna (fuera del plano, o hueco entre secciones). Lo necesita `/game`
 * (Fase 10d) para resolver a qué sección pertenece una celda clickeada por el
 * jugador — no había ningún consumidor de esto antes de que el plano fuera
 * interactivo.
 */
export function sectionContainingCell(
  floorplan: ShipFloorplan,
  position: GridPosition,
): FloorplanSection | undefined {
  return floorplan.sections.find((section) =>
    section.cells.some((cell) => cell.x === position.x && cell.y === position.y),
  );
}
