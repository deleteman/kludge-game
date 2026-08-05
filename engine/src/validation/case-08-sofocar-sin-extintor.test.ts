// GDD 9, caso 8 — "Sofocar sin extintor / Trampa de chispa": combustión modulada por la concentración de O2 de la sección, en ambas direcciones (GDD 5.5).
import { describe, expect, it } from "vitest";
import {
  buildComponentCatalog,
  CombustionRule,
  createShipTaskEffect,
  createCrewTask,
  diffuse,
  EventEmitter,
  GAS,
  MissionReactionRuntime,
  MutableAtomicStock,
  MutableShipState,
  ReactionResolver,
  sectionCombustionAtmosphere,
  type Blueprint,
  type ChemicalSubstanceId,
  type ComponentId,
  type CrewActorId,
  type CrewTaskId,
  type GasKey,
  type PlacedComponentInstanceId,
  type ReactionContext,
  type ReactionDomainEvent,
  type SalvageDomainEvent,
  type ScriptedReactionSubject,
  type SectionId,
  type SectionRuntime,
  type ShipFloorplan,
  type TickContext,
} from "../index.js";

const sectionId = (raw: string): SectionId => raw as SectionId;
const tickOf = (elapsed: number, dt = 1): TickContext => ({
  dtSeconds: dt,
  elapsedSeconds: elapsed,
});

function section(id: string, volume: number, gases: Record<GasKey, number>): SectionRuntime {
  return {
    section: { id: sectionId(id), volume },
    atmosphere: { gases: new Map(Object.entries(gases)), temperatureCelsius: 21, pressureKpa: 101 },
  };
}

/** Catálogo real: `cable-cobre` debe resolverse para que el predicado lo lea como eléctrico. */
const REGISTRY = buildComponentCatalog().registry;

const fuel = { id: "fuel" as ChemicalSubstanceId, name: "fuel", tags: [{ name: "COMB" as const }] };
const rule = new CombustionRule();
const ctxFor = (runtime: SectionRuntime): ReactionContext => ({
  reactants: [fuel],
  oxygen: sectionCombustionAtmosphere(runtime.atmosphere),
  ignitionPresent: true,
  thermalRegulatorOverloaded: false,
  elapsedSeconds: 0,
});

describe("case 8 — Sofocar sin extintor / Trampa de chispa", () => {
  it("draining a burning room's O2 into a large sink extinguishes the fire by asphyxiation, not cooling", () => {
    const salaEnLlamas = section("sala-en-llamas", 5, { [GAS.OXYGEN]: 0.21 });
    const pasilloVenteo = section("pasillo-venteo", 500, { [GAS.OXYGEN]: 0 });
    const sections = new Map([salaEnLlamas, pasilloVenteo].map((r) => [r.section.id, r]));
    const connection = {
      a: salaEnLlamas.section.id,
      b: pasilloVenteo.section.id,
      valveAperture: 1,
    };

    // Con atmósfera normal el fuego arde con normalidad.
    expect(rule.appliesTo(ctxFor(salaEnLlamas))).toBe(true);
    expect(rule.apply(ctxFor(salaEnLlamas)).events[0]).toMatchObject({ intensity: "standard" });

    // El jugador aísla la ventilación y drena el O2 de la sala.
    for (let t = 0; t < 60; t++) diffuse(sections, [connection], tickOf(t));

    // Sin O2 suficiente, la combustión deja de ser posible: se apagó por
    // asfixia, no por enfriamiento — ninguna regla de temperatura intervino.
    expect(rule.appliesTo(ctxFor(salaEnLlamas))).toBe(false);
  });

  it("deliberately enriching an empty room with O2 turns a minimal spark into a violent ignition", () => {
    const salaVacia = section("sala-vacia", 5, { [GAS.OXYGEN]: 0.02 }); // casi sin O2
    const tanqueMedico = section("tanque-medico", 500, { [GAS.OXYGEN]: 1 }); // fuente rica en O2
    const sections = new Map([salaVacia, tanqueMedico].map((r) => [r.section.id, r]));
    const connection = { a: salaVacia.section.id, b: tanqueMedico.section.id, valveAperture: 1 };

    // Antes de enriquecer, la ignición es prácticamente imposible/débil.
    expect(rule.appliesTo(ctxFor(salaVacia))).toBe(false);

    // El jugador enriquece deliberadamente la sección con O2 del tanque médico.
    for (let t = 0; t < 30; t++) diffuse(sections, [connection], tickOf(t));

    // Un cable pelado (chispa mínima) ahora detona violentamente — misma
    // mecánica de atmósfera, usada como arma en vez de como herramienta de
    // contención (GDD 5.5).
    expect(sectionCombustionAtmosphere(salaVacia.atmosphere)).toBe("high");
    expect(rule.apply(ctxFor(salaVacia)).events[0]).toMatchObject({
      intensity: "violent",
      radius: "full-section",
      crewDamage: "high",
    });
  });

  /**
   * Subfase 13d — el doble filo, ya no simulado. Los dos tests de arriba
   * declaran `ignitionPresent: true` a mano: la "chispa del cable pelado" del
   * enunciado del GDD era literal en el fixture, porque hasta 13d nada en el
   * motor la producía. Ahora la chispa la genera el jugador al arrancar una
   * pieza VIVA (`dismantle-spark`), y `MissionReactionRuntime` la escucha como
   * fuente de ignición igual que ya escuchaba una sobrecarga.
   */
  it("13d: dismantling a live piece is the spark that detonates the O2-enriched room", () => {
    const SALA = sectionId("sala-cebada");
    const CONDUCTOR = "conductor-1" as PlacedComponentInstanceId;
    const floorplan: ShipFloorplan = {
      id: "fixture-floorplan",
      archetype: "exploracion",
      nameKey: "fixture",
      gridSize: { width: 1, height: 1 },
      sections: [{ id: SALA, nameKey: "fixture-section", cells: [{ x: 0, y: 0 }] }],
      conduits: [],
      anchors: [],
      componentSeeds: [],
    };
    const ship: Blueprint = {
      metadata: {
        schemaVersion: 5,
        id: "t",
        name: "t",
        engineVersion: "0.0.0",
        createdAt: "2026-08-05",
        updatedAt: "2026-08-05",
      },
      placedComponents: [
        {
          instanceId: CONDUCTOR,
          componentDefinitionId: "cable-cobre" as ComponentId,
          placement: { position: { x: 0, y: 0 }, footprint: { width: 1, height: 1 }, rotation: 0 },
          condition: "ok",
          wear: "nuevo",
        },
      ],
      reservoirContents: [],
      signalGraph: { nodes: [], edges: [] },
      sectionAtmospheres: [],
      unpoweredSectionIds: [],
      overloadedRefs: [],
      powerState: {
        sectionAllocations: [{ sectionId: SALA, units: 1 }],
        instancePriorities: [],
        permanentlyDisconnectedSectionIds: [],
        dischargedSourceIds: [],
      },
    };

    // Sala cebada con O2 (el paso que el test anterior ya validó) + combustible.
    const enrichedAtmosphere = section("sala-cebada", 5, { [GAS.OXYGEN]: 0.9 }).atmosphere;
    const scripted: ScriptedReactionSubject[] = [
      { id: "vapores", sectionId: SALA, reactants: [fuel], ignitionTrigger: "overload-bridge" },
    ];

    const shipState = new MutableShipState(ship);
    const salvageEvents = new EventEmitter<SalvageDomainEvent>();
    const reactionEvents = new EventEmitter<ReactionDomainEvent>();
    const seen: ReactionDomainEvent[] = [];
    reactionEvents.onAny((event) => seen.push(event));

    const reactionRuntime = new MissionReactionRuntime(
      shipState,
      floorplan,
      scripted,
      new ReactionResolver(),
      () => enrichedAtmosphere,
      reactionEvents,
      undefined,
      salvageEvents,
    );

    const effect = createShipTaskEffect(
      shipState,
      REGISTRY,
      new MutableAtomicStock({}),
      floorplan,
      {},
      {
        // El conductor está vivo porque su sección tiene energía otorgada — el
        // mismo criterio que usa la misión real (`instance-energized.ts`).
        sectionHasGrantedPower: () => true,
        atmosphereOf: () => enrichedAtmosphere,
        elapsedSecondsOf: () => 0,
        handler: { emitter: salvageEvents },
      },
    );

    // Sin chispa todavía: la sala está cebada pero nada la enciende.
    reactionRuntime.tick(tickOf(0));
    expect(seen).toHaveLength(0);

    // El jugador arranca el conductor energizado a propósito.
    effect(
      createCrewTask({
        id: "t1" as CrewTaskId,
        actorId: "crew-1" as CrewActorId,
        type: "dismantle",
        payload: { kind: "dismantle", instanceId: CONDUCTOR },
      }),
    );
    reactionRuntime.tick(tickOf(1));

    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({
      kind: "combustion",
      sectionId: SALA,
      intensity: "violent",
      radius: "full-section",
    });
  });
});
