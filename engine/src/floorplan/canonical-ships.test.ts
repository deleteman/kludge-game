import { describe, expect, it } from "vitest";

import type { SectionId } from "../atmosphere/section.types.js";
import { CANONICAL_SHIP_FLOORPLANS } from "./canonical-ships.js";
import { validateFloorplanIntegrity } from "./floorplan-integrity.js";
import { SHIP_ARCHETYPES } from "./floorplan.types.js";
import type { ShipFloorplan } from "./floorplan.types.js";

/**
 * Los 4 mapas reales de `maps/` como fixtures de integración: si un mapa se
 * edita en Tiled y rompe un invariante (sección solapada, conducto colgante,
 * nave partida en dos), estos tests lo detectan antes de llegar al juego.
 */

/** Conectividad del grafo de ventilación ignorando apertura (una válvula sellada sigue siendo un vecino). */
function ventilationReachable(ship: ShipFloorplan): Set<string> {
  const neighbors = new Map<string, string[]>();
  for (const conduit of ship.conduits) {
    if (conduit.kind !== "ventilacion") continue;
    neighbors.set(conduit.a, [...(neighbors.get(conduit.a) ?? []), conduit.b]);
    neighbors.set(conduit.b, [...(neighbors.get(conduit.b) ?? []), conduit.a]);
  }
  const start = ship.sections[0]!.id;
  const visited = new Set<string>([start]);
  const queue: string[] = [start];
  while (queue.length > 0) {
    for (const next of neighbors.get(queue.shift()!) ?? []) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  return visited;
}

describe("CANONICAL_SHIP_FLOORPLANS", () => {
  it("cubre los 4 arquetipos exactamente", () => {
    expect(Object.keys(CANONICAL_SHIP_FLOORPLANS).sort()).toEqual([...SHIP_ARCHETYPES].sort());
    for (const archetype of SHIP_ARCHETYPES) {
      expect(CANONICAL_SHIP_FLOORPLANS[archetype].archetype).toBe(archetype);
      expect(CANONICAL_SHIP_FLOORPLANS[archetype].id).toBe(`nave-${archetype}`);
    }
  });

  for (const archetype of SHIP_ARCHETYPES) {
    describe(`nave-${archetype}`, () => {
      const ship = CANONICAL_SHIP_FLOORPLANS[archetype];

      it("tiene 11 secciones sin issues de integridad", () => {
        expect(ship.sections).toHaveLength(11);
        expect(validateFloorplanIntegrity(ship)).toEqual([]);
      });

      it("todas las secciones son alcanzables por ventilación (grafo conexo)", () => {
        expect(ventilationReachable(ship).size).toBe(ship.sections.length);
      });

      it("tiene al menos 2 anclajes por sección y ~35+ en total", () => {
        expect(ship.anchors.length).toBeGreaterThanOrEqual(35);
        for (const section of ship.sections) {
          const own = ship.anchors.filter((anchor) => anchor.sectionId === section.id);
          expect(own.length, `anclajes de ${section.id}`).toBeGreaterThanOrEqual(2);
        }
      });

      it("tiene troncal eléctrica (conductos 'electrico' presentes)", () => {
        expect(ship.conduits.some((conduit) => conduit.kind === "electrico")).toBe(true);
      });
    });
  }

  it("guerra: el polvorín solo ventila a través de la armería (riesgo autorado)", () => {
    const guerra = CANONICAL_SHIP_FLOORPLANS.guerra;
    const polvorin = "polvorin" as SectionId;
    const ventPartners = guerra.conduits
      .filter(
        (conduit) =>
          conduit.kind === "ventilacion" && (conduit.a === polvorin || conduit.b === polvorin),
      )
      .map((conduit) => (conduit.a === polvorin ? conduit.b : conduit.a));
    expect(ventPartners).toEqual(["armeria"]);
  });

  it("medica: la sala de aislamiento arranca sellada (apertura 0)", () => {
    const medica = CANONICAL_SHIP_FLOORPLANS.medica;
    const aislamiento = "sala-aislamiento" as SectionId;
    const conduits = medica.conduits.filter(
      (conduit) => conduit.a === aislamiento || conduit.b === aislamiento,
    );
    expect(conduits).toHaveLength(1);
    expect(conduits[0]?.kind).toBe("ventilacion");
    expect(conduits[0]?.initialAperture).toBe(0);
  });

  // Subfase 13h — capa `puertas`. Solo `nave-exploracion` está autorada; los
  // otros 3 arquetipos parsean `[]` (capa opcional) y quedan como deuda de
  // contenido, junto a sus conductos `senal`/`fluido`.
  it("exploracion: hay una puerta por cada frontera de ventilación", () => {
    const exploracion = CANONICAL_SHIP_FLOORPLANS.exploracion;
    const boundary = (a: string, b: string) => [a, b].sort().join("|");
    const vented = new Set(
      exploracion.conduits
        .filter((conduit) => conduit.kind === "ventilacion")
        .map((conduit) => boundary(conduit.a, conduit.b)),
    );
    const withDoor = new Set(exploracion.doors.map((door) => boundary(door.a, door.b)));

    // Si una frontera ventilada no tuviera puerta, esa sala quedaría fuera de
    // la compartimentación y una brecha vecina la desangraría igual que antes
    // de 13h — el agujero es silencioso, por eso se comprueba la cobertura
    // entera y no un caso suelto.
    expect([...vented].sort()).toEqual([...withDoor].sort());
  });

  it("exploracion: las puertas caen en celdas de alguna de las dos secciones que separan", () => {
    const exploracion = CANONICAL_SHIP_FLOORPLANS.exploracion;
    for (const door of exploracion.doors) {
      const sides = exploracion.sections.filter(
        (section) => section.id === door.a || section.id === door.b,
      );
      expect(sides).toHaveLength(2);
      const covered = sides.some((section) =>
        section.cells.some(
          (cell) => cell.x === door.position.x && cell.y === door.position.y,
        ),
      );
      expect(covered, `puerta '${door.id}' fuera de sección`).toBe(true);
    }
  });

  it("los arquetipos sin capa `puertas` siguen cargando con lista vacía", () => {
    for (const archetype of ["guerra", "investigacion", "medica"] as const) {
      expect(CANONICAL_SHIP_FLOORPLANS[archetype].doors).toEqual([]);
    }
  });

  it("exploracion: la bodega de carga es la sección más grande de todas las naves", () => {
    const allSections = SHIP_ARCHETYPES.flatMap(
      (archetype) => CANONICAL_SHIP_FLOORPLANS[archetype].sections,
    );
    const largest = allSections.reduce((a, b) => (b.cells.length > a.cells.length ? b : a));
    expect(largest.id).toBe("bodega-carga");
    expect(largest.cells).toHaveLength(60);
  });
});
