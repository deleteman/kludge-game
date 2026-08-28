import { GRID_CELL_SIZE_PX } from "../geometry/grid-position.types.js";
import type { GridPosition } from "../geometry/grid-position.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import { assertFloorplanIntegrity } from "./floorplan-integrity.js";
import { CONDUIT_KINDS, SHIP_ARCHETYPES } from "./floorplan.types.js";
import type {
  AnchorId,
  AnchorPoint,
  ComponentSeedId,
  ComponentSeedPoint,
  ConduitConnection,
  ConduitId,
  ConduitKind,
  DoorSeedId,
  DoorSeedPoint,
  FloorplanSection,
  ShipArchetype,
  ShipFloorplan,
} from "./floorplan.types.js";
import type { TiledLayer, TiledMap, TiledObject, TiledProperty } from "./tiled.types.js";

/**
 * Parser del JSON de Tiled a `ShipFloorplan` (GDD 15.1). Guards escritos a
 * mano, mismo criterio que `blueprint-serializer.ts`: `/engine` sin
 * dependencias runtime (no zod/ajv). Capas consumidas: `secciones` (rects),
 * `conductos` (puntos), `anclajes` (puntos), y las opcionales `semillas` y
 * `puertas` (puntos); cualquier otra capa se ignora —
 * los mapas pueden ganar tile layers visuales sin tocar este código.
 */
export class FloorplanParseError extends Error {}

export function parseShipFloorplan(json: unknown): ShipFloorplan {
  const map = assertIsTiledMapShape(json);

  const mapProperties = propertyBag(map.properties, "map");
  const schemaVersion = mapProperties.number("schemaVersion");
  if (schemaVersion !== 1) {
    throw new FloorplanParseError(`Unsupported floorplan schemaVersion: ${schemaVersion}`);
  }
  const shipId = mapProperties.string("shipId");
  const archetype = mapProperties.string("archetype");
  if (!isShipArchetype(archetype)) {
    throw new FloorplanParseError(`Unknown ship archetype: ${archetype}`);
  }
  const nameKey = mapProperties.string("nameKey");

  const sections = parseSections(requireObjectLayer(map, "secciones"));
  const conduits = parseConduits(requireObjectLayer(map, "conductos"));
  const anchors = parseAnchors(requireObjectLayer(map, "anclajes"), sections);
  const componentSeeds = parseComponentSeeds(findOptionalObjectLayer(map, "semillas"), sections);
  const doors = parseDoors(findOptionalObjectLayer(map, "puertas"), sections);

  const floorplan: ShipFloorplan = {
    id: shipId,
    archetype,
    nameKey,
    gridSize: { width: map.width, height: map.height },
    sections,
    conduits,
    anchors,
    componentSeeds,
    doors,
  };

  try {
    assertFloorplanIntegrity(floorplan);
  } catch (error) {
    throw new FloorplanParseError((error as Error).message);
  }

  return floorplan;
}

// ---------------------------------------------------------------------------
// Forma del JSON de Tiled
// ---------------------------------------------------------------------------

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertIsTiledMapShape(value: unknown): TiledMap {
  if (!isPlainObject(value)) {
    throw new FloorplanParseError("Floorplan must be a Tiled JSON object");
  }
  for (const field of ["width", "height", "tilewidth", "tileheight"] as const) {
    if (typeof value[field] !== "number") {
      throw new FloorplanParseError(`Tiled map field '${field}' must be a number`);
    }
  }
  if (value.tilewidth !== GRID_CELL_SIZE_PX || value.tileheight !== GRID_CELL_SIZE_PX) {
    throw new FloorplanParseError(
      `Tiled map tile size must be ${GRID_CELL_SIZE_PX}px (grid unit, GDD 10.1/§17); got ${String(value.tilewidth)}x${String(value.tileheight)}`,
    );
  }
  if (value.orientation !== undefined && value.orientation !== "orthogonal") {
    throw new FloorplanParseError(
      `Tiled map orientation must be 'orthogonal'; got '${String(value.orientation)}'`,
    );
  }
  if (!Array.isArray(value.layers)) {
    throw new FloorplanParseError("Tiled map must have a 'layers' array");
  }
  return value as unknown as TiledMap;
}

function requireObjectLayer(map: TiledMap, name: string): readonly TiledObject[] {
  const layer = map.layers.find(
    (candidate: TiledLayer) => candidate.type === "objectgroup" && candidate.name === name,
  );
  if (!layer) {
    throw new FloorplanParseError(`Missing required object layer '${name}'`);
  }
  if (!Array.isArray(layer.objects)) {
    throw new FloorplanParseError(`Object layer '${name}' must have an 'objects' array`);
  }
  return layer.objects;
}

/**
 * Igual que `requireObjectLayer`, pero la capa es OPCIONAL: mapas sin capa
 * `semillas` todavía autorada (los 3 arquetipos sin verificación de punta a
 * punta) siguen parseando en vez de romper — devuelve `[]`.
 */
function findOptionalObjectLayer(map: TiledMap, name: string): readonly TiledObject[] {
  const layer = map.layers.find(
    (candidate: TiledLayer) => candidate.type === "objectgroup" && candidate.name === name,
  );
  if (!layer) {
    return [];
  }
  if (!Array.isArray(layer.objects)) {
    throw new FloorplanParseError(`Object layer '${name}' must have an 'objects' array`);
  }
  return layer.objects;
}

// ---------------------------------------------------------------------------
// Propiedades custom de Tiled ({ name, type, value }[])
// ---------------------------------------------------------------------------

interface PropertyBag {
  string(name: string): string;
  number(name: string): number;
  numberOr(name: string, fallback: number): number;
  stringOrUndefined(name: string): string | undefined;
}

function propertyBag(properties: readonly TiledProperty[] | undefined, owner: string): PropertyBag {
  const byName = new Map<string, unknown>();
  for (const property of properties ?? []) {
    if (isPlainObject(property) && typeof property.name === "string") {
      byName.set(property.name, property.value);
    }
  }
  return {
    string(name) {
      const value = byName.get(name);
      if (typeof value !== "string" || value.length === 0) {
        throw new FloorplanParseError(`Property '${name}' of ${owner} must be a non-empty string`);
      }
      return value;
    },
    number(name) {
      const value = byName.get(name);
      if (typeof value !== "number" || Number.isNaN(value)) {
        throw new FloorplanParseError(`Property '${name}' of ${owner} must be a number`);
      }
      return value;
    },
    numberOr(name, fallback) {
      return byName.has(name) ? this.number(name) : fallback;
    },
    stringOrUndefined(name) {
      const value = byName.get(name);
      if (value === undefined) {
        return undefined;
      }
      if (typeof value !== "string" || value.length === 0) {
        throw new FloorplanParseError(`Property '${name}' of ${owner} must be a non-empty string`);
      }
      return value;
    },
  };
}

function isShipArchetype(value: string): value is ShipArchetype {
  return (SHIP_ARCHETYPES as readonly string[]).includes(value);
}

function isConduitKind(value: string): value is ConduitKind {
  return (CONDUIT_KINDS as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Capas
// ---------------------------------------------------------------------------

function toCellUnits(px: number, what: string): number {
  const cells = px / GRID_CELL_SIZE_PX;
  if (!Number.isInteger(cells)) {
    throw new FloorplanParseError(
      `${what} (${px}px) is not aligned to the ${GRID_CELL_SIZE_PX}px grid`,
    );
  }
  return cells;
}

function parseSections(objects: readonly TiledObject[]): FloorplanSection[] {
  const byId = new Map<string, { nameKey: string; cells: GridPosition[] }>();
  for (const object of objects) {
    const properties = propertyBag(object.properties, `section object #${object.id}`);
    const id = properties.string("id");
    const nameKey = properties.string("nameKey");
    if (typeof object.width !== "number" || typeof object.height !== "number") {
      throw new FloorplanParseError(`Section '${id}' must be a rectangle object`);
    }
    const x = toCellUnits(object.x, `Section '${id}' x`);
    const y = toCellUnits(object.y, `Section '${id}' y`);
    const width = toCellUnits(object.width, `Section '${id}' width`);
    const height = toCellUnits(object.height, `Section '${id}' height`);
    if (width <= 0 || height <= 0) {
      throw new FloorplanParseError(`Section '${id}' must have a positive size`);
    }

    let entry = byId.get(id);
    if (!entry) {
      entry = { nameKey, cells: [] };
      byId.set(id, entry);
    } else if (entry.nameKey !== nameKey) {
      throw new FloorplanParseError(
        `Section '${id}' has conflicting nameKey values ('${entry.nameKey}' vs '${nameKey}')`,
      );
    }
    for (let cellY = y; cellY < y + height; cellY += 1) {
      for (let cellX = x; cellX < x + width; cellX += 1) {
        entry.cells.push({ x: cellX, y: cellY });
      }
    }
  }

  return [...byId.entries()].map(([id, entry]) => ({
    id: id as SectionId,
    nameKey: entry.nameKey,
    cells: entry.cells,
  }));
}

function parseConduits(objects: readonly TiledObject[]): ConduitConnection[] {
  return objects.map((object, index) => {
    const properties = propertyBag(object.properties, `conduit object #${object.id}`);
    const kind = properties.string("kind");
    if (!isConduitKind(kind)) {
      throw new FloorplanParseError(`Unknown conduit kind: ${kind}`);
    }
    const a = properties.string("a");
    const b = properties.string("b");
    return {
      // Subfase 13h: identidad derivada, no autorada. Lleva el índice porque los
      // mapas reales SÍ tienen pares repetidos (`nave-exploracion` autora dos
      // conductos `senal` entre pasillo y soporte-vital), así que `kind:a:b` solo
      // no distingue — y dos válvulas distintas con el mismo id serían una sola
      // válvula para el jugador.
      id: `${kind}:${a}:${b}:${index}` as ConduitId,
      a: a as SectionId,
      b: b as SectionId,
      kind,
      // El marcador cae sobre una arista entre celdas: posición fraccional permitida.
      position: { x: object.x / GRID_CELL_SIZE_PX, y: object.y / GRID_CELL_SIZE_PX },
      initialAperture: properties.numberOr("initialAperture", 1),
    };
  });
}

/**
 * Capa `puertas` (Subfase 13h). Molde exacto de `parseConduits` —Points con
 * `a`/`b`— porque una puerta es, atmosféricamente, otra arista entre dos
 * secciones. La diferencia con un conducto es que su apertura la decide el
 * runtime y que además bloquea el PASO, no solo la difusión.
 *
 * Capa OPCIONAL: los arquetipos que todavía no tienen puertas autoradas parsean
 * `[]` y siguen cargando (mismo criterio que `semillas`).
 *
 * La celda se resuelve con floor-división como los anclajes, no fraccional como
 * los conductos: una puerta OCUPA una celda concreta del umbral (hay que poder
 * preguntar "¿esta celda está bloqueada?"), mientras que el marcador de un
 * conducto solo se dibuja sobre la arista.
 */
function parseDoors(
  objects: readonly TiledObject[],
  sections: readonly FloorplanSection[],
): DoorSeedPoint[] {
  const sectionByCell = new Map<string, SectionId>();
  for (const section of sections) {
    for (const cell of section.cells) {
      sectionByCell.set(`${cell.x},${cell.y}`, section.id);
    }
  }

  return objects.map((object, index) => {
    const properties = propertyBag(object.properties, `door object #${object.id}`);
    const a = properties.string("a");
    const b = properties.string("b");
    const cell: GridPosition = {
      x: Math.floor(object.x / GRID_CELL_SIZE_PX),
      y: Math.floor(object.y / GRID_CELL_SIZE_PX),
    };
    if (!sectionByCell.has(`${cell.x},${cell.y}`)) {
      throw new FloorplanParseError(
        `Door '${a}-${b}' at cell (${cell.x}, ${cell.y}) falls outside every section`,
      );
    }
    return {
      id: (properties.stringOrUndefined("id") ?? `${a}:${b}:${index}`) as DoorSeedId,
      a: a as SectionId,
      b: b as SectionId,
      position: cell,
      span: Math.max(1, properties.numberOr("span", 1)),
      axis: properties.stringOrUndefined("axis") === "y" ? "y" : "x",
      // Por defecto CERRADA: la nave arranca compartimentada, que es la
      // propiedad que esta subfase existe para producir.
      initialOpen: properties.numberOr("initialOpen", 0) === 1,
    };
  });
}

function parseAnchors(
  objects: readonly TiledObject[],
  sections: readonly FloorplanSection[],
): AnchorPoint[] {
  const sectionByCell = new Map<string, SectionId>();
  for (const section of sections) {
    for (const cell of section.cells) {
      sectionByCell.set(`${cell.x},${cell.y}`, section.id);
    }
  }

  return objects.map((object) => {
    const properties = propertyBag(object.properties, `anchor object #${object.id}`);
    const id = properties.string("id");
    const cell: GridPosition = {
      x: Math.floor(object.x / GRID_CELL_SIZE_PX),
      y: Math.floor(object.y / GRID_CELL_SIZE_PX),
    };
    const sectionId = sectionByCell.get(`${cell.x},${cell.y}`);
    if (!sectionId) {
      throw new FloorplanParseError(
        `Anchor '${id}' at cell (${cell.x}, ${cell.y}) falls outside every section`,
      );
    }
    return { id: id as AnchorId, sectionId, position: cell };
  });
}

/**
 * Capa `semillas` (estándar nuevo): mismo criterio de posición que
 * `parseAnchors` (floor-división, tolerante a coordenadas fraccionales de
 * autoría) — pero NO valida que `componentId` sea un compuesto real: eso
 * exige el `componentRegistry`, que este módulo no conoce
 * (`instantiate-component-seeds.ts` lo hace).
 */
function parseComponentSeeds(
  objects: readonly TiledObject[],
  sections: readonly FloorplanSection[],
): ComponentSeedPoint[] {
  const sectionByCell = new Map<string, SectionId>();
  for (const section of sections) {
    for (const cell of section.cells) {
      sectionByCell.set(`${cell.x},${cell.y}`, section.id);
    }
  }

  return objects.map((object) => {
    const properties = propertyBag(object.properties, `component seed object #${object.id}`);
    const id = properties.string("id");
    const componentId = properties.string("componentId");
    const cell: GridPosition = {
      x: Math.floor(object.x / GRID_CELL_SIZE_PX),
      y: Math.floor(object.y / GRID_CELL_SIZE_PX),
    };
    const sectionId = sectionByCell.get(`${cell.x},${cell.y}`);
    if (!sectionId) {
      throw new FloorplanParseError(
        `Component seed '${id}' at cell (${cell.x}, ${cell.y}) falls outside every section`,
      );
    }
    return {
      id: id as ComponentSeedId,
      sectionId,
      position: cell,
      componentId,
      condition: properties.stringOrUndefined("condition"),
      instanceId: properties.stringOrUndefined("instanceId"),
      chapterId: properties.stringOrUndefined("chapterId"),
    };
  });
}
