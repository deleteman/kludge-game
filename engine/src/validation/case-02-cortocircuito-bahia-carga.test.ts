// GDD 9, caso 2 — "Cortocircuito en bahía de carga": refrigerante conductor + nitrógeno líquido + panel eléctrico → propiedades de material, conductividad eléctrica variable con temperatura (GDD 5.2).
import { describe, expect, it } from "vitest";
import {
  OverloadRule,
  THERMAL_CONDUCTIVITY_PARAMETERS,
  thermallyAdjustedConductorOverloadSubject,
  type ConductorProperty,
  type TickContext,
} from "../index.js";

const tickOf = (elapsed: number, dt = 1): TickContext => ({
  dtSeconds: dt,
  elapsedSeconds: elapsed,
});

describe("case 2 — Cortocircuito en bahía de carga", () => {
  it("nitrogen-cooling a conductor below the trigger threshold shrinks its safe capacity and triggers a short", () => {
    // Panel eléctrico con un conductor (refrigerante conductor) que en
    // condiciones normales soporta la carga de la bahía sin problema.
    const panelElectrico: ConductorProperty = { tag: "COND", resourceType: "E", maxCapacity: 20 };
    const cargaHabitual = 15;
    const rule = new OverloadRule();

    // Temperatura de bahía normal: no hay sobrecarga.
    const subjectNormal = thermallyAdjustedConductorOverloadSubject(
      "panel-bahia-carga",
      panelElectrico,
      cargaHabitual,
      20,
    );
    expect(rule.evaluate(subjectNormal, tickOf(0))).toBeNull();

    // El nitrógeno líquido derramado enfría el panel por debajo del umbral:
    // la resistencia baja, la conductividad efectiva sube, y la MISMA carga
    // habitual ahora excede la capacidad seguro -> cortocircuito derivado.
    const subjectEnfriado = thermallyAdjustedConductorOverloadSubject(
      "panel-bahia-carga",
      panelElectrico,
      cargaHabitual,
      THERMAL_CONDUCTIVITY_PARAMETERS.triggerTemperatureCelsius - 20,
    );
    const event = rule.evaluate(subjectEnfriado, tickOf(1));
    expect(event).toMatchObject({ kind: "overload", failureMode: "cut", load: cargaHabitual });
    expect(event?.capacity).toBeLessThan(panelElectrico.maxCapacity);
  });
});
