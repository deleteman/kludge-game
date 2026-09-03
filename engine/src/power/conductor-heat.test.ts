import { describe, expect, it } from "vitest";
import {
  conductorHeatBySection,
  CONDUCTOR_HEAT_PARAMETERS,
  edgeHeatCelsiusPerSecond,
} from "./conductor-heat.js";
import { buildComponentCatalog } from "../components/catalog/build-component-catalog.js";
import { electricalConductorProperty } from "../signals/edge-conductor.js";
import { edgeElectricalLoad } from "./conductor-load.js";
import {
  CALIBRATION_SECTIONS,
  settledTemperature,
  simulateThermal,
} from "../atmosphere/thermal-calibration.fixture.js";
import {
  AUTOIGNITION_CELSIUS,
  NOMINAL_TEMPERATURE_CELSIUS,
  THERMAL_SENSOR_TRIGGER_CELSIUS,
} from "../atmosphere/thermal-parameters.js";
import type { Blueprint, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { ComponentId } from "../components/physical-component.types.js";
import type { SignalEdgeId } from "../signals/signal-edge.types.js";
import type { SignalNodeId } from "../signals/signal-node.types.js";
import type { SectionId } from "../atmosphere/section.types.js";

/**
 * Ronda 1 de playtest de 14a-3: el conductor como fuente de calor.
 *
 * Se corre contra el CATÁLOGO REAL: la regla depende de `COND.maxCapacity` y del
 * `CT` de cada material, y con definiciones sintéticas este test probaría su
 * propio fixture en vez de la relación entre las piezas que el jugador tiene
 * (el corolario reincidente del patrón 50).
 */

const REGISTRY = buildComponentCatalog().registry;
const SALA = "sala" as SectionId;
const VECINA = "vecina" as SectionId;
const FUENTE = "fuente-1" as PlacedComponentInstanceId;
const FUENTE_NODE = "fuente-1-em" as SignalNodeId;
const HUB = "chip-1" as PlacedComponentInstanceId;
const HUB_NODE = "chip-1-rec" as SignalNodeId;
const TRONCAL = "troncal" as SignalEdgeId;

/**
 * Monta el TRONCO real del proyecto: `fuente → cable troncal → relé (chip) → N
 * indicadores`, cada rama con su propio cable. Es la topología que 14a-4 ronda 2
 * volvió necesaria, y la única en la que un cable lleva más de un consumidor —
 * en estrella cada cable carga uno solo y el ratio queda clavado (patrón 67).
 *
 * Los consumidores son `indicador-led` (`powerDraw: 1`) y no compuertas (2)
 * porque es lo que el Capítulo 1 tiene EN STOCK: seis LEDs y un chip. Con
 * compuertas el fixture describiría un montaje que el jugador no puede armar, y
 * además —con el chip sumando 1— la carga salta de 5 a 7 y se pasa de la
 * capacidad del cable de cobre, o sea que mediría un tronco que se quema.
 */
function blueprintWith(conductorId: string, consumers: number): Blueprint {
  const ids = Array.from({ length: consumers }, (_, index) => index + 1);
  const place = (instanceId: string, componentDefinitionId: string, x: number) => ({
    instanceId: instanceId as PlacedComponentInstanceId,
    componentDefinitionId: componentDefinitionId as ComponentId,
    placement: { position: { x, y: 0 }, footprint: { width: 1, height: 1 }, rotation: 0 as const },
    condition: "ok" as const,
    wear: "nuevo" as const,
  });
  return {
    metadata: {
      schemaVersion: 5,
      id: "fixture",
      name: "Fixture",
      engineVersion: "0.0.0",
      createdAt: "2026-09-03T00:00:00.000Z",
      updatedAt: "2026-09-03T00:00:00.000Z",
    },
    placedComponents: [
      place(FUENTE, "fotorreceptor", 0),
      place(HUB, "chip-circuito-generico", 1),
      ...ids.map((n) => place(`led-${n}`, "indicador-led", n + 1)),
    ],
    reservoirContents: [],
    signalGraph: {
      nodes: [
        { id: FUENTE_NODE, role: "emitter", position: { x: 0, y: 0 }, ownerRef: FUENTE },
        { id: HUB_NODE, role: "receptor", position: { x: 1, y: 0 }, ownerRef: HUB },
        ...ids.map((n) => ({
          id: `led-${n}-rec` as SignalNodeId,
          role: "receptor" as const,
          position: { x: n + 1, y: 0 },
          ownerRef: `led-${n}` as PlacedComponentInstanceId,
        })),
      ],
      edges: [
        { id: TRONCAL, from: FUENTE_NODE, to: HUB_NODE, conductorId: conductorId as ComponentId },
        ...ids.map((n) => ({
          id: `rama-${n}` as SignalEdgeId,
          from: HUB_NODE,
          to: `led-${n}-rec` as SignalNodeId,
          conductorId: conductorId as ComponentId,
        })),
      ],
    },
    sectionAtmospheres: [],
    sectionIntegrity: [],
    unpoweredSectionIds: [],
    doorStates: [],
    valveApertures: [],
    overloadedRefs: [],
    powerState: {
      sectionAllocations: [],
      instancePriorities: [],
      permanentlyDisconnectedSectionIds: [],
      dischargedSourceIds: [],
    },
  };
}

describe("edgeHeatCelsiusPerSecond", () => {
  it("un tronco que solo alimenta al relé apenas calienta", () => {
    // El chip declara `powerDraw: 1`, así que "sin nada colgado" no es carga 0:
    // es la carga mínima real del catálogo. Lo que importa es que a esa carga el
    // aporte sea despreciable, no que sea exactamente cero.
    //
    // Se afirma sobre la TEMPERATURA y no sobre la tasa: la ronda 1 pedía
    // `< 0.1 °C/s`, un número que solo significaba algo con la constante de
    // entonces y que se volvió rojo al recalibrar sin que nada estuviera mal.
    // "Despreciable" quiere decir que la sala no se entera, y eso se mide.
    const blueprint = blueprintWith("cable-cobre", 0);
    const heat = edgeHeatCelsiusPerSecond(blueprint, TRONCAL, REGISTRY);
    expect(heat).toBeGreaterThan(0);
    expect(settledTemperature(CALIBRATION_SECTIONS.closedRoom, heat)).toBeLessThan(
      NOMINAL_TEMPERATURE_CELSIUS + 5,
    );
  });

  it("un cable cuyo conductor no declara `COND(E)` no calienta", () => {
    const blueprint = blueprintWith("junta-hermetica", 1);
    expect(edgeHeatCelsiusPerSecond(blueprint, TRONCAL, REGISTRY)).toBe(0);
  });

  it("a IGUAL carga, la resistencia eléctrica calienta un orden de magnitud más que la fibra", () => {
    // La consecuencia que el jugador puede intuir sin conocer la fórmula, y sale
    // de sus DATOS, no de una tabla que las nombre. Se acumulan los dos factores
    // y por eso la diferencia es tan grande: la resistencia tiene un cuarto de
    // la capacidad (3 contra 12) **y** `CT: "A"` contra `CT: "B"` de la fibra,
    // que además aísla. Elegir fibra para no calentar la sala es una decisión
    // coherente con lo que ese mismo `CT` hace en `thermalConductivityRule`.
    const resistencia = edgeHeatCelsiusPerSecond(
      blueprintWith("resistencia-electrica", 1),
      TRONCAL,
      REGISTRY,
    );
    const fibra = edgeHeatCelsiusPerSecond(
      blueprintWith("cable-fibra-optica", 1),
      TRONCAL,
      REGISTRY,
    );
    expect(fibra).toBeGreaterThan(0);
    expect(resistencia / fibra).toBeGreaterThan(10);
  });

  it("un cable quemado no conduce y por lo tanto no calienta", () => {
    const blueprint = blueprintWith("cable-cobre", 1);
    const burned: Blueprint = { ...blueprint, overloadedRefs: [TRONCAL] };
    expect(edgeHeatCelsiusPerSecond(blueprint, TRONCAL, REGISTRY)).toBeGreaterThan(0);
    expect(edgeHeatCelsiusPerSecond(burned, TRONCAL, REGISTRY)).toBe(0);
  });

  it("un conductor AISLADO entrega menos calor a la sala que uno que conduce", () => {
    // `CT` es el mismo dato que en `thermalConductivityRule` decide cuándo el
    // cable pierde capacidad: las dos consecuencias apuntan al mismo lado.
    const { transferByThermalConductivity } = CONDUCTOR_HEAT_PARAMETERS;
    expect(transferByThermalConductivity.B).toBeLessThan(transferByThermalConductivity.A);
  });
});

describe("calibración contra los umbrales que ya existen (patrón 23/81)", () => {
  /**
   * Todo el cableado de un montaje, agregado en la sala donde vive.
   *
   * De acá para abajo, todo aserto de TEMPERATURA pasa por
   * `thermal-calibration.fixture.ts`, que simula el eje térmico completo sobre la
   * nave canónica con sus conductos y sus puertas. La ronda 1 de este archivo
   * usaba un helper `equilibrium()` con la cuenta analítica
   * `21 + R / PASSIVE_DRIFT_PER_SECOND`, que ignora la conducción a las vecinas
   * y prometía 82 °C donde el juego daba 43. Ese helper **no se reescribe**: el
   * fixture es ahora la única forma de convertir una tasa en una temperatura.
   */
  const montageHeat = (consumers: number, conductorId = "cable-cobre") =>
    conductorHeatBySection(blueprintWith(conductorId, consumers), REGISTRY, () => [SALA]).get(
      SALA,
    ) ?? 0;

  /**
   * El montaje de referencia: cinco LEDs detrás de un relé. Con el chip, el
   * tronco lleva **exactamente 6**, la capacidad del `cable-cobre`.
   *
   * Que sea exactamente la capacidad y no más es la mitad del punto: `OverloadRule`
   * corta con `load > capacity`, así que un tronco de 7 se quema y deja de
   * conducir — y de calentar. Calibrar contra un montaje que se quema habría dado
   * un número bonito sobre un escenario que en partida dura un tick.
   */
  const FULL_TRUNK_CONSUMERS = 5;

  it("el montaje de referencia carga el tronco al límite SIN pasarse (o no habría nada que medir)", () => {
    const blueprint = blueprintWith("cable-cobre", FULL_TRUNK_CONSUMERS);
    const capacity = electricalConductorProperty(
      REGISTRY.get("cable-cobre" as ComponentId),
    )!.maxCapacity;
    expect(edgeElectricalLoad(blueprint, TRONCAL, REGISTRY)).toBe(capacity);
  });

  it("un tronco de cobre al límite deja la sala con vapor inflamable y SIN encender sola", () => {
    const settled = settledTemperature(
      CALIBRATION_SECTIONS.closedRoom,
      montageHeat(FULL_TRUNK_CONSUMERS),
    );
    // Por encima de los 75 °C de ebullición del combustible de motor (y de los
    // 56 del disolvente): hay vapor en el aire, o sea algo que puede arder.
    expect(settled).toBeGreaterThan(75);
    // Y por debajo de la autoignición: el jugador tiene el vapor y sigue
    // eligiendo cuándo prenderlo. Si este aserto cayera, la franja donde la
    // chispa importa habría desaparecido y el charco ardería solo.
    expect(settled).toBeLessThan(AUTOIGNITION_CELSIUS);
  });

  it("NINGUNA sala de la nave enciende sola con un solo montaje", () => {
    // El aserto anterior sobre la sala más fácil de calentar no alcanza: el techo
    // lo pone la sala más DIFÍCIL de ventilar, y si alguna cruzara el umbral, la
    // promesa "vos elegís cuándo prender" sería falsa justo donde el jugador
    // guarda las cosas inflamables. La bodega (60 celdas, 4 conexiones) llega a
    // 89.2 °C: pasa raspando, y por eso se afirma sobre TODA la nave y no sobre
    // una sala elegida.
    const heat = montageHeat(FULL_TRUNK_CONSUMERS);
    for (const sectionId of Object.values(CALIBRATION_SECTIONS)) {
      expect(settledTemperature(sectionId, heat)).toBeLessThan(AUTOIGNITION_CELSIUS);
    }
  });

  it("DOS montajes cargados en la misma sala la llevan a encender sola", () => {
    // La propagación pide un montaje deliberado, no un accidente: es la presión
    // aguas arriba que el patrón 69 exige para que la mecánica no quede muerta.
    const double = montageHeat(FULL_TRUNK_CONSUMERS) * 2;
    for (const sectionId of Object.values(CALIBRATION_SECTIONS)) {
      expect(settledTemperature(sectionId, double)).toBeGreaterThan(AUTOIGNITION_CELSIUS);
    }
  });

  it("la TOPOLOGÍA de la sala cambia el resultado: el pasillo es un disipador", () => {
    // No es dispersión de la calibración, es la consecuencia jugable de
    // `MIN_THERMAL_APERTURE`: compartimentar sirve. El mismo montaje deja una
    // sala cerrada con vapor inflamable y el pasillo central —16 conexiones— sin
    // llegar siquiera al umbral del sensor térmico.
    const heat = montageHeat(FULL_TRUNK_CONSUMERS);
    expect(settledTemperature(CALIBRATION_SECTIONS.corridor, heat)).toBeLessThan(
      settledTemperature(CALIBRATION_SECTIONS.closedRoom, heat),
    );
    expect(settledTemperature(CALIBRATION_SECTIONS.corridor, heat)).toBeLessThan(
      THERMAL_SENSOR_TRIGGER_CELSIUS,
    );
  });

  it("el cableado corriente NO dispara nada: una pieza cableada deja la sala lejos del sensor", () => {
    // Sube algo (hay corriente pasando) pero se queda MUY por debajo de los
    // 60 °C del sensor térmico y de los 56 de la ebullición más baja. Sin este
    // piso, cablear cualquier cosa sería un impuesto térmico invisible sobre
    // toda la nave y el sensor daría falsas alarmas por el cableado normal.
    expect(
      settledTemperature(CALIBRATION_SECTIONS.closedRoom, montageHeat(1)),
    ).toBeLessThan(THERMAL_SENSOR_TRIGGER_CELSIUS);
  });

  it("con la MISMA carga, un tronco de resistencia calienta más que uno de cobre", () => {
    // La comparación honesta es a igual carga. En su PROPIO límite el cobre
    // calienta más que la resistencia, porque lleva el doble de corriente: el
    // papel de la resistencia no es "el calefactor", es que llega a estar
    // caliente con la mitad de consumidores colgados.
    expect(montageHeat(2, "resistencia-electrica")).toBeGreaterThan(montageHeat(2));
  });
});

describe("conductorHeatBySection", () => {
  it("un cable que cruza dos secciones REPARTE su calor entre ellas", () => {
    // Si no repartiera, tender un tronco largo sería la forma más eficiente de
    // calentar la nave entera — lo contrario de lo que el modelo dice.
    const blueprint = blueprintWith("cable-cobre", 1);
    const solo = conductorHeatBySection(blueprint, REGISTRY, () => [SALA]);
    const cruzando = conductorHeatBySection(blueprint, REGISTRY, () => [SALA, VECINA]);
    expect(cruzando.get(SALA)).toBeCloseTo(solo.get(SALA)! / 2, 6);
    expect(cruzando.get(VECINA)).toBeCloseTo(cruzando.get(SALA)!, 6);
  });

  it("una arista sin sección resuelta no aporta a ninguna", () => {
    const blueprint = blueprintWith("cable-cobre", 1);
    expect(conductorHeatBySection(blueprint, REGISTRY, () => []).size).toBe(0);
  });
});

describe("integración: el calor del cableado llega de verdad a la atmósfera", () => {
  /**
   * La regla puede estar bien y no llegar a ningún lado: `conductorHeatBySection`
   * se consume a través de `MissionThermalRuntime`, y afirmar cómo se comporta
   * sin verificar quién lo INVOCA es el patrón 74.
   *
   * **Este test ya existía en la ronda 1 y no alcanzó.** Montaba la pareja real
   * —térmico + atmósfera— a cadencia de frame y leía el equilibrio de la
   * simulación… sobre un `ShipFloorplan` de UNA sección con `conduits: []`. En
   * una nave de una sola sala sin vecinas, la fórmula analítica que se quería
   * desmentir es exacta, así que el test la confirmaba en vez de contradecirla y
   * la calibración salió al playtest con el doble del error. Ahora la topología
   * la pone `thermal-calibration.fixture.ts`, que simula la nave canónica entera.
   */
  it("un tronco cargado sostiene la sala por encima del punto de ebullición", () => {
    const blueprint = blueprintWith("cable-cobre", 5);
    const heatBySection = conductorHeatBySection(blueprint, REGISTRY, () => [
      CALIBRATION_SECTIONS.closedRoom,
    ]);

    const settled = simulateThermal({
      sectionId: CALIBRATION_SECTIONS.closedRoom,
      sustainedCelsiusPerSecond: heatBySection.get(CALIBRATION_SECTIONS.closedRoom) ?? 0,
    }).settled;

    expect(settled).toBeGreaterThan(75);
    expect(settled).toBeLessThan(AUTOIGNITION_CELSIUS);
  });
});
