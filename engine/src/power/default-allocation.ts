import type { EntityRegistry } from "../composition/entity-registry.js";
import type { ComponentId, PhysicalComponentDefinition } from "../components/physical-component.types.js";
import type { PlacedComponentInstance } from "../blueprint/blueprint.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import type { ShipFloorplan } from "../floorplan/floorplan.types.js";
import { sectionContainingCell } from "../floorplan/floorplan.types.js";
import type { SectionPowerAllocation } from "./power.types.js";
import { componentPowerDraw } from "./component-power-draw.js";

/**
 * Reparto inicial de energía para una partida nueva (Subfase 13g).
 *
 * Por qué existe: `emptyPowerState()` deja `sectionAllocations: []`, o sea que
 * TODA sección arranca con 0 unidades otorgadas. Eso era inocuo mientras nada
 * declarara `powerDraw`, y se volvió una trampa en la ronda 2 de playtest de
 * 13h, cuando la puerta pasó a ser el primer consumidor real: "no asignaste
 * energía" se leía como "la nave entera es inalcanzable". Con 13g declarando
 * consumo en el resto del catálogo, arrancar a oscuras dejaría una partida
 * nueva sin señales, sin mesas y sin puertas — un juego que parece roto.
 *
 * Qué hace: le da a cada sección exactamente lo que su equipamiento instalado
 * demanda, en orden de mayor a menor demanda, hasta agotar el presupuesto. Con
 * oferta suficiente el jugador arranca con todo encendido y el dial de 13b
 * sigue siendo suyo para redistribuir; con oferta insuficiente el reparto
 * parcial es determinista y las secciones que quedan afuera son las más caras,
 * no las primeras del array.
 *
 * No se persiste como "la asignación correcta" ni se recalcula nunca más: es
 * solo el valor inicial de `PowerState.sectionAllocations`. En cuanto el
 * jugador toca el dial, manda él.
 */
export function defaultSectionAllocations(
  placedComponents: ReadonlyArray<PlacedComponentInstance>,
  shipFloorplan: ShipFloorplan,
  componentRegistry: EntityRegistry<ComponentId, PhysicalComponentDefinition>,
  budgetUnits: number,
): ReadonlyArray<SectionPowerAllocation> {
  const demandBySection = new Map<SectionId, number>();
  for (const instance of placedComponents) {
    const draw = componentPowerDraw(componentRegistry.get(instance.componentDefinitionId));
    if (draw <= 0) {
      continue;
    }
    const section = sectionContainingCell(shipFloorplan, instance.placement.position);
    if (!section) {
      continue;
    }
    demandBySection.set(section.id, (demandBySection.get(section.id) ?? 0) + draw);
  }

  // Mayor demanda primero; desempate por id para que el reparto sea
  // determinista y reproducible entre partidas y entre tests.
  const ordered = [...demandBySection.entries()].sort(
    (a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0),
  );

  let remaining = Math.max(0, budgetUnits);
  const allocations: SectionPowerAllocation[] = [];
  for (const [sectionId, demand] of ordered) {
    if (remaining <= 0) {
      break;
    }
    const units = Math.min(demand, remaining);
    remaining -= units;
    allocations.push({ sectionId, units });
  }
  return allocations;
}
