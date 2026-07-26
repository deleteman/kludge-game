import type { PlacedComponentInstance } from "../blueprint/blueprint.types.js";
import type { ShipArchetype } from "./floorplan.types.js";
import { SHIP_ARCHETYPES } from "./floorplan.types.js";

/**
 * Estado inicial de componentes instalados por arquetipo (Fase 9.5, punto 5
 * del plan de esa fase). No existe todavía un "modo dev" de autoría (GDD
 * 15.2, Fase 11 punto 3) para fijar esto con la propia UI de juego.
 *
 * VACÍO por ahora (playtest #8): el kit placeholder de Fase 9.5 (plancha/
 * batería/cable en (0,0)/(3,0)/(4,0)) aparecía como piezas fantasma en la
 * esquina del plano, sin función en el capítulo 1 (el selector de instalación
 * ofrece las 20 piezas atómicas igual). Una partida nueva arranca solo con el
 * actuador atascado del capítulo 1, que añade `campaign-save-factory.ts`
 * aparte. Se conserva la estructura por si un capítulo futuro necesita sembrar
 * componentes reales por arquetipo desde el modo dev.
 */
function starterKit(): ReadonlyArray<PlacedComponentInstance> {
  return [];
}

export const INITIAL_SHIP_STATE_BY_ARCHETYPE: Record<
  ShipArchetype,
  ReadonlyArray<PlacedComponentInstance>
> = Object.fromEntries(
  SHIP_ARCHETYPES.map((archetype) => [archetype, starterKit()]),
) as Record<ShipArchetype, ReadonlyArray<PlacedComponentInstance>>;
