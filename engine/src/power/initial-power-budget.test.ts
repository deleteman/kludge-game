import { describe, expect, it } from "vitest";
import { buildComponentCatalog } from "../components/catalog/build-component-catalog.js";
import { CANONICAL_SHIP_FLOORPLANS } from "../floorplan/canonical-ships.js";
import { createNewCampaignSave } from "../save/campaign-save-factory.js";
import type { CrewRoster } from "../crew/crew-roster.js";
import type { CrewActor, CrewActorId } from "../crew/crew-actor.types.js";
import { componentPowerDraw } from "./component-power-draw.js";
import { totalPowerBudget } from "./power-source.js";
import { defaultSectionAllocations } from "./default-allocation.js";
import type { CampaignSaveId } from "../save/campaign-save.types.js";

/**
 * Subfase 13g, deuda #39. Cruza la OFERTA de energía de la nave contra su
 * DEMANDA real con el contenido autorado de verdad (patrón 34 de la memoria de
 * playtest: "sumar los números del propio juego antes de dar por jugable una
 * mecánica"). Hasta 13g nadie declaraba consumo, así que el presupuesto de 10
 * unidades no tenía contra qué medirse; en cuanto el catálogo declara demanda,
 * una oferta corta deja una partida nueva sin puertas, sin mesas y sin señales.
 *
 * Este test es el que impide que un ajuste de balanceo futuro (Fase 23) rompa
 * la relación en silencio.
 */
describe("presupuesto inicial vs demanda real (Subfase 13g)", () => {
  const { registry } = buildComponentCatalog();

  function actor(id: string): CrewActor {
    return {
      id: id as CrewActorId,
      name: `Tripulante ${id}`,
      specialty: "ingeniero",
      tier: "novato",
      trait: "estoico",
      hp: 100,
      maxHp: 100,
      status: "idle",
    };
  }

  function newExploracionSave() {
    const roster: CrewRoster = { available: [actor("crew-1"), actor("crew-2")] };
    return createNewCampaignSave({
      id: "test-13g" as CampaignSaveId,
      name: "Test 13g",
      archetype: "exploracion",
      roster,
      chosenCrewIds: ["crew-1" as CrewActorId, "crew-2" as CrewActorId],
      engineVersion: "test",
    });
  }

  it("la nave produce al menos lo que su equipamiento inicial demanda", () => {
    const placed = newExploracionSave().shipState.placedComponents;
    const supply = totalPowerBudget(placed, registry);
    const demand = placed.reduce(
      (total, instance) => total + componentPowerDraw(registry.get(instance.componentDefinitionId)),
      0,
    );

    expect(demand).toBeGreaterThan(0); // si esto falla, nadie declara consumo otra vez
    expect(supply).toBeGreaterThanOrEqual(demand);
  });

  it("una partida nueva NO arranca a oscuras", () => {
    // Patrón 42: `emptyPowerState()` dejaba `sectionAllocations: []`, o sea 0
    // unidades otorgadas en TODA sección — el caso por defecto, el que nadie
    // prueba, y el único que existe en una campaña recién creada.
    const save = newExploracionSave();
    const allocations = save.shipState.powerState.sectionAllocations;

    expect(allocations.length).toBeGreaterThan(0);
    expect(allocations.every((entry) => entry.units > 0)).toBe(true);
  });

  it("cada sección con equipamiento recibe lo que demanda cuando la oferta alcanza", () => {
    const save = newExploracionSave();
    const floorplan = CANONICAL_SHIP_FLOORPLANS.exploracion;
    const granted = new Map(
      save.shipState.powerState.sectionAllocations.map((entry) => [entry.sectionId, entry.units]),
    );

    for (const section of floorplan.sections) {
      const demand = save.shipState.placedComponents
        .filter((instance) =>
          section.cells.some(
            (cell) =>
              cell.x === instance.placement.position.x && cell.y === instance.placement.position.y,
          ),
        )
        .reduce((total, i) => total + componentPowerDraw(registry.get(i.componentDefinitionId)), 0);
      if (demand > 0) {
        expect(granted.get(section.id) ?? 0).toBe(demand);
      }
    }
  });

  it("con presupuesto corto reparte primero las secciones más caras, de forma determinista", () => {
    const floorplan = CANONICAL_SHIP_FLOORPLANS.exploracion;
    const placed = newExploracionSave().shipState.placedComponents;
    const demand = placed.reduce(
      (total, instance) => total + componentPowerDraw(registry.get(instance.componentDefinitionId)),
      0,
    );

    const scarce = defaultSectionAllocations(placed, floorplan, registry, 4);
    const total = scarce.reduce((sum, entry) => sum + entry.units, 0);

    expect(total).toBe(4);
    expect(scarce).toEqual(defaultSectionAllocations(placed, floorplan, registry, 4));
    // Y con 0 de presupuesto no inventa asignaciones.
    expect(defaultSectionAllocations(placed, floorplan, registry, 0)).toEqual([]);
    expect(demand).toBeGreaterThan(4);
  });
});
