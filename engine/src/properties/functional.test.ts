import { describe, expect, it } from "vitest";
import type {
  ActuatorProperty,
  ConductorProperty,
  EmitterProperty,
  FunctionalProperties,
  ReceptorProperty,
  ReservoirProperty,
  StructureProperty,
} from "./functional.types.js";

describe("properties: functional (GDD 5.1)", () => {
  it("builds each functional property with its own attributes", () => {
    const em: EmitterProperty = { tag: "EM", range: 5, triggerType: "movement", frequency: 1 };
    const rec: ReceptorProperty = { tag: "REC", threshold: 0.5, responseDelayMs: 200 };
    const act: ActuatorProperty = { tag: "ACT", power: 10, cadence: 1, directional: true };
    const res: ReservoirProperty = {
      tag: "RES",
      resourceType: "G",
      capacity: 100,
      dischargeRate: 5,
    };
    const cond: ConductorProperty = { tag: "COND", resourceType: "E", maxCapacity: 50 };
    const est: StructureProperty = { tag: "EST", damageResistance: 10 };

    expect(em.tag).toBe("EM");
    expect(rec.tag).toBe("REC");
    expect(act.tag).toBe("ACT");
    expect(res.tag).toBe("RES");
    expect(cond.tag).toBe("COND");
    expect(est.tag).toBe("EST");
  });

  it("narrows a FunctionalProperty union by its tag discriminant", () => {
    const properties: FunctionalProperties = [
      { tag: "EM", range: 1, triggerType: "temperature", frequency: 1 },
      { tag: "REC", threshold: 1, responseDelayMs: 0 },
    ];

    const emitter = properties.find((p) => p.tag === "EM");
    expect(emitter?.tag).toBe("EM");
    if (emitter?.tag === "EM") {
      expect(emitter.triggerType).toBe("temperature");
    }
  });

  it("allows a component to declare multiple functional roles at once (GDD 7.3)", () => {
    const analysisServer: FunctionalProperties = [
      { tag: "REC", threshold: 1, responseDelayMs: 0 },
      { tag: "EM", range: 3, triggerType: "logic", frequency: 1 },
    ];
    expect(analysisServer).toHaveLength(2);
  });

  it("allows an articulated structure to declare its range of movement", () => {
    const articulatedArm: StructureProperty = {
      tag: "EST",
      damageResistance: 5,
      articulatedRange: 180,
    };
    expect(articulatedArm.articulatedRange).toBe(180);
  });
});
