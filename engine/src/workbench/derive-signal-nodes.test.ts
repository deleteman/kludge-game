import { describe, expect, it } from "vitest";
import { deriveSignalNodes } from "./derive-signal-nodes.js";
import type { PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { PlacedFootprint } from "../geometry/grid-position.types.js";

const OWNER = "inst-1" as PlacedComponentInstanceId;
const AT_6_4: PlacedFootprint = {
  position: { x: 6, y: 4 },
  footprint: { width: 1, height: 1 },
  rotation: 0,
};

describe("deriveSignalNodes", () => {
  it("returns nothing for a piece without functional properties", () => {
    expect(deriveSignalNodes(undefined, OWNER, AT_6_4)).toEqual([]);
    expect(deriveSignalNodes([], OWNER, AT_6_4)).toEqual([]);
  });

  it("maps EM/REC/COND to emitter/receptor/conductor at the piece cell", () => {
    const em = deriveSignalNodes(
      [{ tag: "EM", range: 10, triggerType: "optical", frequency: 1 }],
      OWNER,
      AT_6_4,
    );
    expect(em).toEqual([
      { id: "inst-1:emitter:0", role: "emitter", position: { x: 6, y: 4 }, ownerRef: OWNER },
    ]);

    const rec = deriveSignalNodes([{ tag: "REC", threshold: 0.5, responseDelayMs: 100 }], OWNER, AT_6_4);
    expect(rec[0]?.role).toBe("receptor");

    const cond = deriveSignalNodes([{ tag: "COND", resourceType: "E", maxCapacity: 100 }], OWNER, AT_6_4);
    expect(cond[0]?.role).toBe("conductor");
  });

  it("ignores ACT/RES/EST — they are physical properties, not graph roles", () => {
    const nodes = deriveSignalNodes(
      [
        { tag: "ACT", power: 20, cadence: 10, directional: true },
        { tag: "RES", resourceType: "L", capacity: 100, dischargeRate: 5 },
        { tag: "EST", damageResistance: 50 },
      ],
      OWNER,
      AT_6_4,
    );
    expect(nodes).toEqual([]);
  });

  it("spreads multiple signal roles over distinct cells so wire-mode find-by-position never collides", () => {
    const placement: PlacedFootprint = {
      position: { x: 0, y: 0 },
      footprint: { width: 2, height: 1 },
      rotation: 0,
    };
    const nodes = deriveSignalNodes(
      [
        { tag: "REC", threshold: 0.5, responseDelayMs: 100 },
        { tag: "EM", range: 10, triggerType: "optical", frequency: 1 },
      ],
      OWNER,
      placement,
    );
    const positions = nodes.map((node) => `${node.position.x},${node.position.y}`);
    expect(new Set(positions).size).toBe(2);
  });
});
