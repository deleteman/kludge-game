import type { PhysicalComponentDefinition } from "../components/physical-component.types.js";
import type { ActuatorProperty } from "../properties/functional.types.js";
import type { FloorplanSection, ShipFloorplan } from "../floorplan/floorplan.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import type { GridPosition } from "../geometry/grid-position.types.js";
import { DOOR_PARAMETERS } from "./door-parameters.js";

/**
 * Qué convierte a una instalación en puerta (Subfase 13h).
 *
 * Identidad por PROPIEDADES, nunca por id de catálogo (principio 1 de
 * CLAUDE.md): una puerta es cualquier cosa que pueda moverse (`ACT`) y aguantar
 * (`EST`) puesta sobre un umbral. `compuerta-blindada` califica, pero también
 * calificaría una plancha motorizada que el jugador improvise en la mesa — que
 * es exactamente el tipo de composición libre que el juego promete.
 *
 * El umbral es lo tercero que hace falta. Para una puerta que el jugador
 * improvisa no se declara en ningún lado y hay que derivarlo de la geometría
 * (`thresholdSectionsAt`); para una puerta AUTORADA en la capa Tiled `puertas`,
 * el mapa ya dice qué dos secciones separa y ese dato manda — ver
 * `cellSeparates` y la resolución en dos pasos de `syncInstalledDoors`.
 */
export function isDoorCapable(definition: PhysicalComponentDefinition | undefined): boolean {
  const functional = definition?.data.functional;
  if (!functional) {
    return false;
  }
  return (
    functional.some((property) => property.tag === "ACT") &&
    functional.some((property) => property.tag === "EST")
  );
}

/** El `ACT` de la definición, del que salen `cadence` (transición) y `power` (fuerza). */
export function doorActuator(
  definition: PhysicalComponentDefinition | undefined,
): ActuatorProperty | undefined {
  return definition?.data.functional?.find(
    (property): property is ActuatorProperty => property.tag === "ACT",
  );
}

/**
 * Segundos que tarda la hoja en abrirse o cerrarse. Sale de `ACT.cadence`, que
 * hasta 13h solo lo leía el cálculo de daño de arma: la cadencia de un
 * actuador es cada cuánto puede actuar, y en una puerta eso ES lo que tarda en
 * completar su movimiento.
 *
 * Las puertas autoradas en Tiled no tienen `ACT` detrás (son casco, no piezas
 * del catálogo) y usan el default de parámetros.
 */
export function doorTransitionSeconds(actuator: ActuatorProperty | undefined): number {
  return actuator?.cadence ?? DOOR_PARAMETERS.defaultTransitionSeconds;
}

/**
 * TODAS las secciones que una celda toca (la suya y las cuatro ortogonales),
 * sin exigir que sean dos.
 *
 * Separado de `thresholdSectionsAt` en la ronda 3 de playtest de 13g: la boca de
 * un pasillo toca tres secciones y aun así puede separar sin ambigüedad las dos
 * que una puerta AUTORADA declara. Quien tiene ese dato necesita preguntar "¿la
 * celda toca estas dos?" y no "¿cuáles son las dos?".
 */
export function sectionsTouchingCell(
  floorplan: ShipFloorplan,
  cell: GridPosition,
): readonly FloorplanSection[] {
  const neighbours: GridPosition[] = [
    { x: cell.x + 1, y: cell.y },
    { x: cell.x - 1, y: cell.y },
    { x: cell.x, y: cell.y + 1 },
    { x: cell.x, y: cell.y - 1 },
  ];

  const own = sectionAt(floorplan, cell);
  const touching = new Map<string, FloorplanSection>();
  if (own) {
    touching.set(own.id, own);
  }
  for (const neighbour of neighbours) {
    const section = sectionAt(floorplan, neighbour);
    if (section) {
      touching.set(section.id, section);
    }
  }
  return [...touching.values()].sort((left, right) => left.id.localeCompare(right.id));
}

/**
 * ¿Esta celda separa estas DOS secciones concretas? Es la pregunta que puede
 * responder quien ya sabe qué separa la puerta —el mapa lo declara— y por eso
 * no le molesta que la celda toque una tercera.
 *
 * Es la precondición REAL para dar de alta una puerta autorada, y por eso la
 * comparten el runtime y `validateFloorplanIntegrity`: si el validador exigiera
 * algo distinto de lo que el runtime exige, volveríamos a tener un mapa que
 * valida y una puerta que no funciona (o al revés, que es lo que pasó en la
 * ronda 2).
 */
export function cellSeparates(
  floorplan: ShipFloorplan,
  cell: GridPosition,
  a: SectionId,
  b: SectionId,
): boolean {
  if (a === b) {
    return false;
  }
  const ids = new Set(sectionsTouchingCell(floorplan, cell).map((section) => section.id));
  return ids.has(a) && ids.has(b);
}

/**
 * Par de secciones que separa una celda de umbral, INFERIDO de la geometría, o
 * `undefined` si no se puede inferir. Ordenado para que el id derivado de una
 * puerta construida sea estable.
 */
export function thresholdSectionsAt(
  floorplan: ShipFloorplan,
  cell: GridPosition,
): readonly [FloorplanSection, FloorplanSection] | undefined {
  const sections = sectionsTouchingCell(floorplan, cell);
  // Más de dos secciones (una esquina donde se juntan tres salas) no es un
  // umbral INFERIBLE: no hay forma de saber cuál de los tres pares separa, y
  // elegir uno arbitrario sería peor que no decidir. Sigue siendo el camino
  // correcto para una puerta que el jugador improvisa, donde no hay ningún dato
  // que desempate. Una puerta AUTORADA no pasa por acá: el mapa declara su par
  // y se comprueba con `cellSeparates` (ronda 3 de playtest de 13g — antes esto
  // era el único camino, y una puerta perfectamente válida en la boca de un
  // pasillo se descartaba en silencio).
  const [first, second] = sections;
  return sections.length === 2 && first && second ? [first, second] : undefined;
}

function sectionAt(floorplan: ShipFloorplan, cell: GridPosition): FloorplanSection | undefined {
  return floorplan.sections.find((section) =>
    section.cells.some((candidate) => candidate.x === cell.x && candidate.y === cell.y),
  );
}
