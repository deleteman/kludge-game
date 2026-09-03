import type { Blueprint, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { ShipFloorplan } from "../floorplan/floorplan.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import type {
  ChemicalSubstanceDefinition,
  ChemicalSubstanceId,
} from "../chemistry/chemical-substance.types.js";
import { effectiveMatterState, phasePointsOf } from "../chemistry/phase/matter-state.js";
import { contentOf } from "./reservoir-ledger.js";
import { sectionOfInstance } from "./fluid-transfer-reachability.js";

/**
 * Contenido de reservorio CONGELADO (Subfase 14a-3, GDD §5.6 "líquido → sólido
 * detiene flujo").
 *
 * Estado **derivado, nunca persistido**: se calcula del contenido del ledger y
 * de la temperatura viva de la sección. Un flag guardado sería el error que 13g
 * documentó al no auto-rellenar el reparto de energía — un dato que sirve a dos
 * amos y se desincroniza en cuanto el jugador apaga el enfriador.
 *
 * Este módulo es el ÚNICO sitio que responde la pregunta, y lo consumen los dos
 * lados: las ramas de tarea de `ship-task-effect.ts` (que rechazan) y el panel
 * de acciones de `/game` (que deshabilita y explica). Dos evaluaciones paralelas
 * serían exactamente el bug de "la UI ofrece extraer y la tarea no hace nada".
 *
 * **Asimetría deliberada frío/calor**: un reservorio es un contenedor sellado
 * que aguanta presión, así que su contenido NO hierve por estar en una sala
 * caliente — si no, el tanque criogénico se vaciaría solo a 21 °C, un castigo
 * pasivo que el jugador no puede evitar. Congelarse sí lo alcanza: el líquido
 * expande al solidificar y fuerza las paredes.
 */

/** Lectura completa del estado congelado, con los números que la UI necesita mostrar. */
export interface FrozenContentInfo {
  readonly substanceId: ChemicalSubstanceId;
  readonly sectionId: SectionId;
  readonly temperatureCelsius: number;
  readonly meltingPointCelsius: number;
}

/**
 * Dependencias del mundo, inyectadas y no importadas: `/engine` no conoce el
 * catálogo químico ni el runtime de atmósfera, los recibe (mismo criterio que
 * `GasInjectionDeps` o `SalvageHazardDeps`).
 */
export interface FrozenContentDeps {
  readonly substanceOf: (substanceId: ChemicalSubstanceId) => ChemicalSubstanceDefinition | undefined;
  readonly sectionTemperatureOf: (sectionId: SectionId) => number | undefined;
}

/** Predicado desnudo, sin resolver nada del mundo: la unidad testeable. */
export function isSubstanceFrozenAt(
  substance: ChemicalSubstanceDefinition | undefined,
  temperatureCelsius: number | undefined,
): boolean {
  if (!substance || temperatureCelsius === undefined) {
    // Fail-open, mismo criterio que el resto del motor ante un mundo
    // incompleto: sin dato no se puede afirmar que está congelado, y bloquear
    // una acción por falta de información es peor que dejarla pasar.
    return false;
  }
  return effectiveMatterState(substance, temperatureCelsius) === "S";
}

/**
 * ¿El contenido de ESTE reservorio está congelado? Devuelve la lectura completa
 * (o `undefined` si no lo está), porque todo llamador que bloquea necesita
 * además el motivo con números: un estado sin su lectura numérica deja al
 * jugador sin saber cuánto le falta para destrabarlo.
 */
export function frozenContentOf(
  blueprint: Blueprint,
  floorplan: ShipFloorplan | undefined,
  instanceId: PlacedComponentInstanceId,
  deps: FrozenContentDeps,
): FrozenContentInfo | undefined {
  const content = contentOf(blueprint.reservoirContents, instanceId);
  if (!content || !floorplan) {
    return undefined;
  }
  const sectionId = sectionOfInstance(blueprint, floorplan, instanceId);
  if (!sectionId) {
    return undefined;
  }
  const temperatureCelsius = deps.sectionTemperatureOf(sectionId);
  const substance = deps.substanceOf(content.substanceId);
  if (!substance || temperatureCelsius === undefined) {
    return undefined;
  }
  if (!isSubstanceFrozenAt(substance, temperatureCelsius)) {
    return undefined;
  }
  return {
    substanceId: content.substanceId,
    sectionId,
    temperatureCelsius,
    meltingPointCelsius: phasePointsOf(substance).meltingPointCelsius,
  };
}
