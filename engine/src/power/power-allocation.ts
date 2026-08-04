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
 * disponible" la mantiene el dial de UI en la fuente, no este consumidor.
 * Si de todos modos se excede (dato corrupto, fixture de test, etc.), recorta
 * proporcionalmente en vez de crashear — clamp defensivo, no la ruta normal.
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

/**
 * Reparto inicial a partes iguales del presupuesto total entre las secciones
 * reales de la nave (Fase 13b, `campaign-save-factory.ts`): toda campaña
 * nueva arranca con la nave totalmente alimentada, como regía antes de esta
 * fase — el jugador recién retriagea cuando una crisis se lo exige, no desde
 * el primer segundo de juego (decisión del operador, evita romper Cap.1/2 ya
 * validados antes de que exista la UI del dial). El resto sobrante tras la
 * división entera se reparte una unidad por sección, en el orden dado.
 */
export function distributeBudgetEvenly(
  totalUnits: number,
  sectionIds: ReadonlyArray<SectionId>,
): ReadonlyArray<SectionPowerAllocation> {
  if (sectionIds.length === 0 || totalUnits <= 0) {
    return [];
  }
  const base = Math.floor(totalUnits / sectionIds.length);
  let remainder = totalUnits - base * sectionIds.length;
  return sectionIds.map((sectionId) => {
    const extra = remainder > 0 ? 1 : 0;
    remainder = Math.max(0, remainder - 1);
    return { sectionId, units: base + extra };
  });
}

/**
 * Unión de la cicatriz permanente (Cap.5, sacrificio) con el déficit vivo de
 * la sesión actual — la función que materializa la reconciliación cerrada
 * con el operador: un solo campo público (`Blueprint.unpoweredSectionIds`),
 * recalculado cada tick, sin que el triaje táctico de hoy se filtre como
 * cicatriz permanente del guardado.
 */
export function reconcilePowerScars(
  permanentlyDisconnectedSectionIds: ReadonlyArray<SectionId>,
  deficitSectionIds: ReadonlySet<SectionId>,
): ReadonlyArray<SectionId> {
  return Array.from(new Set([...permanentlyDisconnectedSectionIds, ...deficitSectionIds]));
}
