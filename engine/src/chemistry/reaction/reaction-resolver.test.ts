import { describe, expect, it, vi } from "vitest";
import { ReactionResolver } from "./reaction-resolver.js";
import { NamedRecipeIndex } from "./named-recipe-index.js";
import { toReactant } from "./tag-predicates.js";
import { EventEmitter } from "../../simulation/event-emitter.js";
import { MapEntityRegistry } from "../../composition/entity-registry.js";
import type {
  ChemicalSubstanceDefinition,
  ChemicalSubstanceId,
} from "../chemical-substance.types.js";
import type { ChemicalProperties } from "../../properties/chemical-tag.types.js";
import type { ReactantSubstance, ReactionContext } from "./reaction-context.types.js";
import type { ReactionDomainEvent } from "./reaction-events.types.js";

const id = (raw: string): ChemicalSubstanceId => raw as ChemicalSubstanceId;

function sub(name: string, tags: ChemicalProperties): ReactantSubstance {
  return { id: id(name), name, tags };
}

function context(
  reactants: ReactantSubstance[],
  overrides: Partial<ReactionContext> = {},
): ReactionContext {
  return {
    reactants,
    oxygen: "normal",
    ignitionPresent: false,
    thermalRegulatorOverloaded: false,
    elapsedSeconds: 0,
    ...overrides,
  };
}

describe("chemistry: ReactionResolver — resolución de identidad en 3 pasos (GDD 5.3)", () => {
  it("paso 1: una receta nombrada tiene precedencia (H×2 + O → Agua)", () => {
    const hydrogen: ChemicalSubstanceDefinition = {
      level: "atomic",
      id: id("H"),
      name: "Hidrógeno",
      data: { tags: [{ name: "COMB" }, { name: "VOLAT" }], state: "G" },
    };
    const oxygen: ChemicalSubstanceDefinition = {
      level: "atomic",
      id: id("O"),
      name: "Oxígeno",
      data: { tags: [{ name: "OXI" }], state: "G" },
    };
    const water: ChemicalSubstanceDefinition = {
      level: "composite",
      id: id("Agua"),
      name: "Agua",
      data: { tags: [{ name: "INERTE" }], state: "L" },
      recipe: {
        ingredients: [
          { ref: id("H"), quantity: 2 },
          { ref: id("O"), quantity: 1 },
        ],
      },
    };
    const registry = new MapEntityRegistry<ChemicalSubstanceId, ChemicalSubstanceDefinition>();
    for (const def of [hydrogen, oxygen, water]) registry.register(def.id, def);

    const resolver = new ReactionResolver({ namedRecipeIndex: new NamedRecipeIndex(registry) });
    const outcome = resolver.resolve(
      context([toReactant(hydrogen), toReactant(hydrogen), toReactant(oxygen)]),
    );

    expect(outcome.result?.name).toBe("Agua");
    expect(outcome.appliedRuleIds).toEqual([]); // resuelto por receta, sin reglas de tags
  });

  it("paso 2: regla de tags con nombre genérico fijo (ácido+base → Solución neutralizada)", () => {
    const resolver = new ReactionResolver();
    const outcome = resolver.resolve(
      context([sub("ácido", [{ name: "ACID" }]), sub("base", [{ name: "BASE" }])]),
    );
    expect(outcome.result?.name).toBe("Solución neutralizada");
    expect(outcome.appliedRuleIds).toEqual(["neutralization"]);
  });

  it("paso 3: sin receta ni regla → Mezcla sin identificar con unión de tags (caso 12)", () => {
    const resolver = new ReactionResolver();
    const outcome = resolver.resolve(
      context([sub("a", [{ name: "INERTE" }]), sub("b", [{ name: "VOLAT" }])]),
    );
    expect(outcome.result?.name).toMatch(/^Mezcla sin identificar/);
    expect(outcome.result?.tags).toEqual([{ name: "INERTE" }, { name: "VOLAT" }]);
  });
});

describe("chemistry: ReactionResolver — prioridad y stacking (Espec. §2)", () => {
  it("neutralización gana sobre corrosivo+sustancia cuando ambas aplican", () => {
    const resolver = new ReactionResolver();
    const outcome = resolver.resolve(
      context([
        sub("ácido corrosivo", [{ name: "ACID" }, { name: "CORR", level: "A" }]),
        sub("base", [{ name: "BASE" }]),
      ]),
    );
    expect(outcome.appliedRuleIds[0]).toBe("neutralization");
    expect(outcome.result?.name).toBe("Solución neutralizada");
  });

  it("consume con la regla de mayor prioridad y re-evalúa sobre el resultado (caso 13)", () => {
    const resolver = new ReactionResolver();
    const outcome = resolver.resolve(
      context(
        [
          sub("fuga", [
            { name: "CORR", level: "M" },
            { name: "TOX", level: "M" },
          ]),
          sub("combustible", [{ name: "COMB" }]),
        ],
        { ignitionPresent: true, oxygen: "normal" },
      ),
    );
    // Combustión (prioridad 2) consume el combustible primero; luego el corrosivo
    // se re-evalúa sobre el residuo y produce el gas tóxico derivado.
    expect(outcome.appliedRuleIds).toEqual(["combustion", "corrosive-substance"]);
    expect(outcome.result?.name).toBe("Gas tóxico derivado");
    expect(outcome.events.some((e) => e.kind === "combustion")).toBe(true);
  });
});

describe("chemistry: ReactionResolver — eventos (Observer)", () => {
  it("emite los eventos por el emisor además de devolverlos", () => {
    const emitter = new EventEmitter<ReactionDomainEvent>();
    const onCombustion = vi.fn();
    emitter.on("combustion", onCombustion);
    const resolver = new ReactionResolver({ emitter });

    resolver.resolve(
      context([sub("fuel", [{ name: "COMB" }])], { ignitionPresent: true, oxygen: "high" }),
    );
    expect(onCombustion).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "combustion", intensity: "violent" }),
    );
  });
});
