import type { EntityRegistry } from "../composition/entity-registry.js";
import type { ComponentId, PhysicalComponentDefinition } from "../components/physical-component.types.js";
import { hasLineOfSight, type CellBlockedQuery } from "../geometry/line-of-sight.js";
import { manhattanDistance } from "../geometry/grid-distance.js";
import type { GridPosition } from "../geometry/grid-position.types.js";

/**
 * Resolución de sensores: qué `triggerType` sabe simular el motor y hasta
 * dónde alcanza un emisor (ronda 1 de playtest de 13g).
 *
 * Por qué existe este módulo, en vez de la copia privada que tenía cada
 * resolvedor: `motionSensorRange` (motion) e `isPressureSensor` (pressure)
 * buscaban la pieza en `ATOMIC_COMPONENT_CATALOG`, así que **ningún sensor
 * COMPUESTO se simulaba nunca** — `sensor-movimiento-laser` y
 * `sensor-presion-gas`, que son los sensores de verdad del catálogo, quedaban
 * permanentemente encendidos por el fail-open de sus envoltorios. Igual que
 * cualquier creación de la mesa que lleve un `EM`. Acá se resuelve contra el
 * REGISTRO completo, el mismo criterio que `instanceFabricatorDomain` o
 * `isElectricSource`.
 */

/**
 * `triggerType` que cuentan como "detección de presencia": alguien (tripulante
 * o enemigo) cerca y a la vista.
 *
 * Son DOS porque el catálogo autoró dos nombres para lo mismo: el
 * `fotorreceptor` atómico dice `"optical"` y el `sensor-movimiento-laser`
 * compuesto dice `"motion"`. La constante que hacía este trabajo se llamaba
 * `MOTION_TRIGGER_TYPE` y valía `"optical"` — el nombre decía una cosa y el
 * valor otra, y por eso nadie notó que el sensor de movimiento del catálogo
 * nunca estuvo cubierto (patrón 10: leer la implementación, no el nombre).
 */
export const PRESENCE_TRIGGER_TYPES: ReadonlySet<string> = new Set(["optical", "motion"]);

/** `triggerType` que el motor resuelve contra la presión real de la sección. */
export const PRESSURE_TRIGGER_TYPES: ReadonlySet<string> = new Set(["pressure"]);

/**
 * `triggerType` que el motor resuelve contra la temperatura real de la sección
 * (Subfase 14a-1).
 *
 * Un solo valor —`"thermal"`, el que ya autoraba `sensor-termico-precision`—
 * y NO `"temperatura"` como pedía el orden de trabajo: el resto de los trigger
 * types del catálogo están en inglés (`pressure`, `motion`, `optical`), y
 * tener el mismo concepto con dos nombres es exactamente el bug que documenta
 * `PRESENCE_TRIGGER_TYPES` acá arriba.
 */
export const THERMAL_TRIGGER_TYPES: ReadonlySet<string> = new Set(["thermal"]);

/**
 * Alcance declarado del `EM` de una pieza cuyo `triggerType` esté en
 * `triggerTypes`, o `undefined` si la pieza no es ese tipo de sensor (o no
 * resuelve en el registro).
 */
export function emitterRangeOf(
  componentDefinitionId: ComponentId,
  componentRegistry: EntityRegistry<ComponentId, PhysicalComponentDefinition>,
  triggerTypes: ReadonlySet<string>,
): number | undefined {
  const definition = componentRegistry.get(componentDefinitionId);
  const property = definition?.data.functional?.find(
    (candidate) => candidate.tag === "EM" && triggerTypes.has(candidate.triggerType),
  );
  return property?.tag === "EM" ? property.range : undefined;
}

/**
 * ¿El sensor en `origin` alcanza a `target`? Manhattan dentro de `range` Y con
 * línea de visión real (paredes del tilemap y puertas cerradas, vía el
 * `CellBlockedQuery` que `/game` inyecta).
 *
 * Función pura y compartida a propósito: la consumen el resolvedor que DECIDE
 * el disparo y la capa de `/game` que DIBUJA el área de alcance. Dos copias de
 * esta expresión serían la UI mintiendo sobre el motor — un radio pintado que
 * no coincide con lo que el sensor detecta de verdad (patrón 1).
 */
export function emitterReaches(
  origin: GridPosition,
  target: GridPosition,
  range: number,
  blocked: CellBlockedQuery,
): boolean {
  return manhattanDistance(origin, target) <= range && hasLineOfSight(origin, target, blocked);
}

/**
 * Todas las celdas del plano que el sensor en `origin` cubre de verdad, para
 * pintarlas. Recorre solo el rombo de Manhattan (no la grilla entera) y
 * descarta lo que quede fuera de los límites.
 */
export function emitterCoverageCells(
  origin: GridPosition,
  range: number,
  gridSize: { readonly width: number; readonly height: number },
  blocked: CellBlockedQuery,
): ReadonlyArray<GridPosition> {
  const cells: GridPosition[] = [];
  for (let dy = -range; dy <= range; dy += 1) {
    const spread = range - Math.abs(dy);
    for (let dx = -spread; dx <= spread; dx += 1) {
      const cell = { x: origin.x + dx, y: origin.y + dy };
      if (cell.x < 0 || cell.y < 0 || cell.x >= gridSize.width || cell.y >= gridSize.height) {
        continue;
      }
      if (emitterReaches(origin, cell, range, blocked)) {
        cells.push(cell);
      }
    }
  }
  return cells;
}
