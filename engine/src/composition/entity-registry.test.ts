import { describe, expect, it } from "vitest";
import { MapEntityRegistry } from "./entity-registry.js";

interface Fixture {
  readonly id: string;
  readonly label: string;
}

describe("composition: entity registry", () => {
  it("registers and retrieves entities by id", () => {
    const registry = new MapEntityRegistry<string, Fixture>();
    registry.register("widget-a", { id: "widget-a", label: "Widget A" });

    expect(registry.has("widget-a")).toBe(true);
    expect(registry.get("widget-a")).toEqual({ id: "widget-a", label: "Widget A" });
  });

  it("reports missing entities without throwing", () => {
    const registry = new MapEntityRegistry<string, Fixture>();
    expect(registry.has("missing")).toBe(false);
    expect(registry.get("missing")).toBeUndefined();
  });

  it("lists all registered entities", () => {
    const registry = new MapEntityRegistry<string, Fixture>();
    registry.register("widget-a", { id: "widget-a", label: "Widget A" });
    registry.register("widget-b", { id: "widget-b", label: "Widget B" });

    expect(registry.all()).toHaveLength(2);
  });
});
