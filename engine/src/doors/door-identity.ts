import type { PhysicalComponentDefinition } from "../components/physical-component.types.js";
import type { ActuatorProperty } from "../properties/functional.types.js";
import type { FloorplanSection, ShipFloorplan } from "../floorplan/floorplan.types.js";
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
 * El umbral es lo tercero que hace falta y no se declara en ningún lado: se
 * deriva de la geometría. Una celda es umbral si toca ortogonalmente celdas de
 * DOS secciones distintas.
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
 * Par de secciones que separa una celda de umbral, o `undefined` si la celda no
 * es umbral. Devuelve las dos secciones ordenadas para que el id derivado de
 * una puerta construida sea estable.
 */
export function thresholdSectionsAt(
  floorplan: ShipFloorplan,
  cell: GridPosition,
): readonly [FloorplanSection, FloorplanSection] | undefined {
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

  const sections = [...touching.values()].sort((left, right) => left.id.localeCompare(right.id));
  // Más de dos secciones (una esquina donde se juntan tres salas) no es un
  // umbral: una puerta separa dos lados, no tres. Se deja fuera a propósito en
  // vez de elegir un par arbitrario.
  const [first, second] = sections;
  return sections.length === 2 && first && second ? [first, second] : undefined;
}

function sectionAt(floorplan: ShipFloorplan, cell: GridPosition): FloorplanSection | undefined {
  return floorplan.sections.find((section) =>
    section.cells.some((candidate) => candidate.x === cell.x && candidate.y === cell.y),
  );
}
