import { describe, expect, it } from "vitest";
import { MissionThermalRuntime } from "./mission-thermal-runtime.js";
import { EventEmitter } from "../simulation/event-emitter.js";
import type { ReactionDomainEvent } from "../chemistry/reaction/reaction-events.types.js";
import type { FailureDomainEvent } from "../failure/failure-events.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import {
  COMBUSTION_HEAT,
  COOLER_RATE_CELSIUS_PER_SECOND,
  NOMINAL_TEMPERATURE_CELSIUS,
  OVERLOAD_HEAT,
  PASSIVE_DRIFT_PER_SECOND,
  SUBSTANCE_THERMAL_EFFECT,
  TEMPERATURE_FLOOR_CELSIUS,
} from "../atmosphere/thermal-parameters.js";
import { THERMAL_CONDUCTIVITY_PARAMETERS } from "../failure/thermal-conductivity-rule.js";

const SECTION = "seccion-a" as SectionId;
const OTHER_SECTION = "seccion-b" as SectionId;

function tickAt(dtSeconds: number, elapsedSeconds = 0) {
  return { dtSeconds, elapsedSeconds };
}

describe("mission: MissionThermalRuntime (Subfase 14a-1)", () => {
  it("una combustión abre un pulso con la tasa de la tabla de parámetros", () => {
    const reactionEvents = new EventEmitter<ReactionDomainEvent>();
    const runtime = new MissionThermalRuntime(reactionEvents);

    reactionEvents.emit({
      kind: "combustion",
      elapsedSeconds: 0,
      intensity: "standard",
      radius: "half-section",
      crewDamage: "medium",
      sectionId: SECTION,
    });
    runtime.tick(tickAt(1));

    const spec = COMBUSTION_HEAT.standard;
    expect(runtime.heatRateOf(SECTION)).toBeCloseTo(spec.celsius / spec.durationSeconds);
  });

  it("la sobrecarga aporta calor en modo fuego, pero un corte limpio no", () => {
    const failureEvents = new EventEmitter<FailureDomainEvent>();
    const runtime = new MissionThermalRuntime(undefined, failureEvents);

    failureEvents.emit({
      kind: "overload",
      elapsedSeconds: 0,
      ref: "conductor-1",
      resourceType: "E",
      failureMode: "cut",
      capacity: 10,
      load: 20,
      sectionId: SECTION,
    });
    runtime.tick(tickAt(1));
    expect(runtime.heatRateOf(SECTION)).toBe(0);

    failureEvents.emit({
      kind: "overload",
      elapsedSeconds: 0,
      ref: "conductor-2",
      resourceType: "T",
      failureMode: "fire",
      capacity: 10,
      load: 20,
      sectionId: SECTION,
    });
    runtime.tick(tickAt(1));
    const spec = OVERLOAD_HEAT.fire;
    expect(spec).toBeDefined();
    expect(runtime.heatRateOf(SECTION)).toBeCloseTo(spec!.celsius / spec!.durationSeconds);
  });

  it("la neutralización usa el calor que trae el propio evento, no la tabla", () => {
    const reactionEvents = new EventEmitter<ReactionDomainEvent>();
    const runtime = new MissionThermalRuntime(reactionEvents);

    reactionEvents.emit({
      kind: "neutralization",
      elapsedSeconds: 0,
      heatReleasedCelsius: 15,
      heatDurationSeconds: 3,
      sectionId: SECTION,
    });
    runtime.tick(tickAt(0.5));

    expect(runtime.heatRateOf(SECTION)).toBeCloseTo(5);
  });

  it("el pulso se agota y la tasa vuelve a cero", () => {
    const reactionEvents = new EventEmitter<ReactionDomainEvent>();
    const runtime = new MissionThermalRuntime(reactionEvents);

    reactionEvents.emit({
      kind: "neutralization",
      elapsedSeconds: 0,
      heatReleasedCelsius: 15,
      heatDurationSeconds: 2,
      sectionId: SECTION,
    });

    runtime.tick(tickAt(1));
    expect(runtime.heatRateOf(SECTION)).toBeGreaterThan(0);
    runtime.tick(tickAt(1));
    expect(runtime.heatRateOf(SECTION)).toBeGreaterThan(0);
    // Ya consumió sus 2 s: el tercer tick no aporta nada.
    runtime.tick(tickAt(1));
    expect(runtime.heatRateOf(SECTION)).toBe(0);
  });

  it("dos pulsos en la misma sección se suman; otra sección no se contamina", () => {
    const reactionEvents = new EventEmitter<ReactionDomainEvent>();
    const runtime = new MissionThermalRuntime(reactionEvents);

    for (const sectionId of [SECTION, SECTION, OTHER_SECTION]) {
      reactionEvents.emit({
        kind: "neutralization",
        elapsedSeconds: 0,
        heatReleasedCelsius: 10,
        heatDurationSeconds: 5,
        sectionId,
      });
    }
    runtime.tick(tickAt(1));

    expect(runtime.heatRateOf(SECTION)).toBeCloseTo(4);
    expect(runtime.heatRateOf(OTHER_SECTION)).toBeCloseTo(2);
  });

  it("un evento sin sectionId (mesa de creación) no calienta nada", () => {
    const reactionEvents = new EventEmitter<ReactionDomainEvent>();
    const runtime = new MissionThermalRuntime(reactionEvents);

    reactionEvents.emit({
      kind: "combustion",
      elapsedSeconds: 0,
      intensity: "violent",
      radius: "full-section",
      crewDamage: "high",
    });
    runtime.tick(tickAt(1));

    expect(runtime.rates().size).toBe(0);
  });
});

describe("mission: MissionThermalRuntime — enfriamiento (Subfase 14a-2)", () => {
  it("un regulador activo aporta una tasa NEGATIVA sostenida, sin eventos de por medio", () => {
    const runtime = new MissionThermalRuntime(undefined, undefined, () => new Map([[SECTION, 1]]));
    runtime.tick(tickAt(1));
    expect(runtime.heatRateOf(SECTION)).toBeCloseTo(COOLER_RATE_CELSIUS_PER_SECOND);
    // Sostenido: a diferencia de un pulso, no se agota con el tiempo.
    for (let i = 0; i < 100; i += 1) {
      runtime.tick(tickAt(1, i));
    }
    expect(runtime.heatRateOf(SECTION)).toBeCloseTo(COOLER_RATE_CELSIUS_PER_SECOND);
  });

  it("dos reguladores en la misma sala enfrían el doble", () => {
    const runtime = new MissionThermalRuntime(undefined, undefined, () => new Map([[SECTION, 2]]));
    runtime.tick(tickAt(1));
    expect(runtime.heatRateOf(SECTION)).toBeCloseTo(COOLER_RATE_CELSIUS_PER_SECOND * 2);
  });

  it("el enfriamiento se SUMA al incendio en vez de ganarle o perder por separado", () => {
    const reactionEvents = new EventEmitter<ReactionDomainEvent>();
    const runtime = new MissionThermalRuntime(reactionEvents, undefined, () => new Map([[SECTION, 1]]));
    reactionEvents.emit({
      kind: "combustion",
      elapsedSeconds: 0,
      intensity: "standard",
      radius: "half-section",
      crewDamage: "medium",
      sectionId: SECTION,
    });
    runtime.tick(tickAt(1));

    const fire = COMBUSTION_HEAT.standard.celsius / COMBUSTION_HEAT.standard.durationSeconds;
    expect(runtime.heatRateOf(SECTION)).toBeCloseTo(fire + COOLER_RATE_CELSIUS_PER_SECOND);
  });

  it("un derrame criogénico abre un pulso de frío que escala con la cantidad vertida", () => {
    const runtime = new MissionThermalRuntime();
    runtime.applySubstanceSpill(SECTION, "nitrogeno-liquido", 5);
    runtime.tick(tickAt(1));

    const spec = SUBSTANCE_THERMAL_EFFECT["nitrogeno-liquido"]!;
    expect(runtime.heatRateOf(SECTION)).toBeCloseTo((spec.celsius * 5) / spec.durationSeconds);
  });

  it("una sustancia sin efecto térmico declarado no mueve la temperatura", () => {
    const runtime = new MissionThermalRuntime();
    runtime.applySubstanceSpill(SECTION, "agua", 10);
    runtime.tick(tickAt(1));
    expect(runtime.heatRateOf(SECTION)).toBe(0);
  });

  it("el enfriador alcanza de verdad el umbral de degradación del conductor", () => {
    // Patrón 23: el número solo sirve si el rango entre él y los otros números
    // del sistema NO es vacío. La deriva pasiva empuja hacia el nominal, así que
    // esto se comprueba simulando, no razonando sobre la constante suelta.
    let temperature = NOMINAL_TEMPERATURE_CELSIUS;
    for (let i = 0; i < 600; i += 1) {
      temperature +=
        (NOMINAL_TEMPERATURE_CELSIUS - temperature) * PASSIVE_DRIFT_PER_SECOND +
        COOLER_RATE_CELSIUS_PER_SECOND;
    }
    expect(temperature).toBeLessThan(THERMAL_CONDUCTIVITY_PARAMETERS.triggerTemperatureCelsius);
    expect(temperature).toBeGreaterThan(TEMPERATURE_FLOOR_CELSIUS);
  });
});
