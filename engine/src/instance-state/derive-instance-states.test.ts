import { describe, expect, it } from "vitest";
import { deriveInstanceStates } from "./derive-instance-states.js";
import type { InstanceStateQueries } from "./derive-instance-states.js";
import type { PlacedComponentInstance, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { ComponentId, PhysicalComponentDefinition } from "../components/physical-component.types.js";

const INSTANCE_ID = "puerta-1" as PlacedComponentInstanceId;

function instance(): PlacedComponentInstance {
  return {
    instanceId: INSTANCE_ID,
    componentDefinitionId: "compuerta-blindada" as ComponentId,
    placement: { position: { x: 1, y: 0 }, footprint: { width: 1, height: 1 }, rotation: 0 },
    condition: "ok",
    wear: "nuevo",
  };
}

// Fixture ATÓMICO a propósito: `componentPowerDraw` solo lee `data`, así que un
// compuesto obligaría a inventarle una receta falsa que no aporta nada a lo que
// este test comprueba.
function definition(powerDraw?: number): PhysicalComponentDefinition {
  return {
    id: "compuerta-blindada" as ComponentId,
    name: "Compuerta",
    level: "atomic",
    data: {
      functional: [{ tag: "ACT", power: 70, cadence: 1.5, directional: false }],
      footprint: { width: 1, height: 1 },
      powerDraw,
    },
  };
}

function queries(overrides: Partial<InstanceStateQueries> = {}): InstanceStateQueries {
  return {
    resolveDefinition: () => definition(2),
    isInstancePowered: () => true,
    isInstanceOverloaded: () => false,
    sectionGrantedUnitsAt: () => 1,
    signalStarvationOf: () => undefined,
    frozenContentOf: () => undefined,
    ...overrides,
  };
}

describe("deriveInstanceStates (13h, ronda 3 de playtest)", () => {
  it("una pieza que declara consumo y no lo tiene cubierto está `unpowered`", () => {
    const states = deriveInstanceStates(instance(), queries({ isInstancePowered: () => false }));
    expect(states).toEqual([{ flag: "unpowered", required: 2, available: 1 }]);
  });

  it("lleva los NÚMEROS, no solo el hecho", () => {
    // "Sin energía" a secas describe el síntoma; lo accionable es cuánto le
    // falta a la sección. Es el dato que le faltó al operador para entender por
    // qué una compuerta con la sección encendida no se movía.
    const [state] = deriveInstanceStates(
      instance(),
      queries({ isInstancePowered: () => false, sectionGrantedUnitsAt: () => 1 }),
    );
    expect(state?.required).toBe(2);
    expect(state?.available).toBe(1);
  });

  it("con la demanda cubierta no reporta nada", () => {
    expect(deriveInstanceStates(instance(), queries({ isInstancePowered: () => true }))).toEqual([]);
  });

  it("una pieza SIN `powerDraw` no está nunca `unpowered`, aunque el reparto diga que no", () => {
    // El caso que rompería el plano entero. `allocateComponentPower` marca como
    // alimentada a toda pieza sin consumo declarado (retrocompat de 13b), pero
    // al revés no vale: sin este guard, cualquier instancia sin `powerDraw` en
    // una sección a 0 se marcaría apagada — o sea TODO el catálogo salvo la
    // compuerta, que es hoy el único consumidor del juego.
    const states = deriveInstanceStates(
      instance(),
      queries({ resolveDefinition: () => definition(undefined), isInstancePowered: () => false }),
    );
    expect(states).toEqual([]);
  });

  it("`powerDraw: 0` cuenta como no declarar consumo", () => {
    const states = deriveInstanceStates(
      instance(),
      queries({ resolveDefinition: () => definition(0), isInstancePowered: () => false }),
    );
    expect(states).toEqual([]);
  });

  it("una definición que no resuelve no revienta ni inventa estados", () => {
    const states = deriveInstanceStates(
      instance(),
      queries({ resolveDefinition: () => undefined, isInstancePowered: () => false }),
    );
    expect(states).toEqual([]);
  });
});

/**
 * Ronda 1 de playtest de 14a-2. El operador: "el cable no muestra ningún estado
 * en su tooltip". 14a-2 cerró el acoplamiento térmico que corta conductores y
 * dejó sin hacer la mitad visible — el docblock de `instance-state.types.ts` ya
 * nombraba `Blueprint.overloadedRefs` como el candidato con la infraestructura
 * lista.
 */
describe("deriveInstanceStates — `overloaded` (14a-2 ronda 1)", () => {
  it("una instancia en `overloadedRefs` reporta el estado", () => {
    const states = deriveInstanceStates(instance(), queries({ isInstanceOverloaded: () => true }));
    expect(states).toEqual([{ flag: "overloaded" }]);
  });

  it("una que no está en `overloadedRefs` no lo reporta", () => {
    expect(deriveInstanceStates(instance(), queries({ isInstanceOverloaded: () => false }))).toEqual([]);
  });

  it("no depende de `powerDraw`: un conductor sin consumo declarado igual se corta", () => {
    // El guard de `unpowered` sobre `powerDraw` es específico de ESE estado. Un
    // `cable-cobre` no declara consumo y es justamente la pieza que este estado
    // tiene que poder describir — copiar el guard lo habría dejado mudo en su
    // único caso real.
    const states = deriveInstanceStates(
      instance(),
      queries({ resolveDefinition: () => definition(undefined), isInstanceOverloaded: () => true }),
    );
    expect(states).toEqual([{ flag: "overloaded" }]);
  });

  /**
   * La franja donde los DOS predicados son ciertos, que es la que ancla qué se
   * muestra: `resolveComponentVisual` pinta `states[0]`, así que el orden de
   * emisión ES la subprioridad. Un cable cortado dentro de una sección apagada
   * tiene que anunciarse como cortado — si dijera "sin energía", el jugador
   * iría a mover el dial en vez de a reemplazar la pieza.
   */
  it("sobrecargado y sin energía a la vez: el corte va PRIMERO", () => {
    const states = deriveInstanceStates(
      instance(),
      queries({ isInstanceOverloaded: () => true, isInstancePowered: () => false }),
    );
    expect(states.map((state) => state.flag)).toEqual(["overloaded", "unpowered"]);
  });
});

/**
 * Ronda 2 de playtest de 14a-4. El operador colgó 7 consumidores de un solo
 * fotorreceptor; el emisor pasó a tener capacidad de salida y lo que no entra
 * deja de recibir señal. Sin este estado esas piezas se verían idénticas a las
 * que sí responden, y el jugador vería una puerta cableada que no se abre.
 */
describe("deriveInstanceStates — `unsignaled` (14a-4 ronda 2)", () => {
  it("una pieza sacrificada por el triaje de fan-out reporta el estado con sus números", () => {
    const states = deriveInstanceStates(
      instance(),
      queries({ signalStarvationOf: () => ({ demand: 8, capacity: 3 }) }),
    );
    expect(states).toEqual([{ flag: "unsignaled", required: 8, available: 3 }]);
  });

  it("una pieza que recibe señal no reporta nada", () => {
    expect(deriveInstanceStates(instance(), queries())).toEqual([]);
  });

  it("una pieza SIN `powerDraw` sí puede quedar sin señal", () => {
    // Deliberadamente sin el guard de `powerDraw` que sí tiene `unpowered`: una
    // pieza sin consumo declarado no pesa sobre la salida del emisor, pero
    // tampoco la gobierna nadie por eso. Quién decide si está hambrienta es el
    // triaje, no esta función.
    const states = deriveInstanceStates(
      instance(),
      queries({
        resolveDefinition: () => definition(undefined),
        signalStarvationOf: () => ({ demand: 8, capacity: 3 }),
      }),
    );
    expect(states).toEqual([{ flag: "unsignaled", required: 8, available: 3 }]);
  });

  /**
   * Los tres a la vez. El operador lo pidió explícitamente al elegir el diseño:
   * "cuidado que ambos estados pueden convivir, así que las indicaciones
   * visuales deben estar preparadas para eso". Acá se ancla el ORDEN; que se
   * dibujen los dos glifos y no solo el primero es cosa de `/game`
   * (`stateGlyphs` en `component-state-visuals.ts`).
   */
  it("cortado, sin señal y sin energía a la vez salen en ese orden", () => {
    const states = deriveInstanceStates(
      instance(),
      queries({
        isInstanceOverloaded: () => true,
        signalStarvationOf: () => ({ demand: 8, capacity: 3 }),
        isInstancePowered: () => false,
      }),
    );
    expect(states.map((state) => state.flag)).toEqual(["overloaded", "unsignaled", "unpowered"]);
  });
});
