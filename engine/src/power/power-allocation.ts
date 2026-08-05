import type { EntityRegistry } from "../composition/entity-registry.js";
import type { ComponentId, PhysicalComponentDefinition } from "../components/physical-component.types.js";
import type { PlacedComponentInstance, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import type { InstancePowerPriority, SectionPowerAllocation } from "./power.types.js";

/**
 * Reparto en dos niveles del presupuesto de energía (Fase 13b, "estilo FTL").
 * Funciones puras y testeadas de forma aislada ANTES de cualquier wiring de
 * runtime (`mission-power-runtime.ts`), siguiendo el estándar de CLAUDE.md.
 */

export interface SectionBudgetResult {
  readonly grantedBySectionId: ReadonlyMap<SectionId, number>;
  /** Secciones con 0 unidades otorgadas — "lo no asignado deja la sección a oscuras" (diseño cerrado 13b). */
  readonly darkSectionIds: ReadonlySet<SectionId>;
  /** Unidades pedidas por encima del presupuesto disponible; 0 cuando no hay conflicto. */
  readonly shortfallUnits: number;
  /**
   * Secciones apagadas POR EL DÉFICIT — subconjunto de `darkSectionIds`, que
   * además incluye a las que el jugador nunca asignó. Solo estas son "algo se
   * perdió", y son las que se comunican en el aviso de déficit.
   */
  readonly shedSectionIds: ReadonlySet<SectionId>;
}

/**
 * Nivel 1: global→sección. Refleja `sectionAllocations` tal cual mientras el
 * total pedido no exceda `totalUnits`.
 *
 * Ante DÉFICIT (el jugador pidió más de lo que hay — típicamente porque perdió
 * una fuente al desmantelarla, no porque la UI se lo permitiera: el slider ya
 * topa en el presupuesto) se apagan secciones **de menor a mayor asignación**
 * hasta que el resto entre (decisión del operador, ronda 4 de playtest). Se
 * sacrifica lo menos invertido y sobrevive lo que más energía tenía puesta.
 * Reemplaza al recorte proporcional anterior, que además desperdiciaba
 * presupuesto al redondear hacia abajo cada sección por separado.
 *
 * Excepción del caso borde: si queda UNA sola sección asignada y por sí sola
 * excede el presupuesto, se la recorta en vez de apagarla — apagarla dejaría
 * el presupuesto entero ocioso. Dentro de la sección, el triaje por prioridad
 * de `allocateComponentPower` decide qué componentes se quedan sin energía.
 *
 * La reconciliación es NO DESTRUCTIVA: esta función no toca
 * `sectionAllocations`. El pedido del jugador sobrevive en el blueprint, así
 * que reinstalar una fuente restaura el reparto solo.
 *
 * `darkSectionIds` (0 unidades otorgadas) es un resultado puramente
 * informativo de esta función — no gatea nada por sí solo. Quién lo consume
 * decide qué tan estricto ser: `MissionPowerRuntime.sectionHasNoPowerGranted`
 * lo expone tal cual para el efecto visual ambiental (honesto, sin
 * excepciones), mientras que la cicatriz real que gatea señales/HUD
 * (`Blueprint.unpoweredSectionIds`) NO se deriva de acá — viene solo de
 * `powerState.permanentlyDisconnectedSectionIds` (ver `mission-power-runtime.ts`).
 */
export function allocateSectionBudget(
  totalUnits: number,
  sectionAllocations: ReadonlyArray<SectionPowerAllocation>,
  sectionIds: ReadonlyArray<SectionId>,
): SectionBudgetResult {
  const requested = new Map<SectionId, number>();
  for (const allocation of sectionAllocations) {
    requested.set(allocation.sectionId, Math.max(0, allocation.units));
  }
  const requestedTotal = [...requested.values()].reduce((sum, units) => sum + units, 0);
  const shortfallUnits = Math.max(0, requestedTotal - totalUnits);

  // Apagado ordenado: menor asignación primero, desempate determinista por
  // `sectionId` (mismo criterio que `allocateComponentPower`).
  const survivors = [...requested.entries()]
    .filter(([, units]) => units > 0)
    .sort(([idA, unitsA], [idB, unitsB]) => (unitsA !== unitsB ? unitsA - unitsB : idA < idB ? -1 : idA > idB ? 1 : 0));
  const shedSectionIds = new Set<SectionId>();
  let survivingTotal = requestedTotal;
  while (survivors.length > 1 && survivingTotal > totalUnits) {
    const [sectionId, units] = survivors.shift()!;
    shedSectionIds.add(sectionId);
    survivingTotal -= units;
  }

  const grantedBySectionId = new Map<SectionId, number>();
  const darkSectionIds = new Set<SectionId>();
  for (const sectionId of sectionIds) {
    // Un único sobreviviente puede seguir excediendo el presupuesto: se recorta.
    const granted = shedSectionIds.has(sectionId)
      ? 0
      : Math.max(0, Math.min(requested.get(sectionId) ?? 0, totalUnits));
    grantedBySectionId.set(sectionId, granted);
    if (granted <= 0) {
      darkSectionIds.add(sectionId);
    }
  }
  return { grantedBySectionId, darkSectionIds, shortfallUnits, shedSectionIds };
}

export interface ComponentPowerResult {
  readonly poweredInstanceIds: ReadonlySet<PlacedComponentInstanceId>;
  readonly unpoweredInstanceIds: ReadonlySet<PlacedComponentInstanceId>;
}

/**
 * Nivel 2: sección→componentes. Ordena las instancias de la sección por
 * prioridad manual (menor = más prioritario; sin prioridad explícita = al
 * final, desempate determinista por `instanceId`) y consume el pool en ese
 * orden según `powerDraw`. Componentes sin `powerDraw`/`0` siempre quedan
 * alimentados y no restan del pool (retrocompat con todo el catálogo previo
 * a 13b).
 */
export function allocateComponentPower(
  sectionPoolUnits: number,
  instances: ReadonlyArray<PlacedComponentInstance>,
  priorities: ReadonlyArray<InstancePowerPriority>,
  componentRegistry: EntityRegistry<ComponentId, PhysicalComponentDefinition>,
): ComponentPowerResult {
  const priorityByInstance = new Map(priorities.map((entry) => [entry.instanceId, entry.priority]));
  const ordered = [...instances].sort((a, b) => {
    const priorityA = priorityByInstance.get(a.instanceId) ?? Number.POSITIVE_INFINITY;
    const priorityB = priorityByInstance.get(b.instanceId) ?? Number.POSITIVE_INFINITY;
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    return a.instanceId < b.instanceId ? -1 : a.instanceId > b.instanceId ? 1 : 0;
  });

  let remaining = sectionPoolUnits;
  const poweredInstanceIds = new Set<PlacedComponentInstanceId>();
  const unpoweredInstanceIds = new Set<PlacedComponentInstanceId>();
  for (const instance of ordered) {
    const definition = componentRegistry.get(instance.componentDefinitionId);
    const actuator = definition?.data.functional?.find((property) => property.tag === "ACT");
    const draw = actuator && actuator.tag === "ACT" ? (actuator.powerDraw ?? 0) : 0;
    if (draw <= 0) {
      poweredInstanceIds.add(instance.instanceId);
      continue;
    }
    if (remaining >= draw) {
      remaining -= draw;
      poweredInstanceIds.add(instance.instanceId);
    } else {
      unpoweredInstanceIds.add(instance.instanceId);
    }
  }
  return { poweredInstanceIds, unpoweredInstanceIds };
}
