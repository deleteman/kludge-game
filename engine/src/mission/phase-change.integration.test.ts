import { describe, expect, it } from "vitest";
import { MissionThermalRuntime } from "./mission-thermal-runtime.js";
import { MissionAtmosphereRuntime } from "./mission-atmosphere-runtime.js";
import { MissionReactionRuntime } from "./mission-reaction-runtime.js";
import { MissionPhaseRuntime } from "./mission-phase-runtime.js";
import { PhaseExpansionPressureSource } from "./phase-expansion-pressure.js";
import { TransientGasInjection } from "./section-gas-injection.js";
import { MutableShipState } from "./mutable-ship-state.js";
import { EventEmitter } from "../simulation/event-emitter.js";
import { ReactionResolver } from "../chemistry/reaction/reaction-resolver.js";
import { buildComponentCatalog } from "../components/catalog/build-component-catalog.js";
import { buildChemicalCatalog } from "../chemistry/catalog/build-chemical-catalog.js";
import { sectionsWithThermalRegulator } from "./thermal-regulators.js";
import { sectionArea } from "../floorplan/floorplan.types.js";
import { AUTOIGNITION_CELSIUS } from "../atmosphere/thermal-parameters.js";
import { REACTANT_PRESENCE_FLOOR } from "./section-reactants.js";
import { PRESSURE_SINK_FLOOR_KPA, PRESSURE_RECOVERY_CEILING_KPA } from "./mission-atmosphere-runtime.js";
import type { ReactionDomainEvent } from "../chemistry/reaction/reaction-events.types.js";
import type { FailureDomainEvent } from "../failure/failure-events.types.js";
import type { SalvageDomainEvent } from "../salvage/salvage-hazard.types.js";
import type { PhaseDomainEvent } from "../chemistry/phase/phase-events.types.js";
import type { Blueprint, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { ComponentId } from "../components/physical-component.types.js";
import type { ChemicalSubstanceId } from "../chemistry/chemical-substance.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import type { ConduitId, ShipFloorplan } from "../floorplan/floorplan.types.js";

/**
 * Integración de la Subfase 14a-3, recorriendo la cadena ENTERA con la pila
 * real: derramar → evaporar → entrar a la atmósfera → arder por una chispa →
 * calentar la sala vecina → que la vecina encienda sola → agotar el combustible
 * → apagarse.
 *
 * Es el test que valida los NÚMEROS, no solo que el código se ejecute. Tres
 * umbrales dependen de que esta simulación ocurra de verdad:
 * `AUTOIGNITION_CELSIUS` (si la vecina no lo cruza, la propagación es un
 * escritor muerto), el consumo de reactivos (sin él la cascada no termina) y la
 * expansión de presión (que tiene que parar en el techo).
 *
 * Nada de dobles en los bordes: la temperatura sale de `MissionAtmosphereRuntime`
 * y los reactivos del aire que la inyección escribe (patrón 43/50).
 */

const SALA = "sala" as SectionId;
const VECINA = "vecina" as SectionId;
const TANQUE = "tanque-1" as PlacedComponentInstanceId;

const REGISTRY = buildComponentCatalog().registry;
const CHEMICALS = buildChemicalCatalog().registry;
const COMBUSTIBLE = "combustible-de-motor" as ChemicalSubstanceId;
/**
 * Unidades vertidas en cada prueba. **El número importa**: la inyección aporta
 * `amount * 0.2 / volumen` de fracción y DESPLAZA proporcionalmente al resto de
 * los gases, así que con 20 unidades en una sala de 4 celdas la fracción da 1.0
 * y el vapor se come todo el oxígeno — la combustión se vuelve imposible por la
 * fila "0 %" de la tabla del GDD 5.5.
 *
 * (Eso es correcto y es una herramienta real: inundar una sala de gas inerte
 * apaga un fuego. Pero acá lo que se prueba es la cadena de ignición, así que la
 * dosis tiene que dejar oxígeno vivo.) Con 3 unidades la fracción queda en 0.15,
 * bien por encima de `REACTANT_PRESENCE_FLOOR` y sin asfixiar la sala.
 */
const VAPOR_UNITS = 3;

const tickOf = (elapsed: number, dt = 1) => ({ dtSeconds: dt, elapsedSeconds: elapsed });

function floorplan(): ShipFloorplan {
  return {
    id: "nave-14a3",
    archetype: "investigacion",
    nameKey: "ship.test.name",
    gridSize: { width: 8, height: 1 },
    sections: [
      { id: SALA, nameKey: "section.sala", cells: [0, 1, 2, 3].map((x) => ({ x, y: 0 })) },
      { id: VECINA, nameKey: "section.vecina", cells: [4, 5, 6, 7].map((x) => ({ x, y: 0 })) },
    ],
    // Un conducto de ventilación abierto: es lo que hace que el calor conduzca
    // entre las dos salas, exactamente como en el mapa real.
    conduits: [
      {
        id: "sala-vecina-ventilacion" as ConduitId,
        a: SALA,
        b: VECINA,
        kind: "ventilacion",
        position: { x: 3.5, y: 0 },
        initialAperture: 1,
      },
    ],
    anchors: [],
    componentSeeds: [],
    doors: [],
  };
}

function blueprint(): Blueprint {
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
    reservoirContents: [
      { componentInstanceId: TANQUE, substanceId: COMBUSTIBLE, amount: 20 },
    ],
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

/** Monta la pila en el mismo orden en que la registra el core loop real. */
function buildScene() {
  const plan = floorplan();
  const shipState = new MutableShipState(blueprint());
  const reactionEvents = new EventEmitter<ReactionDomainEvent>();
  const failureEvents = new EventEmitter<FailureDomainEvent>();
  const salvageEvents = new EventEmitter<SalvageDomainEvent>();
  const phaseEvents = new EventEmitter<PhaseDomainEvent>();
  const reactions: ReactionDomainEvent[] = [];
  const phases: PhaseDomainEvent[] = [];
  reactionEvents.onAny((event) => reactions.push(event));
  phaseEvents.onAny((event) => phases.push(event));

  const thermal = new MissionThermalRuntime(reactionEvents, failureEvents);
  const expansion = new PhaseExpansionPressureSource();
  let now = 0;
  const gasInjection = new TransientGasInjection({
    substanceOf: (substanceId) => CHEMICALS.get(substanceId),
    sectionVolumeOf: (sectionId) => {
      const section = plan.sections.find((entry) => entry.id === sectionId);
      return section && sectionArea(section);
    },
    onSpill: (sectionId, substanceId, amount) =>
      thermal.applySubstanceSpill(sectionId, substanceId, amount),
    sectionTemperatureOf: (sectionId): number | undefined =>
      atmosphere.atmosphereOf(sectionId)?.temperatureCelsius,
    onEvaporate: (sectionId, substanceId, amount) => {
      expansion.register(sectionId, amount, now);
      phaseEvents.emit({
        kind: "substance-phase-change",
        sectionId,
        substanceId,
        transition: "boil",
        amount,
        elapsedSeconds: now,
      });
    },
  });
  const atmosphere = new MissionAtmosphereRuntime(
    plan,
    [],
    expansion.asSinkSource(),
    gasInjection.asInjectionSource(),
    undefined,
    undefined,
    () => thermal.rates(),
  );
  const reactionRuntime = new MissionReactionRuntime(
    shipState,
    plan,
    [],
    new ReactionResolver(),
    (sectionId) => atmosphere.atmosphereOf(sectionId),
    reactionEvents,
    failureEvents,
    salvageEvents,
    (substanceId) => CHEMICALS.get(substanceId),
    () => sectionsWithThermalRegulator(shipState.get(), { registry: REGISTRY, floorplan: plan }),
  );
  const phaseRuntime = new MissionPhaseRuntime({
    shipState,
    shipFloorplan: plan,
    sectionTemperatureOf: (sectionId): number | undefined =>
      atmosphere.atmosphereOf(sectionId)?.temperatureCelsius,
    substanceOf: (substanceId) => CHEMICALS.get(substanceId),
    emitter: phaseEvents,
  });

  const tick = (elapsed: number, dt = 1) => {
    now = elapsed;
    expansion.advanceTo(elapsed);
    thermal.tick(tickOf(elapsed, dt));
    atmosphere.tick(tickOf(elapsed, dt));
    reactionRuntime.tick(tickOf(elapsed, dt));
    phaseRuntime.tick(tickOf(elapsed, dt));
  };
  return {
    plan,
    shipState,
    gasInjection,
    salvageEvents,
    reactions,
    phases,
    atmosphere,
    tick,
    setNow: (elapsed: number) => {
      now = elapsed;
    },
    temperature: (sectionId: SectionId) => atmosphere.atmosphereOf(sectionId)!.temperatureCelsius,
    fuelFraction: (sectionId: SectionId) =>
      atmosphere.atmosphereOf(sectionId)!.gases.get(COMBUSTIBLE) ?? 0,
  };
}

/** Chispazo real por el mismo bus que emite el desmontaje de una pieza viva. */
function spark(scene: ReturnType<typeof buildScene>, sectionId: SectionId, elapsed: number): void {
  scene.salvageEvents.emit({
    kind: "dismantle-spark",
    instanceId: "cualquiera" as PlacedComponentInstanceId,
    position: { x: 0, y: 0 },
    sectionId,
    elapsedSeconds: elapsed,
  });
}

describe("integración 14a-3: derrame → evaporación → ignición → propagación → agotamiento", () => {
  it("un charco de combustible NO arde hasta que la sala lo evapora", () => {
    const scene = buildScene();
    scene.tick(0);

    // A 21 °C el combustible es líquido (funde a -60, hierve a 95): queda como
    // charco en el piso y NO entra a la atmósfera. Es el estado del que partía
    // el motor antes de 14a-3, y sigue siendo correcto.
    scene.gasInjection.inject(SALA, COMBUSTIBLE, VAPOR_UNITS);
    scene.tick(1);
    expect(scene.fuelFraction(SALA)).toBe(0);

    // Con la sala por encima del punto de ebullición, el MISMO derrame entra al
    // aire y pasa a ser reactivo — sin tocar ninguna regla de reacción.
    scene.atmosphere.atmosphereOf(SALA)!.temperatureCelsius = 80;
    scene.setNow(2);
    scene.gasInjection.inject(SALA, COMBUSTIBLE, VAPOR_UNITS);
    scene.tick(2);
    expect(scene.fuelFraction(SALA)).toBeGreaterThan(REACTANT_PRESENCE_FLOOR);
    expect(scene.phases.filter((event) => event.kind === "substance-phase-change")).toHaveLength(1);
  });

  it("evaporar en una sala baja la represuriza, y se DETIENE en el estándar", () => {
    const scene = buildScene();
    scene.tick(0);
    // Sala que quedó baja tras sellar una brecha: es el caso que le da valor
    // jugable a la expansión (sin él sería un escritor muerto contra el techo).
    scene.atmosphere.atmosphereOf(SALA)!.pressureKpa = PRESSURE_SINK_FLOOR_KPA;
    scene.atmosphere.atmosphereOf(SALA)!.temperatureCelsius = 80;

    scene.setNow(1);
    scene.gasInjection.inject(SALA, COMBUSTIBLE, VAPOR_UNITS);
    let peak = 0;
    for (let i = 1; i < 12; i += 1) {
      scene.tick(i);
      peak = Math.max(peak, scene.atmosphere.atmosphereOf(SALA)!.pressureKpa);
    }
    expect(peak).toBeGreaterThan(PRESSURE_SINK_FLOOR_KPA);
    // Decisión de la subfase: no hay sobrepresión. El clamp del runtime es el
    // que la corta, y este aserto es lo que impide que un cambio futuro la
    // abra sin querer.
    expect(peak).toBeLessThanOrEqual(PRESSURE_RECOVERY_CEILING_KPA);
  });

  it("la chispa enciende el vapor, el calor cruza a la vecina y la vecina enciende SOLA", () => {
    const scene = buildScene();
    scene.tick(0);

    // Combustible evaporado en las DOS salas: el jugador derramó en la suya y
    // en la de al lado, pero solo desmonta una pieza viva en la primera.
    for (const sectionId of [SALA, VECINA]) {
      scene.atmosphere.atmosphereOf(sectionId)!.temperatureCelsius = 80;
    }
    scene.setNow(1);
    scene.gasInjection.inject(SALA, COMBUSTIBLE, VAPOR_UNITS);
    scene.gasInjection.inject(VECINA, COMBUSTIBLE, VAPOR_UNITS);
    scene.tick(1);

    // Sin chispa no pasa nada: 110 °C está por debajo del umbral de
    // autoignición, así que el vapor espera.
    expect(80).toBeLessThan(AUTOIGNITION_CELSIUS);
    scene.tick(2);
    expect(scene.reactions.filter((event) => event.kind === "combustion")).toHaveLength(0);

    // El chispazo de arrancar una pieza energizada, por el bus real.
    spark(scene, SALA, 3);
    scene.tick(3);
    const enSala = scene.reactions.filter((event) => event.kind === "combustion");
    expect(enSala.length).toBeGreaterThanOrEqual(1);
    expect(enSala[0]).toMatchObject({ sectionId: SALA });

    // El calor de esa combustión conduce a la vecina. Se acumula el MÁXIMO
    // durante el bucle: es un pulso, y leer el valor final mediría la
    // recuperación en vez del fenómeno.
    let vecinaPico = -Infinity;
    for (let i = 4; i < 30; i += 1) {
      scene.tick(i);
      vecinaPico = Math.max(vecinaPico, scene.temperature(VECINA));
    }
    expect(vecinaPico).toBeGreaterThanOrEqual(AUTOIGNITION_CELSIUS);

    // Y la vecina prendió sin que nadie le acercara una chispa: es la
    // propagación, que antes de 14a-3 no existía.
    const enVecina = scene.reactions.filter(
      (event) => event.kind === "combustion" && event.sectionId === VECINA,
    );
    expect(enVecina.length).toBeGreaterThanOrEqual(1);
  });

  it("el fuego se APAGA solo al agotar el combustible del aire", () => {
    // Sin consumo de reactivos, autoignición + combustible permanente sería una
    // cascada sin final y no habría forma de apagar nada.
    const scene = buildScene();
    scene.tick(0);
    scene.atmosphere.atmosphereOf(SALA)!.temperatureCelsius = 80;
    scene.setNow(1);
    scene.gasInjection.inject(SALA, COMBUSTIBLE, VAPOR_UNITS);
    scene.tick(1);
    expect(scene.fuelFraction(SALA)).toBeGreaterThan(REACTANT_PRESENCE_FLOOR);

    spark(scene, SALA, 2);
    for (let i = 2; i < 60; i += 1) {
      scene.tick(i);
    }
    // No llega a cero exacto: la difusión devuelve trazas desde la vecina. Lo
    // que importa es que caiga por debajo del piso de presencia, que es donde
    // deja de contar como reactivo.
    expect(scene.fuelFraction(SALA)).toBeLessThan(REACTANT_PRESENCE_FLOOR);

    // Y una vez agotado, deja de emitir aunque la sala siga caliente: el ciclo
    // termina por falta de reactivo, no por falta de ignición.
    const antes = scene.reactions.length;
    for (let i = 60; i < 90; i += 1) {
      scene.tick(i);
    }
    expect(scene.reactions.length).toBe(antes);
  });

  it("la chispa CADUCA: una sala con historial de chispazo no arde para siempre", () => {
    const scene = buildScene();
    scene.tick(0);
    spark(scene, SALA, 1);
    scene.tick(1);

    // El jugador evapora combustible mucho después del chispazo. Antes de
    // 14a-3, `ignitedSectionIds` no se limpiaba nunca y esto ardía sin causa.
    for (let i = 2; i < 20; i += 1) {
      scene.tick(i);
    }
    scene.atmosphere.atmosphereOf(SALA)!.temperatureCelsius = 80;
    scene.setNow(20);
    scene.gasInjection.inject(SALA, COMBUSTIBLE, VAPOR_UNITS);
    for (let i = 20; i < 30; i += 1) {
      scene.tick(i);
    }
    expect(scene.reactions.filter((event) => event.kind === "combustion")).toHaveLength(0);
  });
});
