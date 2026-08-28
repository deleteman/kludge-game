/**
 * Integración de la Subfase 13e: el ciclo de vida COMPLETO de una sustancia,
 * combinando varias reglas a la vez tal como ocurre en una crisis real
 * (CLAUDE.md: dos niveles de test, unitario por regla + integración).
 *
 *   reservorio sembrado → analizar → EXTRAER elementos → SINTETIZAR
 *   → depositar en la estación → TRASVASAR → APLICAR sobre la atmósfera
 *
 * Antes de 13e cada eslabón existía por separado y ninguno se tocaba con el
 * siguiente: la síntesis producía un id flotante, los reservorios solo se
 * vaciaban, y nada escribía jamás una sustancia en `atmosphere.gases`.
 */

import { describe, expect, it } from "vitest";
import { createShipTaskEffect } from "./ship-task-effect.js";
import { MutableShipState } from "./mutable-ship-state.js";
import { MutableAtomicStock } from "../inventory/mutable-atomic-stock.js";
import { MutableElementStock } from "../inventory/mutable-element-stock.js";
import { TransientGasInjection } from "./section-gas-injection.js";
import { MissionAtmosphereRuntime } from "./mission-atmosphere-runtime.js";
import { buildComponentCatalog } from "../components/catalog/build-component-catalog.js";
import { buildChemicalCatalog } from "../chemistry/catalog/build-chemical-catalog.js";
import { synthesizeSubstance } from "../chemistry/production/synthesize-substance.js";
import { ReactionResolver } from "../chemistry/reaction/reaction-resolver.js";
import { consumeElements } from "../inventory/element-ledger.js";
import { pourInto } from "../reservoir/reservoir-ledger.js";
import { createCrewTask } from "../tasks/task-factory.js";
import { FluidTransferUnreachableError } from "../reservoir/fluid-transfer-reachability.js";
import type { Blueprint, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { ChemicalSubstanceId } from "../chemistry/chemical-substance.types.js";
import type { ComponentId } from "../components/physical-component.types.js";
import type { CrewActorId } from "../crew/crew-actor.types.js";
import type { CrewTaskId, TaskType } from "../tasks/task.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import type { ConduitKind, ShipFloorplan } from "../floorplan/floorplan.types.js";
import type { TickContext } from "../simulation/simulation-clock.types.js";

const ACTOR = "actor-a" as CrewActorId;
const BODEGA = "bodega" as SectionId;
const LABORATORIO = "laboratorio" as SectionId;

const DEPOSITO = "deposito-agua" as PlacedComponentInstanceId;
const ESTACION = "estacion" as PlacedComponentInstanceId;

const AGUA = "agua" as ChemicalSubstanceId;
const HIDROGENO = "hidrogeno" as ChemicalSubstanceId;
const OXIGENO = "oxigeno" as ChemicalSubstanceId;

const { registry: componentRegistry } = buildComponentCatalog();
const { registry: chemicalRegistry, factory: chemicalFactory, namedRecipeIndex } =
  buildChemicalCatalog();

const tick = (dt = 1): TickContext => ({ dtSeconds: dt, elapsedSeconds: dt });

/**
 * `deposito-agua` en `bodega`, `estacion-quimica` en `laboratorio`. El conducto
 * `fluido` entre ambas se inyecta por test: es exactamente lo que decide si el
 * trasvase cross-section está permitido.
 */
function floorplan(conduitKinds: ReadonlyArray<ConduitKind> = []): ShipFloorplan {
  return {
    id: "nave-13e",
    archetype: "exploracion",
    nameKey: "ship.fixture",
    gridSize: { width: 8, height: 2 },
    sections: [
      {
        id: BODEGA,
        nameKey: "section.bodega",
        cells: [0, 1, 2, 3].flatMap((x) => [{ x, y: 0 }, { x, y: 1 }]),
      },
      {
        id: LABORATORIO,
        nameKey: "section.laboratorio",
        cells: [4, 5, 6, 7].flatMap((x) => [{ x, y: 0 }, { x, y: 1 }]),
      },
    ],
    conduits: conduitKinds.map((kind, index) => ({
      id: `conduit-${index}`,
      kind,
      a: BODEGA,
      b: LABORATORIO,
      initialAperture: 1,
      position: { x: 3, y: 0 },
    })) as unknown as ShipFloorplan["conduits"],
    anchors: [],
    componentSeeds: [],
    doors: [],
  };
}

function ship(): Blueprint {
  const place = (
    instanceId: PlacedComponentInstanceId,
    componentDefinitionId: string,
    x: number,
  ) => ({
    instanceId,
    componentDefinitionId: componentDefinitionId as ComponentId,
    placement: { position: { x, y: 0 }, footprint: { width: 2, height: 2 }, rotation: 0 as const },
    condition: "ok" as const,
    wear: "nuevo" as const,
  });
  return {
    metadata: {
      schemaVersion: 8,
      id: "fixture-13e",
      name: "Fixture 13e",
      engineVersion: "0.0.0",
      createdAt: "2026-08-06T00:00:00.000Z",
      updatedAt: "2026-08-06T00:00:00.000Z",
    },
    placedComponents: [
      place(DEPOSITO, "reservorio-agua-reciclada", 0),
      place(ESTACION, "estacion-quimica", 4),
    ],
    // El depósito sembrado con agua es la ÚNICA fuente de materia prima:
    // el capítulo arranca con `elementStock` vacío a propósito.
    reservoirContents: [{ componentInstanceId: DEPOSITO, substanceId: AGUA, amount: 10 }],
    signalGraph: { nodes: [], edges: [] },
    sectionAtmospheres: [],
    sectionIntegrity: [],
    unpoweredSectionIds: [],
    doorStates: [],
    valveApertures: [],
    overloadedRefs: [],
    powerState: {
      sectionAllocations: [],
      instancePriorities: [],
      permanentlyDisconnectedSectionIds: [],
      dischargedSourceIds: [],
    },
  } as unknown as Blueprint;
}

interface Harness {
  readonly shipState: MutableShipState;
  readonly elementStock: MutableElementStock;
  readonly gasInjection: TransientGasInjection;
  readonly atmosphere: MissionAtmosphereRuntime;
  run(type: TaskType, payload: unknown): ReturnType<ReturnType<typeof createShipTaskEffect>>;
}

function harness(
  conduitKinds: ReadonlyArray<ConduitKind> = [],
  analyzedSubstanceIds: ChemicalSubstanceId[] = [AGUA],
): Harness {
  const plan = floorplan(conduitKinds);
  const shipState = new MutableShipState(ship());
  const elementStock = new MutableElementStock({});
  const gasInjection = new TransientGasInjection();
  const atmosphere = new MissionAtmosphereRuntime(
    plan,
    [],
    undefined,
    gasInjection.asInjectionSource(),
  );
  const effect = createShipTaskEffect(
    shipState,
    componentRegistry,
    new MutableAtomicStock({}),
    plan,
    {},
    {},
    {
      elementStock,
      gasInjection,
      composition: () => ({ registry: chemicalRegistry, provenance: {}, analyzedSubstanceIds }),
    },
  );
  let taskCounter = 0;
  return {
    shipState,
    elementStock,
    gasInjection,
    atmosphere,
    run: (type, payload) => {
      taskCounter += 1;
      return effect(
        createCrewTask({
          id: `t${taskCounter}` as CrewTaskId,
          actorId: ACTOR,
          type,
          payload: payload as never,
        }),
      );
    },
  };
}

describe("ciclo de vida de una sustancia (13e)", () => {
  it("extraer → sintetizar → depositar → trasvasar → aplicar", () => {
    const h = harness(["fluido"]);

    // 1. EXTRAER: el depósito sembrado es la única materia prima disponible.
    expect(h.elementStock.get()).toEqual({});
    h.run("extract-elements", { kind: "extract-elements", instanceId: DEPOSITO, amount: 4 });
    expect(h.elementStock.get()).toEqual({ [HIDROGENO]: 8, [OXIGENO]: 4 });

    // 2. SINTETIZAR: consume del inventario (ya no es gratis) y resuelve la
    //    identidad con el motor químico real.
    const seleccion = [HIDROGENO, HIDROGENO, OXIGENO];
    const remaining = consumeElements(h.elementStock.get(), seleccion);
    expect(remaining).not.toBeNull();
    h.elementStock.set(remaining!);
    expect(h.elementStock.get()).toEqual({ [HIDROGENO]: 6, [OXIGENO]: 3 });

    const outcome = synthesizeSubstance(
      new ReactionResolver({ namedRecipeIndex }),
      chemicalRegistry,
      chemicalFactory,
      seleccion,
    );
    // 2 H + 1 O es la receta nombrada del agua: la resolución de identidad de
    // 3 pasos (GDD 5.3) la reconoce en el paso 1.
    expect(outcome.result?.id).toBe(AGUA);
    const sintetizada = outcome.result!.id;

    // 3. DEPOSITAR en el reservorio de la estación — la sustancia deja de ser
    //    un id flotante y gana ubicación en el plano.
    const beforePour = h.shipState.get();
    const poured = pourInto(
      beforePour.reservoirContents,
      ESTACION,
      sintetizada,
      6,
      50, // capacity de `estacion-quimica`
    );
    h.shipState.set({ ...beforePour, reservoirContents: poured.contents });
    expect(
      h.shipState.get().reservoirContents.find((e) => e.componentInstanceId === ESTACION)?.amount,
    ).toBe(6);

    // 4. TRASVASAR de la estación (laboratorio) al depósito (bodega): cruza de
    //    sección, así que solo funciona por el conducto `fluido`.
    h.run("transfer-substance", {
      kind: "transfer-substance",
      fromInstanceId: ESTACION,
      toInstanceId: DEPOSITO,
      amount: 3,
    });
    const afterTransfer = h.shipState.get().reservoirContents;
    expect(afterTransfer.find((e) => e.componentInstanceId === ESTACION)?.amount).toBe(3);

    // 5. APLICAR sobre la atmósfera: el escritor que faltaba en todo el motor.
    expect(h.atmosphere.atmosphereOf(LABORATORIO)?.gases.get(sintetizada)).toBeUndefined();
    h.run("apply-substance", {
      kind: "apply-substance",
      fromInstanceId: ESTACION,
      sectionId: LABORATORIO,
      amount: 3,
    });
    h.atmosphere.tick(tick());
    expect(h.atmosphere.atmosphereOf(LABORATORIO)?.gases.get(sintetizada)).toBeGreaterThan(
      0,
    );
    // La estación quedó vacía: el material se gastó de verdad.
    expect(
      h.shipState.get().reservoirContents.find((e) => e.componentInstanceId === ESTACION),
    ).toBeUndefined();
  });

  it("sin conducto `fluido` el trasvase cross-section se bloquea", () => {
    const h = harness([]);
    expect(() =>
      h.run("transfer-substance", {
        kind: "transfer-substance",
        fromInstanceId: DEPOSITO,
        toInstanceId: ESTACION,
        amount: 5,
      }),
    ).toThrow(FluidTransferUnreachableError);
  });

  it("sin analizar el depósito no hay materia prima: el ciclo no arranca", () => {
    const h = harness(["fluido"], []);
    expect(() =>
      h.run("extract-elements", { kind: "extract-elements", instanceId: DEPOSITO, amount: 4 }),
    ).toThrow();
    expect(h.elementStock.get()).toEqual({});
  });

  it("la sustancia aplicada difunde a la sección vecina por el conducto de ventilación", () => {
    // Verter algo tóxico en una sección no lo deja quieto ahí: es la base de
    // que una fuga escale, y de que un neutralizante alcance lo que hay al lado.
    const h = harness(["ventilacion"]);
    h.run("apply-substance", {
      kind: "apply-substance",
      fromInstanceId: DEPOSITO,
      sectionId: BODEGA,
      amount: 10,
    });
    for (let i = 0; i < 30; i += 1) {
      h.atmosphere.tick(tick());
    }
    expect(h.atmosphere.atmosphereOf(LABORATORIO)?.gases.get(AGUA) ?? 0).toBeGreaterThan(0);
  });
});
