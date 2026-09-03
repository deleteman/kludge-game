import type { CombustionIntensity } from "../chemistry/reaction/reaction-events.types.js";
import type { ReactionDomainEvent } from "../chemistry/reaction/reaction-events.types.js";
import type { FailureDomainEvent, FailureMode } from "../failure/failure-events.types.js";
import type { SectionId } from "./section.types.js";
import { CANONICAL_SHIP_FLOORPLANS } from "../floorplan/canonical-ships.js";
import { EventEmitter } from "../simulation/event-emitter.js";
import { MissionAtmosphereRuntime } from "../mission/mission-atmosphere-runtime.js";
import { MissionThermalRuntime } from "../mission/mission-thermal-runtime.js";
import { composeApertureSources } from "../mission/composite-aperture-source.js";
import { ValveRuntime } from "../valves/valve-runtime.js";

/**
 * Banco de calibración del eje térmico. **Solo lo consumen tests** — no se
 * exporta desde `index.ts` y nada de `/game` lo importa.
 *
 * ## Por qué existe (ronda 2 de playtest de 14a-3)
 *
 * Todos los números del eje térmico se habían calibrado resolviendo a mano el
 * equilibrio contra la deriva pasiva:
 *
 * ```
 * T = NOMINAL + R / PASSIVE_DRIFT_PER_SECOND        // ← MAL
 * ```
 *
 * Esa cuenta **ignora la conducción entre secciones**, y `diffuse()` sangra
 * calor a cada vecina a `THERMAL_DIFFUSION_RATE_PER_SECOND` (0.15), el **triple**
 * de la deriva pasiva, con piso `MIN_THERMAL_APERTURE` para que cerrar la puerta
 * no aísle. Encima, en la nave real cada par de secciones está conectado DOS
 * veces —un ducto de ventilación y una puerta, concatenados a propósito por
 * `composeApertureSources`—, así que cada par equilibra dos veces por tick.
 *
 * El resultado fue cinco números mal calibrados en tres subfases: el calor del
 * cableado prometía 82 °C y daba 43, la tecla de dev nunca llegaba a su consigna,
 * el enfriador prometía -69 °C y daba -10.8 (dejando inalcanzable el umbral frío
 * que ese mismo docblock se felicitaba por haber hecho alcanzable), y los picos
 * de combustión citados en dos docblocks estaban un 50% arriba de los reales.
 *
 * **Y sí se había "medido".** El test de integración de la ronda 1 montaba la
 * pila real a cadencia de frame y leía el equilibrio de la simulación… en un
 * `ShipFloorplan` de UNA sección con `conduits: []`. En ese mundo la fórmula es
 * exacta. Lo mismo `thermal-coupling.integration.test.ts` y `case-02`: una caja
 * aislada no puede contradecir la cuenta que olvida las vecinas.
 *
 * ## Qué garantiza
 *
 * Se simula sobre la **nave canónica real**, con sus conductos y sus puertas,
 * porque un fixture sintético vuelve a poder ser más simple que el juego — que es
 * exactamente el error que este módulo existe para cerrar. La nave se lee de
 * `CANONICAL_SHIP_FLOORPLANS`, así que si mañana alguien reautora el mapa en
 * Tiled y cambia la topología, los tests de calibración se enteran.
 *
 * Las puertas se modelan **cerradas** (`initialOpen: false` es el default del
 * plano: "la nave arranca compartimentada"), que además es el caso conservador —
 * abiertas conducen más y el equilibrio quedaría más bajo todavía.
 */

/** dt de FRAME y no de 1 tick = 1 s: una tasa continua que pasa por la resolución del tick es donde vive el patrón 25. */
const FRAME_SECONDS = 1 / 60;

/**
 * Cuánto se simula por defecto. La deriva pasiva disipa la mitad del exceso en
 * ~14 s, así que 600 s son más de 40 semividas: lo que se lee es equilibrio, no
 * un transitorio.
 */
const DEFAULT_SECONDS = 600;

/**
 * Las secciones de `nave-exploracion` que importan para calibrar, elegidas por
 * su TOPOLOGÍA y no por su nombre — es la topología la que decide cuánto calor
 * retiene una sala:
 *
 *  - `closedRoom`: taller (20 celdas, una sola vecina). La sala que más se
 *    calienta con menos: el caso donde el jugador va a montar el circuito.
 *  - `corridor`: pasillo central (54 celdas, **16** conexiones). El disipador de
 *    la nave: calentarlo es casi imposible, y eso es diseño, no un defecto.
 *  - `largeHold`: bodega de carga (60 celdas, 4 conexiones). Grande y mal
 *    ventilada, así que es la que más alto llega — el techo de cualquier aserto
 *    del tipo "ningún montaje solo debe cruzar este umbral".
 */
export const CALIBRATION_SECTIONS = {
  closedRoom: "taller" as SectionId,
  corridor: "pasillo-central" as SectionId,
  largeHold: "bodega-carga" as SectionId,
} as const;

export interface ThermalCalibrationRun {
  /** Sección donde ocurre todo: la fuente sostenida y el pulso. */
  readonly sectionId: SectionId;
  /** Aporte CONTINUO en °C/s, del signo que sea (un cable calienta, un enfriador enfría). */
  readonly sustainedCelsiusPerSecond?: number;
  /** Combustión a emitir en t=0, por el mismo emisor de eventos que en producción. */
  readonly combustion?: CombustionIntensity;
  /** Sobrecarga a emitir en t=0. Solo `fire` y `explosion` liberan calor (`OVERLOAD_HEAT`). */
  readonly overload?: FailureMode;
  readonly seconds?: number;
}

export interface ThermalCalibrationResult {
  /** Temperatura de la sección al final de la corrida: el EQUILIBRIO. */
  readonly settled: number;
  /** Máximo que alcanzó la sección en toda la corrida: el PICO de un pulso. */
  readonly peak: number;
  /** Pico de la vecina más caliente. Es lo que decide si un fenómeno se PROPAGA. */
  readonly neighbourPeak: number;
  /** Equilibrio de cualquier otra sección, para afirmar el reparto del calor. */
  settledOf(sectionId: SectionId): number;
}

/**
 * Corre el eje térmico completo —`MissionThermalRuntime` + `MissionAtmosphereRuntime`,
 * con las válvulas y las puertas de la nave real— y devuelve lo que de verdad
 * pasa con la temperatura.
 *
 * Los pulsos se inyectan **emitiendo el evento de dominio**, no llamando a un
 * método interno: `MissionThermalRuntime` traduce evento → °C/s con su propia
 * tabla, y saltarse esa traducción sería medir otra cosa que la que corre en
 * partida.
 */
export function simulateThermal(run: ThermalCalibrationRun): ThermalCalibrationResult {
  const floorplan = CANONICAL_SHIP_FLOORPLANS.exploracion;
  const reactionEvents = new EventEmitter<ReactionDomainEvent>();
  const failureEvents = new EventEmitter<FailureDomainEvent>();
  const sustained = new Map<SectionId, number>(
    run.sustainedCelsiusPerSecond === undefined || run.sustainedCelsiusPerSecond === 0
      ? []
      : [[run.sectionId, run.sustainedCelsiusPerSecond]],
  );

  const thermal = new MissionThermalRuntime(
    reactionEvents,
    failureEvents,
    undefined,
    () => sustained,
  );
  const valves = new ValveRuntime(floorplan);
  const atmosphere = new MissionAtmosphereRuntime(
    floorplan,
    [],
    undefined,
    undefined,
    undefined,
    // Las MISMAS dos fuentes concatenadas que en producción: ducto y puerta son
    // dos caminos distintos entre el mismo par, y el calor pasa por los dos.
    composeApertureSources(
      () => valves.effectiveConnections(),
      () =>
        floorplan.doors.map((door) => ({
          a: door.a,
          b: door.b,
          valveAperture: door.initialOpen ? 1 : 0,
        })),
    ),
    () => thermal.rates(),
  );

  // Los campos que `MissionThermalRuntime` no lee van con su valor neutro y no
  // con un cast: si mañana el evento gana un campo que sí importe para el calor,
  // el compilador lo dice acá en vez de dejar el fixture midiendo otra cosa.
  if (run.combustion) {
    reactionEvents.emit({
      kind: "combustion",
      elapsedSeconds: 0,
      intensity: run.combustion,
      radius: "full-section",
      crewDamage: "none",
      sectionId: run.sectionId,
    });
  }
  if (run.overload) {
    failureEvents.emit({
      kind: "overload",
      elapsedSeconds: 0,
      ref: "calibracion",
      resourceType: "E",
      failureMode: run.overload,
      capacity: 0,
      load: 0,
      sectionId: run.sectionId,
    });
  }

  let peak = Number.NEGATIVE_INFINITY;
  const neighbourPeaks = new Map<SectionId, number>();
  const frames = Math.round((run.seconds ?? DEFAULT_SECONDS) / FRAME_SECONDS);
  for (let frame = 0; frame < frames; frame += 1) {
    const ctx = { dtSeconds: FRAME_SECONDS, elapsedSeconds: frame * FRAME_SECONDS };
    thermal.tick(ctx);
    atmosphere.tick(ctx);
    for (const section of floorplan.sections) {
      const temperature = atmosphere.atmosphereOf(section.id)!.temperatureCelsius;
      if (section.id === run.sectionId) {
        peak = Math.max(peak, temperature);
      } else {
        neighbourPeaks.set(section.id, Math.max(neighbourPeaks.get(section.id) ?? -Infinity, temperature));
      }
    }
  }

  const settledOf = (sectionId: SectionId): number =>
    atmosphere.atmosphereOf(sectionId)?.temperatureCelsius ?? Number.NaN;
  return {
    settled: settledOf(run.sectionId),
    peak,
    neighbourPeak: Math.max(...neighbourPeaks.values()),
    settledOf,
  };
}

/** Atajo para el caso más común: equilibrio de una sección con una fuente continua. */
export function settledTemperature(
  sectionId: SectionId,
  sustainedCelsiusPerSecond: number,
): number {
  return simulateThermal({ sectionId, sustainedCelsiusPerSecond }).settled;
}
