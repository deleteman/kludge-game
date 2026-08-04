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
}

/**
 * Nivel 1: global→sección. Refleja `sectionAllocations` tal cual mientras el
 * total pedido no exceda `totalUnits` — la invariante "no asignar más de lo
 * disponible" la mantiene el slider de UI en la fuente, no este consumidor.
 * Si de todos modos se excede (dato corrupto, fixture de test, etc.), recorta
 * proporcionalmente en vez de crashear — clamp defensivo, no la ruta normal.
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
  const scale = requestedTotal > totalUnits && requestedTotal > 0 ? totalUnits / requestedTotal : 1;

  const grantedBySectionId = new Map<SectionId, number>();
  const darkSectionIds = new Set<SectionId>();
  for (const sectionId of sectionIds) {
    const granted = Math.floor((requested.get(sectionId) ?? 0) * scale);
    grantedBySectionId.set(sectionId, granted);
    if (granted <= 0) {
      darkSectionIds.add(sectionId);
    }
  }
  return { grantedBySectionId, darkSectionIds };
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
