import { describe, expect, it } from "vitest";
import {
  buildComponentCatalog,
  CANONICAL_SHIP_FLOORPLANS,
  instantiateDoorSeeds,
  MissionDoorRuntime,
  type ComponentId,
  type DoorId,
  type DoorSeedId,
  type PlacedComponentInstance,
  type PlacedComponentInstanceId,
  type ShipFloorplan,
} from "../index.js";
import type { SectionId } from "../atmosphere/section.types.js";

/**
 * Ronda 3 de playtest de 13g: el `a`/`b` AUTORADO manda sobre la inferencia.
 *
 * El operador reportó que la puerta del puente no bloqueaba el paso ni abría ni
 * cerraba. Está en la boca del pasillo, o sea en una celda que toca TRES
 * secciones, y el runtime la descartaba porque `thresholdSectionsAt` se rinde
 * ahí — aunque el mapa declara sin ambigüedad qué dos secciones separa. El dato
 * existía y se tiraba.
 *
 * (La ronda 2 "arregló" esto moviendo la puerta a otra celda. Era tratar el
 * síntoma: el operador la había puesto donde tenía sentido de diseño.)
 */

const PUENTE = "puente" as SectionId;
const PASILLO = "pasillo" as SectionId;
const SOPORTE = "soporte" as SectionId;
/** Boca del pasillo: pertenece a `pasillo`, toca `puente` a la izquierda y `soporte` arriba. */
const BOCA = { x: 1, y: 1 };

const REGISTRY = buildComponentCatalog().registry;

/** Plano en T: la celda del umbral toca tres secciones, como la boca de un pasillo real. */
function tJunction(initialOpen = false): ShipFloorplan {
  return {
    id: "nave-test",
    archetype: "exploracion",
    nameKey: "ship.test",
    gridSize: { width: 4, height: 3 },
    sections: [
      { id: PUENTE, nameKey: "section.puente", cells: [{ x: 0, y: 1 }] },
      { id: PASILLO, nameKey: "section.pasillo", cells: [BOCA, { x: 2, y: 1 }, { x: 3, y: 1 }] },
      { id: SOPORTE, nameKey: "section.soporte", cells: [{ x: 1, y: 0 }] },
    ],
    conduits: [],
    anchors: [],
    componentSeeds: [],
    doors: [
      {
        id: "puente-pasillo" as DoorSeedId,
        a: PUENTE,
        b: PASILLO,
        position: BOCA,
        span: 1,
        axis: "y",
        initialOpen,
      },
    ],
  };
}

function mount(plan: ShipFloorplan, instances?: readonly PlacedComponentInstance[]) {
  const runtime = new MissionDoorRuntime({
    floorplan: plan,
    resolveDefinition: (id) => REGISTRY.get(id),
    queries: { occupiedCells: () => [] },
  });
  const seeded = instantiateDoorSeeds(plan.doors, REGISTRY);
  runtime.syncInstalledDoors(instances ?? seeded.components);
  return runtime;
}

describe("puerta autorada en una celda de tres secciones (13g ronda 3)", () => {
  it("se da de alta con las secciones que DECLARA, no con las que se infieren", () => {
    const plan = tJunction();
    const runtime = mount(plan);
    const door = runtime.doorById("instance:puerta-puente-pasillo" as DoorId);

    expect(door, "la puerta autorada tiene que existir").toBeDefined();
    expect([door!.a, door!.b].sort()).toEqual([PASILLO, PUENTE].sort());
    // La tercera sección que toca la celda no participa: no es ambigüedad, es
    // una vecina más.
    expect([door!.a, door!.b]).not.toContain(SOPORTE);
  });

  it("bloquea el paso: es el síntoma exacto que reportó el operador", () => {
    const runtime = mount(tJunction());
    expect(runtime.blocksCell(BOCA)).toBe(true);
  });

  it("nace abierta si el mapa lo autora, y entonces no bloquea", () => {
    // `initialOpen` era un campo del mapa que nadie leía: todas las puertas
    // nacían cerradas (13g ronda 3).
    const runtime = mount(tJunction(true));
    const door = runtime.doorById("instance:puerta-puente-pasillo" as DoorId);

    expect(door?.state).toBe("open");
    expect(runtime.blocksCell(BOCA)).toBe(false);
  });

  it("una puerta IMPROVISADA por el jugador en esa misma celda sigue descartándose", () => {
    // La inferencia no se rompió: sin `a`/`b` autorado no hay nada que desempate
    // cuál de los tres pares separa, y elegir uno arbitrario sería peor.
    const plan = tJunction();
    const improvisada: PlacedComponentInstance = {
      instanceId: "puerta-del-jugador" as PlacedComponentInstanceId,
      componentDefinitionId: "compuerta-blindada" as ComponentId,
      placement: {
        position: { x: 2, y: 1 },
        footprint: { width: 1, height: 1 },
        rotation: 0,
      },
      condition: "ok",
      wear: "nuevo",
    };
    // (2,1) es interior del pasillo: no toca dos secciones, así que no es umbral.
    const runtime = mount({ ...plan, doors: [] }, [improvisada]);

    expect(runtime.doorById("instance:puerta-del-jugador" as DoorId)).toBeUndefined();
    expect(runtime.blocksCell({ x: 2, y: 1 })).toBe(false);
  });

  it("una puerta autorada cuya celda NO toca sus dos secciones se descarta igual", () => {
    // El `a`/`b` autorado manda, pero no inventa fronteras: si el mapa está mal
    // editado, la puerta no se da de alta.
    const plan = tJunction();
    const mentirosa: ShipFloorplan = {
      ...plan,
      doors: [{ ...plan.doors[0]!, position: { x: 3, y: 1 } }],
    };
    const runtime = mount(mentirosa);

    expect(runtime.doorById("instance:puerta-puente-pasillo" as DoorId)).toBeUndefined();
  });
});

describe("puerta del puente con el MAPA REAL (13g ronda 3)", () => {
  const plan = CANONICAL_SHIP_FLOORPLANS.exploracion;

  it("resuelve puente/pasillo-central y bloquea la boca del pasillo", () => {
    const runtime = mount(plan);
    const door = runtime.doorById("instance:puerta-puerta-puente" as DoorId);

    expect(door, "la puerta del puente tiene que existir en el mapa real").toBeDefined();
    expect([door!.a, door!.b].sort()).toEqual(["pasillo-central", "puente"]);
    expect(runtime.blocksCell({ x: 5, y: 9 })).toBe(true);
  });

  it("las 10 puertas autoradas se dan de alta, ninguna se pierde en silencio", () => {
    const runtime = mount(plan);
    for (const seed of plan.doors) {
      const door = runtime.doorById(`instance:puerta-${seed.id}` as DoorId);
      expect(door, `puerta '${seed.id}' descartada`).toBeDefined();
      expect([door!.a, door!.b].sort()).toEqual([seed.a, seed.b].sort());
    }
  });
});
