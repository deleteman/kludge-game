import type { EntityRegistry } from "../composition/entity-registry.js";
import type { ComponentId, PhysicalComponentDefinition } from "../components/physical-component.types.js";
import type { GridPosition } from "../geometry/grid-position.types.js";
import type { Blueprint } from "../blueprint/blueprint.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import { RE_ORDER } from "../properties/material-order.js";
import { effectiveResistance } from "../wear/effective-resistance.js";
import { occupiedCells } from "../workbench/workbench-state.types.js";
import { SECTION_INTEGRITY_PARAMETERS } from "../integrity/section-integrity-parameters.js";
import type { SectionPressureSinkSource } from "./mission-atmosphere-runtime.js";
import type { MutableShipState } from "./mutable-ship-state.js";

/** Una brecha abierta en el casco de una sección (Subfase 13f). */
export interface SectionBreach {
  readonly sectionId: SectionId;
  /** Celda del casco que se abrió: es donde hay que instalar el parche. */
  readonly cell: GridPosition;
}

/**
 * ¿Sirve esta pieza para tapar una brecha de casco?
 *
 * Identidad por PROPIEDADES, no por id de catálogo (principio 1 de CLAUDE.md):
 * cualquier pieza estructural (`EST`) con resistencia efectiva suficiente
 * sirve de parche. Es la diferencia con la junta rota del Cap.1
 * (`sealBreachPressureSink`), que sí usa una lista cerrada de ids: ahí no hay
 * ninguna propiedad que signifique "sella la atmósfera" (`ES` es estado de la
 * materia, no hermeticidad), pero "tapar un agujero en el casco con una chapa
 * lo bastante dura" SÍ se expresa con las propiedades que ya existen.
 *
 * Consecuencia buscada: el jugador puede improvisar el parche con lo que
 * tenga a mano —una plancha metálica, una compuerta blindada desmontada de
 * otro sitio— en vez de buscar la pieza que el guion decidió de antemano. Una
 * pieza desgastada deja de servir cuando su RE efectiva cae por debajo del
 * mínimo, así que un parche viejo no aguanta un agujero al vacío.
 */
export function isBreachPatch(
  definition: PhysicalComponentDefinition | undefined,
  wear: Parameters<typeof effectiveResistance>[1],
): boolean {
  if (!definition?.data.functional?.some((property) => property.tag === "EST")) {
    return false;
  }
  const catalogRE = definition.data.material?.RE;
  if (!catalogRE) {
    return false;
  }
  const level = effectiveResistance(catalogRE, wear);
  if (level === null || level === "fallo") {
    return false;
  }
  const minimum = SECTION_INTEGRITY_PARAMETERS.breach.minPatchResistance;
  return RE_ORDER.indexOf(level) <= RE_ORDER.indexOf(minimum);
}

/**
 * ¿Hay una pieza apta tapando la celda de la brecha? Identidad por POSICIÓN,
 * nunca por `instanceId`: el flujo real de reparación (desmontar + instalar)
 * crea una instancia nueva, así que identificar por instancia jamás vería el
 * arreglo — la misma lección que documenta `seal-breach-pressure-sink.ts`.
 *
 * Se comprueba contra TODAS las celdas ocupadas por la pieza y no solo su
 * origen: una plancha metálica es de 2×2, y exigir que su esquina superior
 * izquierda caiga justo en la brecha sería un requisito invisible para el
 * jugador.
 */
export function isBreachSealed(
  blueprint: Blueprint,
  breach: SectionBreach,
  componentRegistry: EntityRegistry<ComponentId, PhysicalComponentDefinition>,
): boolean {
  return blueprint.placedComponents.some((instance) => {
    if (instance.condition !== "ok") {
      return false;
    }
    const covers = occupiedCells(instance.placement).some(
      (cell) => cell.x === breach.cell.x && cell.y === breach.cell.y,
    );
    return covers && isBreachPatch(componentRegistry.get(instance.componentDefinitionId), instance.wear);
  });
}

/**
 * `SectionPressureSinkSource` de las brechas de casco (Subfase 13f). Mismo
 * molde que `sealBreachPressureSink`: drena mientras el agujero está abierto y
 * **recupera (tasa negativa) en cuanto está tapado**, con el clamp de dos lados
 * que `MissionAtmosphereRuntime` ya aplica a ambos signos.
 *
 * La primera versión de 13f omitía las brechas selladas en vez de devolver una
 * tasa de recuperación, apoyándose en que "la sección se volvería a presurizar
 * por los medios que ya existan". La ronda 2 de playtest destapó que no existe
 * ninguno —`diffuse()` mueve fracciones de gas, jamás `pressureKpa`— así que la
 * sala quedaba a 0 kPa y letal para siempre, con el parche puesto. La
 * consecuencia permanente vive en el CASCO (vida 0, `breached` para siempre, un
 * golpe más lo reabre), no en dejar media nave inhabitable.
 *
 * La diferencia física con la junta rota se mantiene donde importa: la brecha
 * drena un orden de magnitud más rápido de lo que recupera (12 vs. 2 kPa/s).
 *
 * Se compone con el resto de sumideros vía `composePressureSinks` (13d), que
 * ya existía justamente para esto.
 */
export function sectionBreachPressureSink(
  shipState: MutableShipState,
  breaches: () => ReadonlyArray<SectionBreach>,
  componentRegistry: EntityRegistry<ComponentId, PhysicalComponentDefinition>,
): SectionPressureSinkSource {
  return () => {
    const blueprint = shipState.get();
    const { drainRateKpaPerSecond, recoveryRateKpaPerSecond } = SECTION_INTEGRITY_PARAMETERS.breach;
    const rates = new Map<SectionId, number>();
    for (const breach of breaches()) {
      const sealed = isBreachSealed(blueprint, breach, componentRegistry);
      // Se acumula en vez de pisar: dos brechas en la misma sección suman, y
      // una tapada no puede "cancelar" a otra que sigue abierta.
      const rate = sealed ? -recoveryRateKpaPerSecond : drainRateKpaPerSecond;
      rates.set(breach.sectionId, (rates.get(breach.sectionId) ?? 0) + rate);
    }
    return rates;
  };
}
