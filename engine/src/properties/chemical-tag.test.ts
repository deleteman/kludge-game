import { describe, expect, it } from "vitest";
import {
  assertValidTagCount,
  MAX_CHEMICAL_TAGS_PER_SUBSTANCE,
  MIN_CHEMICAL_TAGS_PER_SUBSTANCE,
} from "./chemical-tag.types.js";
import type {
  ChemicalProperties,
  CorrTag,
  SimpleChemicalTag,
  ToxTag,
} from "./chemical-tag.types.js";

describe("properties: chemical tags (GDD 5.3)", () => {
  it("builds simple tags without a level", () => {
    const oxidizer: SimpleChemicalTag = { name: "OXI" };
    expect(oxidizer).toEqual({ name: "OXI" });
  });

  it("lets TOX carry the special 'controlado' level from GDD 5.4.3", () => {
    const anesthetic: ToxTag = { name: "TOX", level: "controlado" };
    expect(anesthetic.level).toBe("controlado");
  });

  it("does not let CORR accept the TOX-only 'controlado' level (compile-time check)", () => {
    // @ts-expect-error CORR only accepts A/M/B, not the TOX-exclusive "controlado" level.
    const invalid: CorrTag = { name: "CORR", level: "controlado" };
    expect(invalid).toBeDefined();
  });

  it("accepts 1 to 3 tags", () => {
    const oneTag: ChemicalProperties = [{ name: "INERTE" }];
    const threeTags: ChemicalProperties = [
      { name: "COMB" },
      { name: "VOLAT" },
      { name: "TOX", level: "M" },
    ];
    expect(() => assertValidTagCount({ tags: oneTag })).not.toThrow();
    expect(() => assertValidTagCount({ tags: threeTags })).not.toThrow();
    expect(oneTag.length).toBeGreaterThanOrEqual(MIN_CHEMICAL_TAGS_PER_SUBSTANCE);
    expect(threeTags.length).toBeLessThanOrEqual(MAX_CHEMICAL_TAGS_PER_SUBSTANCE);
  });

  it("rejects 0 tags", () => {
    expect(() => assertValidTagCount({ tags: [] })).toThrow(/1-3 tags/);
  });

  it("rejects 4+ tags", () => {
    const fourTags: ChemicalProperties = [
      { name: "OXI" },
      { name: "COMB" },
      { name: "VOLAT" },
      { name: "CORR", level: "A" },
    ];
    expect(() => assertValidTagCount({ tags: fourTags })).toThrow(/1-3 tags/);
  });
});
