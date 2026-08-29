import type { PhysicalComponentDefinition } from "../components/physical-component.types.js";

/**
 * Unidades de energía que una pieza DEMANDA para operar, o 0 si no declara
 * consumo.
 *
 * Centralizada en la ronda 3 de playtest de 13h: la misma expresión estaba
 * copiada en `allocateComponentPower` (que decide si la pieza arranca) y en
 * `MissionRuntime.sectionPowerDemand` (que pinta el heatmap de la capa
 * "energia"), y la derivación de estado por instancia iba a ser la tercera
 * copia. Si las tres divergieran, el plano diría que una sección tiene déficit
 * y el reparto alimentaría la pieza igual, o al revés.
 *
 * Subfase 13g: `powerDraw` dejó de vivir dentro del tag `ACT` y pasó a dato de
 * componente (`data.powerDraw`), poblado al construir el catálogo desde
 * `power-parameters.ts`. Centralizar esta lectura antes de la migración es lo
 * que hizo que el cambio entrara en un solo lugar y que los tres consumidores
 * —reparto, heatmap y derivación de estado— no pudieran divergir.
 */
export function componentPowerDraw(definition: PhysicalComponentDefinition | undefined): number {
  return definition?.data.powerDraw ?? 0;
}
