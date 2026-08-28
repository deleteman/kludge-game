import { describe, expect, it } from "vitest";
import {
  assertFluidTransferReachable,
  FluidTransferUnreachableError,
  isFluidTransferReachable,
  sectionOfInstance,
} from "./fluid-transfer-reachability.js";
import type { Blueprint, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { ComponentId } from "../components/physical-component.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import type { ConduitKind, ShipFloorplan } from "../floorplan/floorplan.types.js";

const BODEGA = "bodega" as SectionId;
const TALLER = "taller" as SectionId;
const PUENTE = "puente" as SectionId;

const A = "reservorio-a" as PlacedComponentInstanceId;
const B = "reservorio-b" as PlacedComponentInstanceId;
const C = "reservorio-c" as PlacedComponentInstanceId;

/** Tres secciones en fila; los conductos se inyectan por test. */
function floorplanWith(
  conduits: ReadonlyArray<{ kind: ConduitKind; a: SectionId; b: SectionId }>,
): ShipFloorplan {
  return {
    id: "nave-fixture",
    archetype: "exploracion",
    nameKey: "ship.fixture",
    gridSize: { width: 6, height: 1 },
    sections: [
      { id: BODEGA, nameKey: "section.bodega", cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }] },
      { id: TALLER, nameKey: "section.taller", cells: [{ x: 2, y: 0 }, { x: 3, y: 0 }] },
      { id: PUENTE, nameKey: "section.puente", cells: [{ x: 4, y: 0 }, { x: 5, y: 0 }] },
    ],
    conduits: conduits.map((conduit, index) => ({
      id: `conduit-${index}`,
      ...conduit,
      initialAperture: 1,
      position: { x: 0, y: 0 },
    })) as unknown as ShipFloorplan["conduits"],
    anchors: [],
    componentSeeds: [],
    doors: [],
  };
}

function blueprint(): Blueprint {
  const at = (instanceId: PlacedComponentInstanceId, x: number) => ({
    instanceId,
    componentDefinitionId: "tanque" as ComponentId,
    placement: { position: { x, y: 0 }, footprint: { width: 1, height: 1 }, rotation: 0 as const },
    condition: "ok" as const,
    wear: "nuevo" as const,
  });
  return {
    placedComponents: [at(A, 0), at(B, 2), at(C, 4)],
  } as unknown as Blueprint;
}

describe("sectionOfInstance", () => {
  it("resuelve la sección por la celda de origen de la instancia", () => {
    expect(sectionOfInstance(blueprint(), floorplanWith([]), A)).toBe(BODEGA);
    expect(sectionOfInstance(blueprint(), floorplanWith([]), C)).toBe(PUENTE);
  });

  it("una instancia inexistente no resuelve sección", () => {
    expect(
      sectionOfInstance(blueprint(), floorplanWith([]), "fantasma" as PlacedComponentInstanceId),
    ).toBeUndefined();
  });
});

describe("assertFluidTransferReachable", () => {
  it("intra-sección es libre, sin necesidad de conducto", () => {
    const ship = blueprint();
    expect(() =>
      assertFluidTransferReachable(ship, floorplanWith([]), A, A),
    ).not.toThrow();
  });

  it("cruzar de sección SIN conducto `fluido` se bloquea", () => {
    expect(() =>
      assertFluidTransferReachable(blueprint(), floorplanWith([]), A, B),
    ).toThrow(FluidTransferUnreachableError);
  });

  it("un conducto de OTRO tipo no habilita el trasvase", () => {
    // Un cable eléctrico no transporta líquido — la restricción es por capa.
    const floorplan = floorplanWith([{ kind: "electrico", a: BODEGA, b: TALLER }]);
    expect(() => assertFluidTransferReachable(blueprint(), floorplan, A, B)).toThrow(
      FluidTransferUnreachableError,
    );
  });

  it("con conducto `fluido` directo pasa", () => {
    const floorplan = floorplanWith([{ kind: "fluido", a: BODEGA, b: TALLER }]);
    expect(() => assertFluidTransferReachable(blueprint(), floorplan, A, B)).not.toThrow();
  });

  it("encadena conductos `fluido` por secciones intermedias (multi-salto)", () => {
    const floorplan = floorplanWith([
      { kind: "fluido", a: BODEGA, b: TALLER },
      { kind: "fluido", a: TALLER, b: PUENTE },
    ]);
    expect(() => assertFluidTransferReachable(blueprint(), floorplan, A, C)).not.toThrow();
  });

  it("una cadena interrumpida no alcanza el extremo", () => {
    const floorplan = floorplanWith([{ kind: "fluido", a: BODEGA, b: TALLER }]);
    expect(() => assertFluidTransferReachable(blueprint(), floorplan, A, C)).toThrow(
      FluidTransferUnreachableError,
    );
  });

  it("fail-open si alguna instancia no cae en ninguna sección", () => {
    // Mismo criterio que `assertSignalWiringReachable`: no se puede afirmar que
    // cruza un límite, así que no bloquea.
    expect(() =>
      assertFluidTransferReachable(
        blueprint(),
        floorplanWith([]),
        A,
        "fantasma" as PlacedComponentInstanceId,
      ),
    ).not.toThrow();
  });
});

describe("isFluidTransferReachable", () => {
  it("devuelve booleano en vez de lanzar, para deshabilitar el botón", () => {
    expect(isFluidTransferReachable(blueprint(), floorplanWith([]), A, B)).toBe(false);
    const floorplan = floorplanWith([{ kind: "fluido", a: BODEGA, b: TALLER }]);
    expect(isFluidTransferReachable(blueprint(), floorplan, A, B)).toBe(true);
  });
});
