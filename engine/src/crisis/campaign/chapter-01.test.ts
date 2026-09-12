import { describe, expect, it } from "vitest";
import { evaluateCrisis } from "../crisis-machine.js";
import {
  createDefaultCrisisResolutionRegistry,
  createDefaultCrisisTriggerRegistry,
} from "../rules/crisis-rule-registry.js";
import { buildComponentCatalog } from "../../components/catalog/build-component-catalog.js";
import {
  CHAPTER_01_ACTUATOR_INSTANCE_ID,
  CHAPTER_01_ANCHOR_POSITION,
  CHAPTER_01_GATE_NODE_ID,
  CHAPTER_01_PRIMER_AVISO,
  CHAPTER_01_SEAL_INSTANCE_ID,
  CHAPTER_01_SEEDED_COMPONENTS_BY_ARCHETYPE,
  CHAPTER_01_SEEDED_SIGNAL_NODES_BY_ARCHETYPE,
  CHAPTER_01_INITIAL_ATOMIC_STOCK,
  CHAPTER_01_SENSOR_NODE_ID,
} from "./chapter-01-primer-aviso.js";
import { isCompositeEntity } from "../../composition/composable-entity.types.js";
import { consumeStock, stockOf } from "../../inventory/inventory-ledger.js";
import { DEFAULT_WEAR } from "../../wear/wear.types.js";
import { ALL_COMPOSITE_SPECS } from "../../components/catalog/build-component-catalog.js";
import { buildChemicalCatalog } from "../../chemistry/catalog/build-chemical-catalog.js";
import { effectiveMatterState } from "../../chemistry/phase/matter-state.js";
import { NOMINAL_TEMPERATURE_CELSIUS } from "../../atmosphere/thermal-parameters.js";
import { CHEMICAL_SENSOR_TAGS } from "../../atmosphere/chemical-sensor-parameters.js";
import type { CrisisState } from "../crisis-state.types.js";
import type { CrisisEvalContext } from "../crisis-rule.js";
import type { Blueprint } from "../../blueprint/blueprint.types.js";
import type { ComponentId } from "../../components/physical-component.types.js";
import type { SignalEdgeId } from "../../signals/signal-edge.types.js";

/** Grafo con los dos nodos del cap. 1 y (opcionalmente) el cable que los une. */
function chapter01Graph(wired: boolean): Blueprint["signalGraph"] {
  return {
    nodes: [...CHAPTER_01_SEEDED_SIGNAL_NODES_BY_ARCHETYPE.exploracion],
    edges: wired
      ? [{ id: "cable-test" as SignalEdgeId, from: CHAPTER_01_SENSOR_NODE_ID, to: CHAPTER_01_GATE_NODE_ID }]
      : [],
  };
}

/**
 * Escenario de integración del capítulo 1 ("Primer Aviso"), sin caso de
 * validación GDD §9 asociado — vive junto al contenido (`crisis/campaign/`)
 * en vez de `validation/case-XX-*.test.ts`. Precedente para capítulos
 * futuros que tampoco mapeen a un caso de validación.
 */
function shipWithActuator(condition: "ok" | "jammed", definitionId: ComponentId): Blueprint {
  return {
    metadata: {
      schemaVersion: 3,
      id: "capitulo-1-fixture",
      name: "Fixture capítulo 1",
      engineVersion: "0.0.0",
      createdAt: "2026-07-14T00:00:00.000Z",
      updatedAt: "2026-07-14T00:00:00.000Z",
    },
    placedComponents: [
      {
        instanceId: CHAPTER_01_ACTUATOR_INSTANCE_ID,
        componentDefinitionId: definitionId,
        placement: {
          position: CHAPTER_01_ANCHOR_POSITION,
          footprint: { width: 1, height: 1 },
          rotation: 0,
        },
        condition,
        wear: "nuevo",
      },
    ],
    reservoirContents: [],
    signalGraph: { nodes: [], edges: [] },
    sectionAtmospheres: [],
    sectionIntegrity: [],
    unpoweredSectionIds: [],
    doorStates: [],
    valveApertures: [],
    overloadedRefs: [],
    powerState: { sectionAllocations: [], instancePriorities: [], permanentlyDisconnectedSectionIds: [], dischargedSourceIds: [] },
  };
}

describe("Capítulo 1 — Primer Aviso (escenario completo)", () => {
  const triggerRules = createDefaultCrisisTriggerRegistry();
  const resolutionRules = createDefaultCrisisResolutionRegistry();
  const componentRegistry = buildComponentCatalog().registry;

  it("dispara al encontrar la válvula atascada y resuelve al reinstalarla reparada/sustituida", () => {
    let state: CrisisState = "not-triggered";

    // Tick 1: la válvula sigue atascada -> dispara y emite crisis-triggered.
    const jammedCtx: CrisisEvalContext = {
      ship: shipWithActuator("jammed", "valvula-simple" as ComponentId),
      tick: { dtSeconds: 1, elapsedSeconds: 1 },
    };
    const triggerResult = evaluateCrisis(state, CHAPTER_01_PRIMER_AVISO, jammedCtx, {
      triggerRules,
      resolutionRules,
    });
    state = triggerResult.state;
    expect(state).toBe("active");
    expect(triggerResult.events).toEqual([
      { kind: "crisis-triggered", crisisId: CHAPTER_01_PRIMER_AVISO.id, elapsedSeconds: 1 },
    ]);

    // Tick 2: sigue atascada -> permanece activa, sin nuevos eventos.
    const stillJammedResult = evaluateCrisis(state, CHAPTER_01_PRIMER_AVISO, jammedCtx, {
      triggerRules,
      resolutionRules,
    });
    expect(stillJammedResult.state).toBe("active");
    expect(stillJammedResult.events).toEqual([]);

    // Tick 3: el jugador sustituyó la válvula por un motor pequeño ("ok"), pero
    // el sensor SIGUE sin cablear -> la resolución es AND, sigue activa.
    const replacedUnwiredCtx: CrisisEvalContext = {
      ship: { ...shipWithActuator("ok", "motor-pequeno" as ComponentId), signalGraph: chapter01Graph(false) },
      tick: { dtSeconds: 1, elapsedSeconds: 60 },
      componentRegistry,
    };
    const replacedResult = evaluateCrisis(state, CHAPTER_01_PRIMER_AVISO, replacedUnwiredCtx, {
      triggerRules,
      resolutionRules,
    });
    expect(replacedResult.state).toBe("active");

    // Tick 4: además cableó el sensor al panel de la compuerta Y selló la
    // fuga de presión (Subfase 11h) -> ahora sí resuelve (AND de las 3).
    const sealSeed = CHAPTER_01_SEEDED_COMPONENTS_BY_ARCHETYPE.exploracion.find(
      (entry) => entry.instanceId === CHAPTER_01_SEAL_INSTANCE_ID,
    )!;
    const resolvedShip = shipWithActuator("ok", "motor-pequeno" as ComponentId);
    const resolvedCtx: CrisisEvalContext = {
      ship: {
        ...resolvedShip,
        placedComponents: [...resolvedShip.placedComponents, { ...sealSeed, condition: "ok" }],
        signalGraph: chapter01Graph(true),
      },
      tick: { dtSeconds: 1, elapsedSeconds: 120 },
      componentRegistry,
    };
    const resolveResult = evaluateCrisis(state, CHAPTER_01_PRIMER_AVISO, resolvedCtx, {
      triggerRules,
      resolutionRules,
    });
    expect(resolveResult.state).toBe("resolved-success");
    expect(resolveResult.events).toEqual([
      {
        kind: "crisis-resolved",
        crisisId: CHAPTER_01_PRIMER_AVISO.id,
        outcome: "resolved-success",
        elapsedSeconds: 120,
      },
    ]);
  });

  it("no tiene timer — nunca falla por expiración, coherente con 'sin amenaza de vidas'", () => {
    expect(CHAPTER_01_PRIMER_AVISO.timer).toBeUndefined();
  });
});

/**
 * Ronda 1 de playtest de 14a-1. El motor simulaba el sensor térmico de verdad y
 * el jugador no podía instalarlo: la pieza no declaraba `footprint` (el selector
 * de instalación descarta esos compuestos con un `continue` mudo) y, aunque lo
 * hubiera declarado, el capítulo arrancaba sin un solo ingrediente de su receta.
 *
 * Estos dos tests anclan las dos mitades. Ninguno repite los números del stock:
 * derivan de la receta real y del propio catálogo, así que también fallan si
 * alguien cambia la receta y se olvida del stock.
 */
describe("Capítulo 1 — material de prueba del eje térmico (Subfase 14a-1)", () => {
  const registry = buildComponentCatalog().registry;
  const THERMAL_SENSOR = "sensor-termico-precision" as ComponentId;

  it("el sensor térmico declara footprint, o sea que sobrevive al filtro del selector", () => {
    const definition = registry.get(THERMAL_SENSOR);
    expect(definition?.data.footprint).toBeDefined();
  });

  it("el stock inicial alcanza para construir al menos 3 sensores térmicos", () => {
    const definition = registry.get(THERMAL_SENSOR);
    if (!definition || !isCompositeEntity(definition)) {
      throw new Error("el sensor térmico dejó de ser un compuesto de catálogo");
    }
    const recipe = definition.recipe;

    let stock = CHAPTER_01_INITIAL_ATOMIC_STOCK;
    for (let built = 0; built < 3; built += 1) {
      for (const ingredient of recipe.ingredients) {
        const next = consumeStock(stock, ingredient.ref, ingredient.quantity, DEFAULT_WEAR);
        expect(next, `falta ${ingredient.ref} para el sensor #${built + 1}`).not.toBeNull();
        stock = next!;
      }
    }
  });

  it("el stock inicial alcanza para al menos 3 indicadores LED, uno por sensor", () => {
    expect(stockOf(CHAPTER_01_INITIAL_ATOMIC_STOCK, "indicador-led" as ComponentId)).toBeGreaterThanOrEqual(3);
  });
});

/**
 * Subfase 14b-1, misma clase de corte que la ronda 1 de 14a-1 y por eso mismo
 * molde: `escaner-espectro` pasa a simularse de verdad, así que tiene que ser
 * alcanzable. No declaraba `footprint` (invisible en el selector) y DOS de los
 * tres ingredientes de su receta estaban en stock cero.
 *
 * El segundo test construye los dos sensores contra el MISMO stock, no cada uno
 * contra una copia limpia: comparten `chip-circuito-generico`, y hacerlos por
 * separado daría verde con un stock que en la partida real no alcanza para los
 * dos. Los números salen de las recetas del catálogo, no repetidos acá.
 */
describe("Capítulo 1 — material de prueba del sensor químico (Subfase 14b-1)", () => {
  const registry = buildComponentCatalog().registry;
  const SPECTRAL_SCANNER = "escaner-espectro" as ComponentId;
  const THERMAL_SENSOR = "sensor-termico-precision" as ComponentId;

  function recipeOf(componentId: ComponentId) {
    const definition = registry.get(componentId);
    if (!definition || !isCompositeEntity(definition)) {
      throw new Error(`${componentId} dejó de ser un compuesto de catálogo`);
    }
    return definition.recipe;
  }

  it("el escáner de espectro declara footprint, o sea que sobrevive al filtro del selector", () => {
    expect(registry.get(SPECTRAL_SCANNER)?.data.footprint).toBeDefined();
  });

  /**
   * Ronda 1 de playtest de 14b-1. El operador montó el escáner, lo cableó a un
   * LED, vació un reservorio de disolvente en la sala y no pasó nada — y tenía
   * razón: el disolvente es `VOLAT`+`COMB`, no `TOX`/`CORR`. Pero el problema
   * de fondo era peor: NINGUNA sustancia detectable era alcanzable en el Cap. 1,
   * así que el sensor era inusable aunque estuviera bien simulado y bien
   * construible. Es la misma clase de corte que 14a-1, pero un paso más atrás:
   * lo que faltaba no era la pieza, era el ESTÍMULO.
   *
   * El test de integración no lo vio porque inyecta amoníaco directo — una
   * sustancia que el jugador no puede conseguir (eje 9: un test que inyecta su
   * propia versión de la dependencia no puede ver el bug).
   *
   * Este test recorre el catálogo entero y exige la cadena COMPLETA: un
   * compuesto instalable, pagable con el stock del capítulo, que traiga de
   * fábrica una sustancia con tag detectable y que esa sustancia esté en estado
   * GASEOSO a temperatura nominal — un TOX líquido se derrama al piso y nunca
   * llega a la atmósfera, o sea que nunca llega al sensor.
   */
  it("hay al menos una fuente ALCANZABLE de una sustancia que el sensor químico detecta", () => {
    const chemicalRegistry = buildChemicalCatalog().registry;
    const detectable = ALL_COMPOSITE_SPECS.filter((spec) => {
      if (!spec.data.footprint || !spec.contains) {
        return false;
      }
      const substance = chemicalRegistry.get(spec.contains);
      if (!substance) {
        return false;
      }
      const hasSensorTag = substance.data.tags.some((tag) =>
        (CHEMICAL_SENSOR_TAGS as ReadonlyArray<string>).includes(tag.name),
      );
      const airborne =
        effectiveMatterState(substance, NOMINAL_TEMPERATURE_CELSIUS) === "G";
      if (!hasSensorTag || !airborne) {
        return false;
      }
      let stock = CHAPTER_01_INITIAL_ATOMIC_STOCK;
      for (const ingredient of spec.recipe.ingredients) {
        const next = consumeStock(stock, ingredient.ref, ingredient.quantity, DEFAULT_WEAR);
        if (!next) {
          return false;
        }
        stock = next;
      }
      return true;
    });

    expect(
      detectable.map((spec) => spec.id),
      "ningún compuesto instalable del Cap. 1 trae una sustancia que el sensor químico pueda detectar en el aire",
    ).not.toHaveLength(0);
  });

  it("el stock inicial alcanza para 3 escáneres Y 3 sensores térmicos a la vez", () => {
    let stock = CHAPTER_01_INITIAL_ATOMIC_STOCK;
    for (const [componentId, label] of [
      [SPECTRAL_SCANNER, "escáner"],
      [THERMAL_SENSOR, "sensor térmico"],
    ] as const) {
      for (let built = 0; built < 3; built += 1) {
        for (const ingredient of recipeOf(componentId).ingredients) {
          const next = consumeStock(stock, ingredient.ref, ingredient.quantity, DEFAULT_WEAR);
          expect(next, `falta ${ingredient.ref} para el ${label} #${built + 1}`).not.toBeNull();
          stock = next!;
        }
      }
    }
  });
});
