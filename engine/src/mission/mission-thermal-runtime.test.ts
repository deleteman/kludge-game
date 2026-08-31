import { describe, expect, it } from "vitest";
import { MissionThermalRuntime } from "./mission-thermal-runtime.js";
import { EventEmitter } from "../simulation/event-emitter.js";
import type { ReactionDomainEvent } from "../chemistry/reaction/reaction-events.types.js";
import type { FailureDomainEvent } from "../failure/failure-events.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import { COMBUSTION_HEAT, OVERLOAD_HEAT } from "../atmosphere/thermal-parameters.js";

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
