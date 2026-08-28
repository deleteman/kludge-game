import { describe, expect, it } from "vitest";
import {
  GAS,
  MissionAtmosphereRuntime,
  MissionDoorRuntime,
  buildComponentCatalog,
  instantiateDoorSeeds,
  ValveRuntime,
  composeApertureSources,
  type ConduitId,
  type DoorId,
  type DoorSeedId,
  type GridPosition,
  type ShipFloorplan,
} from "../index.js";
import type { SectionId } from "../atmosphere/section.types.js";

/**
 * Integración de la Subfase 13h: la compartimentación por defecto y su
 * interacción con la brecha de 13f.
 *
 * Monta el sistema REAL —`MissionAtmosphereRuntime` con la
 * `SectionApertureSource` compuesta de válvulas + puertas— y no un doble: lo
 * que se está probando es justamente que esas tres piezas compongan.
 */
const ROTA = "seccion-rota" as SectionId;
const VECINA = "seccion-vecina" as SectionId;
const THRESHOLD: GridPosition = { x: 1, y: 0 };
const DOOR = "instance:puerta-rota-vecina" as DoorId;
const VALVE = "ventilacion:seccion-rota:seccion-vecina:0" as ConduitId;
const REGISTRY = buildComponentCatalog().registry;

function floorplan(withConduit: boolean): ShipFloorplan {
  return {
    id: "nave-13h",
    archetype: "exploracion",
    nameKey: "ship.test",
    gridSize: { width: 4, height: 1 },
    sections: [
      { id: ROTA, nameKey: "section.rota", cells: [{ x: 0, y: 0 }, THRESHOLD] },
      { id: VECINA, nameKey: "section.vecina", cells: [{ x: 2, y: 0 }, { x: 3, y: 0 }] },
    ],
    conduits: withConduit
      ? [
          {
            id: VALVE,
            a: ROTA,
            b: VECINA,
            kind: "ventilacion",
            position: { x: 1.5, y: 0 },
            initialAperture: 1,
          },
        ]
      : [],
    anchors: [],
    componentSeeds: [],
    doors: [
      { id: "rota-vecina" as DoorSeedId, a: ROTA, b: VECINA, position: THRESHOLD, span: 1, axis: "x", initialOpen: false },
    ],
  };
}

/**
 * Monta atmósfera + puertas + válvulas como en producción. `occupied` es
 * mutable para poder "mandar un tripulante" a mitad del escenario.
 */
function mount(withConduit: boolean) {
  const plan = floorplan(withConduit);
  const occupied: GridPosition[] = [];
  const doors = new MissionDoorRuntime({
    floorplan: plan,
    queries: { occupiedCells: () => occupied },
    resolveDefinition: (id) => REGISTRY.get(id),
  });
  // Ronda 1 de playtest de 13h: la puerta del casco es una INSTANCIA real, y el
  // runtime la recoge por el mismo camino que una instalada por el jugador.
  doors.syncInstalledDoors(instantiateDoorSeeds(plan.doors, REGISTRY).components);
  const valves = new ValveRuntime(plan);
  const atmosphere = new MissionAtmosphereRuntime(
    plan,
    [
      // La sección rota está al vacío; la vecina, con aire respirable. La
      // pregunta del escenario es si la vecina se contagia.
      { sectionId: ROTA, gases: [], temperatureCelsius: 21, pressureKpa: 0 },
      {
        sectionId: VECINA,
        gases: [[GAS.OXYGEN, 0.21]],
        temperatureCelsius: 21,
        pressureKpa: 101,
      },
    ],
    undefined,
    undefined,
    undefined,
    composeApertureSources(() => valves.effectiveConnections(), doors.apertureSource()),
  );

  const run = (seconds: number, from = 0): number => {
    let elapsed = from;
    for (let step = 0; step < Math.round(seconds / 0.5); step += 1) {
      elapsed += 0.5;
      doors.tick({ dtSeconds: 0.5, elapsedSeconds: elapsed });
      atmosphere.tick({ dtSeconds: 0.5, elapsedSeconds: elapsed });
    }
    return elapsed;
  };

  const o2 = (section: SectionId) => atmosphere.atmosphereOf(section)?.gases.get(GAS.OXYGEN) ?? 0;

  return { doors, valves, atmosphere, occupied, run, o2 };
}

describe("13h — compartimentación por defecto (integración)", () => {
  it("con la puerta cerrada la sección vecina NO pierde su atmósfera", () => {
    const { run, o2 } = mount(false);
    run(60);
    // La vecina conserva su O2 íntegro: la puerta cerrada la aisló de la sala
    // al vacío sin que el jugador hiciera nada. Esto es la propiedad central
    // de la subfase — emergente del default, no scripteada.
    expect(o2(VECINA)).toBeCloseTo(0.21);
    expect(o2(ROTA)).toBe(0);
  });

  it("mandar un tripulante a la sección rota abre la puerta y la vecina empieza a perder aire", () => {
    const { run, o2, occupied, doors } = mount(false);
    run(20);
    expect(o2(VECINA)).toBeCloseTo(0.21);

    // El jugador manda a alguien a la sala rota: la puerta se le abre.
    occupied.push({ x: 2, y: 0 });
    run(40, 20);

    expect(doors.doorById(DOOR)?.state).toBe("open");
    expect(o2(VECINA)).toBeLessThan(0.21);
    // El aire va HACIA la sala vacía: se equilibra, no desaparece.
    expect(o2(ROTA)).toBeGreaterThan(0);
  });

  it("la puerta cerrada NO cierra el ducto: hace falta también cerrar la válvula", () => {
    // Es la consecuencia directa de que puerta y conducto sean aristas
    // independientes. Media medida no contiene la fuga.
    const conPuertaSola = mount(true);
    conPuertaSola.run(60);
    expect(conPuertaSola.o2(VECINA)).toBeLessThan(0.21);

    const conAmbas = mount(true);
    conAmbas.valves.setAperture(VALVE, 0);
    conAmbas.run(60);
    expect(conAmbas.o2(VECINA)).toBeCloseTo(0.21);
  });

  it("una puerta rota deja de compartimentar para siempre", () => {
    const { doors, run, o2 } = mount(false);
    doors.applyDamage(DOOR, 1000, 1);
    run(60);
    expect(o2(VECINA)).toBeLessThan(0.21);
  });

  it("sin fuente de apertura inyectada, la difusión es idéntica a antes de 13h", () => {
    // Garantía del patrón de fuente opcional: un runtime construido sin
    // `SectionApertureSource` sigue difundiendo por las conexiones del plano.
    const plan = floorplan(true);
    const atmosphere = new MissionAtmosphereRuntime(plan, [
      { sectionId: ROTA, gases: [], temperatureCelsius: 21, pressureKpa: 0 },
      { sectionId: VECINA, gases: [[GAS.OXYGEN, 0.21]], temperatureCelsius: 21, pressureKpa: 101 },
    ]);
    for (let step = 0; step < 120; step += 1) {
      atmosphere.tick({ dtSeconds: 0.5, elapsedSeconds: (step + 1) * 0.5 });
    }
    expect(atmosphere.atmosphereOf(VECINA)?.gases.get(GAS.OXYGEN)).toBeLessThan(0.21);
  });

  // Ronda 1 de playtest, reporte #4: "al provocar una brecha en una zona
  // cerrada y abrir sus puertas, la presión no baja en la zona conectada".
  // Tenía razón y la causa era de fondo — `diffuse()` movía fracciones de gas
  // pero nunca tocaba `pressureKpa`.
  it("la PRESIÓN se propaga por la puerta abierta, no solo el gas", () => {
    const { run, doors, occupied, atmosphere } = mount(false);
    const vecinaAlInicio = atmosphere.atmosphereOf(VECINA)?.pressureKpa ?? 0;

    run(20);
    // Con la puerta cerrada la vecina conserva su presión intacta.
    expect(atmosphere.atmosphereOf(VECINA)?.pressureKpa).toBeCloseTo(vecinaAlInicio);

    occupied.push({ x: 2, y: 0 });
    run(60, 20);

    expect(doors.doorById(DOOR)?.state).toBe("open");
    expect(atmosphere.atmosphereOf(VECINA)?.pressureKpa).toBeLessThan(vecinaAlInicio);
  });

  it("la presión NO se propaga por una puerta cerrada aunque el gas ya se haya mezclado antes", () => {
    const { run, occupied, atmosphere } = mount(false);
    occupied.push({ x: 2, y: 0 });
    run(30);
    const conPuertaAbierta = atmosphere.atmosphereOf(VECINA)?.pressureKpa ?? 0;

    // Se va el tripulante: la puerta se cierra sola y la caída se detiene
    // donde estaba. Es lo que hace que cerrar sea una decisión con efecto.
    occupied.length = 0;
    run(10, 30);
    const trasCerrar = atmosphere.atmosphereOf(VECINA)?.pressureKpa ?? 0;
    run(60, 40);

    expect(atmosphere.atmosphereOf(VECINA)?.pressureKpa).toBeCloseTo(trasCerrar, 1);
    expect(trasCerrar).toBeLessThan(conPuertaAbierta);
  });
});
