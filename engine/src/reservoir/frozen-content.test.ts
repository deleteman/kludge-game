import { describe, expect, it } from "vitest";
import { frozenContentOf, isSubstanceFrozenAt } from "./frozen-content.js";
import { createShipTaskEffect, FrozenReservoirContentError } from "../mission/ship-task-effect.js";
import { MutableShipState } from "../mission/mutable-ship-state.js";
import { MutableAtomicStock } from "../inventory/mutable-atomic-stock.js";
import { buildComponentCatalog } from "../components/catalog/build-component-catalog.js";
import { buildChemicalCatalog } from "../chemistry/catalog/build-chemical-catalog.js";
import { createCrewTask } from "../tasks/task-factory.js";
import type { Blueprint, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { ComponentId } from "../components/physical-component.types.js";
import type { ChemicalSubstanceId } from "../chemistry/chemical-substance.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import type { ShipFloorplan } from "../floorplan/floorplan.types.js";
import type { CrewActorId } from "../crew/crew-actor.types.js";
import type { CrewTaskId } from "../tasks/task.types.js";

/**
 * Subfase 14a-3: "líquido → sólido detiene flujo" (GDD §5.6).
 *
 * Los dos niveles del mismo hecho: el predicado puro, y que la TAREA lo respete.
 * El segundo es el que importa — el bloqueo vive en el borde entre el ledger y
 * el efecto de tarea, y ese pegamento es donde no había ningún test.
 */

const SALA = "sala" as SectionId;
const TANQUE = "tanque-1" as PlacedComponentInstanceId;
const ACTOR = "crew-1" as CrewActorId;
const AGUA = "agua" as ChemicalSubstanceId;

const REGISTRY = buildComponentCatalog().registry;
const CHEMICALS = buildChemicalCatalog().registry;
const substanceOf = (id: ChemicalSubstanceId) => CHEMICALS.get(id);

const floorplan: ShipFloorplan = {
  id: "nave-14a3",
  archetype: "investigacion",
  nameKey: "ship.test.name",
  gridSize: { width: 4, height: 1 },
  sections: [{ id: SALA, nameKey: "section.sala", cells: [0, 1, 2, 3].map((x) => ({ x, y: 0 })) }],
  conduits: [],
  anchors: [],
  componentSeeds: [],
  doors: [],
};

function ship(): Blueprint {
  return {
    metadata: {
      schemaVersion: 5,
      id: "fixture",
      name: "Fixture",
      engineVersion: "0.0.0",
      createdAt: "2026-09-03T00:00:00.000Z",
      updatedAt: "2026-09-03T00:00:00.000Z",
    },
    placedComponents: [
      {
        instanceId: TANQUE,
        componentDefinitionId: "tanque-muestra-criogenica" as ComponentId,
        placement: { position: { x: 1, y: 0 }, footprint: { width: 1, height: 1 }, rotation: 0 },
        condition: "ok",
        wear: "nuevo",
      },
    ],
    reservoirContents: [{ componentInstanceId: TANQUE, substanceId: AGUA, amount: 10 }],
    signalGraph: { nodes: [], edges: [] },
    sectionAtmospheres: [],
    sectionIntegrity: [],
    unpoweredSectionIds: [],
    doorStates: [],
    valveApertures: [],
    instanceConfigs: [],
    overloadedRefs: [],
    powerState: {
      sectionAllocations: [],
      instancePriorities: [],
      permanentlyDisconnectedSectionIds: [],
      dischargedSourceIds: [],
    },
  };
}

describe("isSubstanceFrozenAt", () => {
  it("es fail-open sin dato: no se puede afirmar que está congelado", () => {
    // Bloquear una acción por falta de información es peor que dejarla pasar —
    // mismo criterio que el resto del motor ante un mundo incompleto.
    expect(isSubstanceFrozenAt(undefined, -40)).toBe(false);
    expect(isSubstanceFrozenAt(substanceOf(AGUA), undefined)).toBe(false);
  });
});

describe("frozenContentOf", () => {
  const deps = (temperatureCelsius: number) => ({
    substanceOf,
    sectionTemperatureOf: () => temperatureCelsius,
  });

  it("devuelve los DOS números que el jugador necesita para destrabarlo", () => {
    const info = frozenContentOf(ship(), floorplan, TANQUE, deps(-12));
    expect(info).toMatchObject({
      substanceId: AGUA,
      sectionId: SALA,
      temperatureCelsius: -12,
      meltingPointCelsius: 0,
    });
  });

  it("una sala templada no congela nada, y un reservorio vacío tampoco", () => {
    expect(frozenContentOf(ship(), floorplan, TANQUE, deps(21))).toBeUndefined();
    const vacio = { ...ship(), reservoirContents: [] };
    expect(frozenContentOf(vacio, floorplan, TANQUE, deps(-40))).toBeUndefined();
  });
});

describe("las tareas que mueven sustancia rechazan un contenido congelado", () => {
  const buildEffect = (temperatureCelsius: number) => {
    const shipState = new MutableShipState(ship());
    const effect = createShipTaskEffect(
      shipState,
      REGISTRY,
      new MutableAtomicStock({}),
      floorplan,
      {},
      {},
      { substanceOf, sectionTemperatureOf: () => temperatureCelsius },
    );
    return { shipState, effect };
  };

  const pour = (n: number) =>
    createCrewTask({
      id: `t${n}` as CrewTaskId,
      actorId: ACTOR,
      type: "apply-substance",
      payload: {
        kind: "apply-substance",
        fromInstanceId: TANQUE,
        sectionId: SALA,
        amount: 5,
      },
    });

  it("verter con el contenido sólido lanza el error PROPIO y no toca el ledger", () => {
    // Error propio y no un `return` mudo: el scheduler lo convierte en tarea
    // `failed` con aviso (14a-4), que es lo que distingue "no te dejo" de "no
    // pasó nada". Y no recicla "reservorio vacío": cada motivo manda al jugador
    // a hacer algo distinto.
    const { shipState, effect } = buildEffect(-12);
    expect(() => effect(pour(1))).toThrow(FrozenReservoirContentError);
    expect(shipState.get().reservoirContents[0]!.amount).toBe(10);
  });

  it("el mensaje trae la temperatura actual y el punto de fusión", () => {
    const { effect } = buildEffect(-12);
    try {
      effect(pour(2));
      expect.unreachable("debería haber lanzado");
    } catch (error) {
      expect((error as Error).message).toContain("-12.0 °C");
      expect((error as Error).message).toContain("0 °C");
    }
  });

  it("con la sala templada la tarea se ejecuta con normalidad", () => {
    const { shipState, effect } = buildEffect(21);
    effect(pour(3));
    expect(shipState.get().reservoirContents[0]!.amount).toBe(5);
  });

  it("sin las deps cableadas el efecto se comporta como antes de 14a-3", () => {
    // Fail-open: los tests unitarios previos y cualquier llamador que no pase
    // catálogo ni temperatura siguen valiendo.
    const shipState = new MutableShipState(ship());
    const effect = createShipTaskEffect(shipState, REGISTRY, new MutableAtomicStock({}), floorplan);
    expect(() => effect(pour(4))).not.toThrow();
  });
});
