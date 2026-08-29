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
 * `powerDraw` vive hoy dentro del tag `ACT`, así que una pieza que no es
 * actuador no tiene dónde declarar consumo: la Subfase 13g lo sube a dato de
 * componente. Cuando eso pase, **este es el único lugar que hay que tocar** —
 * que es precisamente la razón de centralizarlo antes.
 */
export function componentPowerDraw(definition: PhysicalComponentDefinition | undefined): number {
  const actuator = definition?.data.functional?.find((property) => property.tag === "ACT");
  return actuator && actuator.tag === "ACT" ? (actuator.powerDraw ?? 0) : 0;
}
