import { describe, expect, it } from "vitest";
import { weaponDamageSeverity, WEAPON_DAMAGE_PARAMETERS } from "./weapon-damage.js";
import type { ActuatorProperty } from "../properties/functional.types.js";

const actuator = (power: number, cadence: number): ActuatorProperty => ({
  tag: "ACT",
  power,
  cadence,
  directional: true,
});

describe("weapon-damage: weaponDamageSeverity (Fase 11d, ACT.power x ACT.cadence -> severidad)", () => {
  it("torreta-automatizada/canon-laser (power 80, cadence 5) -> alta", () => {
    expect(weaponDamageSeverity(actuator(80, 5))).toBe("high");
  });

  it("garra-de-abordaje (power 50, cadence 4) -> media", () => {
    expect(weaponDamageSeverity(actuator(50, 4))).toBe("medium");
  });

  it("un actuador débil y lento -> baja", () => {
    expect(weaponDamageSeverity(actuator(10, 20))).toBe("low");
  });

  it("cadencia muy rápida agrava incluso con poca potencia", () => {
    const slowWeak = weaponDamageSeverity(actuator(20, 20));
    const fastWeak = weaponDamageSeverity(actuator(20, WEAPON_DAMAGE_PARAMETERS.fastCadenceThreshold));
    const order = ["low", "medium", "high"];
    expect(order.indexOf(fastWeak)).toBeGreaterThan(order.indexOf(slowWeak));
  });

  it("mucha potencia agrava incluso con cadencia lenta", () => {
    const weakSlow = weaponDamageSeverity(actuator(20, 20));
    const strongSlow = weaponDamageSeverity(actuator(WEAPON_DAMAGE_PARAMETERS.highPowerThreshold, 20));
    const order = ["low", "medium", "high"];
    expect(order.indexOf(strongSlow)).toBeGreaterThan(order.indexOf(weakSlow));
  });
});
