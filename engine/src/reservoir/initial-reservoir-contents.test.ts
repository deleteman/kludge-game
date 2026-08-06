import { describe, expect, it } from "vitest";
import {
  deriveInitialReservoirContents,
  indexFactoryReservoirContents,
} from "./initial-reservoir-contents.js";
import { FACTORY_RESERVOIR_CONTENTS } from "./factory-reservoir-contents.js";
import type { CompositeComponentSpec } from "../components/catalog/composite/composite-component-spec.types.js";
import type { PlacedComponentInstance, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { ChemicalSubstanceId } from "../chemistry/chemical-substance.types.js";
import type { ComponentId } from "../components/physical-component.types.js";

const AGUA = "agua" as ChemicalSubstanceId;

function spec(
  overrides: Omit<Partial<CompositeComponentSpec>, "id"> & { id: string },
): CompositeComponentSpec {
  return {
    name: overrides.id,
    data: {},
    recipe: { ingredients: [] },
    ...overrides,
    id: overrides.id as ComponentId,
  };
}

function placed(
  instanceId: string,
  componentDefinitionId: string,
  condition: PlacedComponentInstance["condition"] = "ok",
): PlacedComponentInstance {
  return {
    instanceId: instanceId as PlacedComponentInstanceId,
    componentDefinitionId: componentDefinitionId as ComponentId,
    placement: { position: { x: 0, y: 0 }, footprint: { width: 1, height: 1 }, rotation: 0 },
    condition,
    wear: "nuevo",
  };
}

describe("indexFactoryReservoirContents", () => {
  it("indexa un reservorio de líquido que declara `contains`", () => {
    const index = indexFactoryReservoirContents([
      spec({
        id: "tanque",
        contains: AGUA,
        data: { functional: [{ tag: "RES", resourceType: "L", capacity: 100, dischargeRate: 5 }] },
      }),
    ]);
    expect(index.get("tanque" as ComponentId)).toEqual({ substanceId: AGUA, capacity: 100 });
  });

  it("ignora una pieza sin `contains` aunque sea reservorio", () => {
    const index = indexFactoryReservoirContents([
      spec({
        id: "tanque-vacio",
        data: { functional: [{ tag: "RES", resourceType: "L", capacity: 100, dischargeRate: 5 }] },
      }),
    ]);
    expect(index.size).toBe(0);
  });

  it("ignora una BATERÍA: `RES(E)` almacena energía, no una sustancia (13b)", () => {
    const index = indexFactoryReservoirContents([
      spec({
        id: "bateria",
        contains: AGUA,
        data: {
          functional: [
            { tag: "RES", resourceType: "E", capacity: 40, dischargeRate: 5, powerUnits: 1 },
          ],
        },
      }),
    ]);
    expect(index.size).toBe(0);
  });

  it("ignora una pieza con `contains` pero sin ninguna propiedad RES", () => {
    const index = indexFactoryReservoirContents([
      spec({ id: "chatarra", contains: AGUA, data: { functional: [{ tag: "EST", damageResistance: 3 }] } }),
    ]);
    expect(index.size).toBe(0);
  });
});

describe("deriveInitialReservoirContents", () => {
  const index = indexFactoryReservoirContents([
    spec({
      id: "tanque",
      contains: AGUA,
      data: { functional: [{ tag: "RES", resourceType: "L", capacity: 100, dischargeRate: 5 }] },
    }),
  ]);

  it("llena la instancia hasta la capacidad de catálogo", () => {
    expect(deriveInitialReservoirContents([placed("t1", "tanque")], index)).toEqual([
      { componentInstanceId: "t1", substanceId: AGUA, amount: 100 },
    ]);
  });

  it("emite una entrada por INSTANCIA, no por componente", () => {
    const contents = deriveInitialReservoirContents(
      [placed("t1", "tanque"), placed("t2", "tanque")],
      index,
    );
    expect(contents.map((entry) => entry.componentInstanceId)).toEqual(["t1", "t2"]);
  });

  it("una instancia destruida no retiene nada", () => {
    expect(deriveInitialReservoirContents([placed("t1", "tanque", "destroyed")], index)).toEqual([]);
  });

  it("una pieza fuera del índice se ignora en silencio", () => {
    expect(deriveInitialReservoirContents([placed("x", "plancha-metalica")], index)).toEqual([]);
  });
});

/**
 * El bug reportado en el playtest de 13e: los 21 reservorios del catálogo
 * declaraban su sustancia SOLO en un comentario, así que nacían todos vacíos y
 * el ciclo extraer → sintetizar no tenía de dónde empezar.
 */
describe("FACTORY_RESERVOIR_CONTENTS (catálogo real)", () => {
  it("el reservorio de agua reciclada del Cap.1 trae agua", () => {
    expect(FACTORY_RESERVOIR_CONTENTS.get("reservorio-agua-reciclada" as ComponentId)).toEqual({
      substanceId: AGUA,
      capacity: 100,
    });
  });

  it("indexa los reservorios de sustancia de los 4 arquetipos", () => {
    // 21 entradas con `// Nota: contiene …` promovidas a dato real.
    expect(FACTORY_RESERVOIR_CONTENTS.size).toBeGreaterThanOrEqual(20);
  });

  it("ninguna batería del catálogo entra en el índice", () => {
    for (const id of ["bateria-celda-simple", "celula-fotovoltaica"] as const) {
      expect(FACTORY_RESERVOIR_CONTENTS.has(id as ComponentId)).toBe(false);
    }
  });

  it("la estación química nace VACÍA: su reservorio es de salida, no de fábrica", () => {
    expect(FACTORY_RESERVOIR_CONTENTS.has("estacion-quimica" as ComponentId)).toBe(false);
  });
});
