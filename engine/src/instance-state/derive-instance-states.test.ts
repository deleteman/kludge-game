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
