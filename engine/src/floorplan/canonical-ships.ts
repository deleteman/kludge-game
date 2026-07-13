import { parseShipFloorplan } from "./floorplan-parser.js";
import type { ShipArchetype, ShipFloorplan } from "./floorplan.types.js";

import naveInvestigacion from "./maps/nave-investigacion.json";
import naveGuerra from "./maps/nave-guerra.json";
import naveExploracion from "./maps/nave-exploracion.json";
import naveMedica from "./maps/nave-medica.json";

/**
 * Las 4 naves canónicas (GDD 15.1), parseadas en carga de módulo — mismo
 * criterio que `build-component-catalog.ts`: un mapa inválido revienta en
 * tests, no en runtime de juego. Los JSON de `maps/` son formato Tiled:
 * editables abriendo el archivo en Tiled Map Editor.
 */
function buildCanonicalShips(): Readonly<Record<ShipArchetype, ShipFloorplan>> {
  const ships = [naveInvestigacion, naveGuerra, naveExploracion, naveMedica].map((raw) =>
    parseShipFloorplan(raw),
  );
  const byArchetype = new Map(ships.map((ship) => [ship.archetype, ship]));
  if (byArchetype.size !== 4) {
    throw new Error(
      `Canonical ships must cover the 4 archetypes exactly once; got: ${ships
        .map((ship) => ship.archetype)
        .join(", ")}`,
    );
  }
  return Object.fromEntries(byArchetype) as Record<ShipArchetype, ShipFloorplan>;
}

export const CANONICAL_SHIP_FLOORPLANS: Readonly<Record<ShipArchetype, ShipFloorplan>> =
  buildCanonicalShips();
