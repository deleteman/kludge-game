/**
 * Inyección de sustancias en la atmósfera de una sección (Subfase 13e).
 *
 * Cierra un hueco de motor anotado desde 13a y desde
 * `mission-structural-runtime.ts`: TODO el camino LECTOR de contaminantes
 * atmosféricos ya existía —`MissionRuntime.contaminantAt`,
 * `sectionCorrosiveLevel`, `HazardousAtmosphereHazardRule`— pero NINGUNA
 * fuente real insertaba jamás un `ChemicalSubstanceId` en `atmosphere.gases`.
 * Solo lo hacían los tests. Este módulo es ese escritor.
 *
 * La convención de dato ya estaba lista y no se cambia (`GasKey = string`, con
 * `O2`/`N2`/`CO2` fijos y cualquier otra clave = id de sustancia,
 * `atmosphere/atmosphere-composition.types.ts`): aplicar un neutralizante o
 * derramar un tóxico usan exactamente la misma vía.
 *
 * Patrón de inyección idéntico a `SectionPressureSinkSource`: el runtime de
 * atmósfera no sabe POR QUÉ entra un gas (un tripulante volcando un bidón, un
 * derrame al desmontar), solo aplica lo que el mundo le da este tick.
 */

import type {
  ChemicalSubstanceDefinition,
  ChemicalSubstanceId,
} from "../chemistry/chemical-substance.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import { NOMINAL_TEMPERATURE_CELSIUS } from "../atmosphere/thermal-parameters.js";
import { effectiveMatterState, nominalStateOf } from "../chemistry/phase/matter-state.js";

/** Fracción de gas a AÑADIR por sección y sustancia en este tick. */
export type SectionGasInjectionSource = () => ReadonlyMap<
  SectionId,
  ReadonlyMap<ChemicalSubstanceId, number>
>;

/**
 * Fracción de volumen que aporta una unidad de sustancia vertida **por unidad
 * de volumen de la sección**. Ajustable con el balanceo de la Fase 23.
 *
 * Ronda 3 de fixes de playtest: antes era la fracción absoluta por unidad, sin
 * dividir por el volumen, así que 50 unidades llenaban CUALQUIER sección al
 * 100% — desmontar un reservorio de 100 dejaba el O2 en cero y disparaba la
 * alerta de soporte vital. Además de ser injugable, incumplía
 * `docs/Especificacion_datos_tecnicos.md` §4, que dice explícitamente que "el
 * % se calcula sobre el volumen total, no un valor fijo". El valor se recalibró
 * al pasar a dividirse: con una sección típica (~20 celdas) un reservorio de
 * 100 unidades de gas satura de forma perceptible sin asfixiar la nave.
 */
export const GAS_FRACTION_PER_SUBSTANCE_UNIT = 0.2;

/**
 * ¿Esta sustancia puede estar EN EL AIRE? (ronda 3 de fixes de playtest).
 *
 * Hasta acá cualquier sustancia vertida o derramada se convertía en atmósfera y
 * desplazaba oxígeno, así que un tanque de agua asfixiaba una sala igual que un
 * tóxico. El discriminador NO es el tag `VOLAT` — ese solo alimenta las reglas
 * de combustión/ignición y lo llevan apenas 4 sustancias, con estados G/S/L/L.
 * El dato correcto ya existía y lo declaran todas las entradas de ambos
 * catálogos: `ChemicalSubstanceData.state`.
 *
 * Un gas va al aire por definición; un líquido volátil se evapora. Todo lo
 * demás (el agua, `state: "L"` + `INERTE`) queda como charco en el piso — que
 * ya tiene su representación visual y su aviso de derrame desde 13d/13e, así
 * que "no afecta la atmósfera" no significa "no pasa nada".
 *
 * **Subfase 14a-3: el estado se DERIVA de la temperatura de la sección.** El
 * campo de catálogo describe a la sustancia dentro de un contenedor sellado; lo
 * que decide dónde termina un derrame es dónde cae. Sin temperatura (llamadores
 * viejos, tests unitarios previos) se evalúa al nominal de la nave.
 *
 * Y con eso **cae la segunda vía por tag `VOLAT`**, que estaba acá desde 13e
 * como sustituto de los puntos de ebullición que no existían: "un líquido
 * volátil se evapora" era una heurística, y ahora hay dato. Mantenerla habría
 * dejado al combustible y al disolvente permanentemente en el aire —o sea
 * inflamables a 21 °C, sin que calentar la sala cambiara nada—, que es
 * exactamente la mecánica que esta subfase construye. Lo volátil se autora
 * ahora como lo que es: un punto de ebullición bajo (disolvente 56 °C,
 * combustible 75 °C). El tag sigue vivo y sigue significando lo mismo para las
 * reglas de combustión e ignición espontánea, que es donde el GDD lo usa.
 */
export function isAirborneSubstance(
  substance: ChemicalSubstanceDefinition | undefined,
  temperatureCelsius: number = NOMINAL_TEMPERATURE_CELSIUS,
): boolean {
  if (!substance) {
    return false;
  }
  return effectiveMatterState(substance, temperatureCelsius) === "G";
}

/**
 * ¿Este derrame se EVAPORÓ, o sea pasó al aire por temperatura y no porque ya
 * fuera un gas? (14a-3).
 *
 * Es la pregunta que separa "verter un gas comprimido" de "el charco hirvió", y
 * la que consume la expansión de presión: soltar un gas en una sala no genera
 * expansión, un líquido pasando a gas sí (GDD §5.6).
 */
export function hasEvaporated(
  substance: ChemicalSubstanceDefinition | undefined,
  temperatureCelsius: number,
): boolean {
  if (!substance) {
    return false;
  }
  return (
    nominalStateOf(substance) !== "G" && effectiveMatterState(substance, temperatureCelsius) === "G"
  );
}

/**
 * Dependencias del mundo que la inyección necesita para decidir. Se inyectan en
 * vez de importarse porque `/engine` nunca importa catálogos ni planos: los
 * recibe (mismo criterio que `SubstanceFlowDeps` o `SalvageHazardDeps`).
 */
export interface GasInjectionDeps {
  /** Definición de la sustancia, para leer su estado de materia y sus tags. */
  readonly substanceOf?: (substanceId: ChemicalSubstanceId) => ChemicalSubstanceDefinition | undefined;
  /** Volumen de la sección receptora (`sectionArea`), para escalar la fracción. */
  readonly sectionVolumeOf?: (sectionId: SectionId) => number | undefined;
  /**
   * Efecto térmico del derrame (Subfase 14a-2). Se avisa SIEMPRE, sea la
   * sustancia aérea o no: un criogénico enfría la sala aunque quede como charco
   * en el piso y no desplace oxígeno. Antes de 14a-2 verter nitrógeno líquido no
   * hacía absolutamente nada — se descartaba acá en silencio.
   */
  readonly onSpill?: (sectionId: SectionId, substanceId: ChemicalSubstanceId, amount: number) => void;
  /**
   * Temperatura de la sección receptora (Subfase 14a-3), para derivar el estado
   * de la sustancia al caer. Sin ella se usa el nominal de la nave y el destino
   * del derrame se decide como antes de 14a-3.
   */
  readonly sectionTemperatureOf?: (sectionId: SectionId) => number | undefined;
  /**
   * El derrame se EVAPORÓ al caer (14a-3): pasó de líquido/sólido a gas por la
   * temperatura de la sala. Separado de `onSpill` porque son dos consumidores
   * distintos —el térmico enfría igual haya evaporado o no, la expansión de
   * presión solo aplica si hubo cambio de estado— y porque un gas vertido tal
   * cual no es una evaporación.
   */
  readonly onEvaporate?: (
    sectionId: SectionId,
    substanceId: ChemicalSubstanceId,
    amount: number,
  ) => void;
}

/**
 * Buffer de inyecciones puntuales, consumido y vaciado por tick — mismo molde
 * que `TransientLeakPressureSink` (`salvage/transient-pressure-sink.ts`).
 *
 * "Puntual" y no sostenido a propósito: verter un bidón es un evento discreto.
 * Lo que persiste después es el gas ya presente en la atmósfera, que difunde y
 * se lee solo; no hace falta que la fuente siga emitiendo.
 */
export class TransientGasInjection {
  private pending = new Map<SectionId, Map<ChemicalSubstanceId, number>>();

  /**
   * Sin dependencias se comporta como antes de la ronda 3 (toda sustancia es
   * aérea, volumen 1): los tests unitarios previos siguen valiendo y ningún
   * llamador queda obligado a cablearlas. La misión real sí las pasa.
   */
  constructor(private readonly deps: GasInjectionDeps = {}) {}

  /**
   * Encola `amount` unidades de sustancia sobre una sección. Una sustancia que
   * no puede estar en el aire (un líquido inerte) se descarta acá: se derramó,
   * pero al piso, no a la atmósfera.
   */
  inject(sectionId: SectionId, substanceId: ChemicalSubstanceId, amount: number): void {
    if (amount <= 0) {
      return;
    }
    // 14a-2: el aviso de derrame va ANTES del descarte por no-aérea. Lo que
    // decide `isAirborneSubstance` es si la sustancia entra en la ATMÓSFERA, no
    // si el derrame ocurrió.
    this.deps.onSpill?.(sectionId, substanceId, amount);
    if (this.deps.substanceOf) {
      const substance = this.deps.substanceOf(substanceId);
      // 14a-3: la temperatura de la sección decide el estado en el que la
      // sustancia cae. Se lee UNA vez y se pasa a los dos predicados, para que
      // "entra al aire" y "se evaporó" no puedan discrepar entre sí.
      const temperatureCelsius =
        this.deps.sectionTemperatureOf?.(sectionId) ?? NOMINAL_TEMPERATURE_CELSIUS;
      if (!isAirborneSubstance(substance, temperatureCelsius)) {
        return;
      }
      if (hasEvaporated(substance, temperatureCelsius)) {
        this.deps.onEvaporate?.(sectionId, substanceId, amount);
      }
    }
    // Sin volumen resoluble se cae a 1 (no dividir) en vez de descartar: mismo
    // criterio fail-open que el resto del motor ante un plano incompleto.
    const volume = Math.max(1, this.deps.sectionVolumeOf?.(sectionId) ?? 1);
    const bySubstance = this.pending.get(sectionId) ?? new Map<ChemicalSubstanceId, number>();
    const fraction = (amount * GAS_FRACTION_PER_SUBSTANCE_UNIT) / volume;
    bySubstance.set(substanceId, (bySubstance.get(substanceId) ?? 0) + fraction);
    this.pending.set(sectionId, bySubstance);
  }

  /**
   * Fuente para `MissionAtmosphereRuntime`. Devuelve lo pendiente y lo limpia:
   * cada inyección se aplica exactamente una vez.
   */
  asInjectionSource(): SectionGasInjectionSource {
    return () => {
      const drained = this.pending;
      this.pending = new Map();
      return drained;
    };
  }

  /** ¿Hay algo encolado? Solo para tests/diagnóstico. */
  get isEmpty(): boolean {
    return this.pending.size === 0;
  }
}

/** Compone varias fuentes en una, igual que `composePressureSinks` para los sumideros. */
export function composeGasInjections(
  ...sources: ReadonlyArray<SectionGasInjectionSource | undefined>
): SectionGasInjectionSource | undefined {
  const present = sources.filter((source): source is SectionGasInjectionSource => Boolean(source));
  if (present.length === 0) {
    return undefined;
  }
  if (present.length === 1) {
    return present[0];
  }
  return () => {
    const merged = new Map<SectionId, Map<ChemicalSubstanceId, number>>();
    for (const source of present) {
      for (const [sectionId, bySubstance] of source()) {
        const target = merged.get(sectionId) ?? new Map<ChemicalSubstanceId, number>();
        for (const [substanceId, fraction] of bySubstance) {
          target.set(substanceId, (target.get(substanceId) ?? 0) + fraction);
        }
        merged.set(sectionId, target);
      }
    }
    return merged;
  };
}
