import { componentPowerDraw } from "../power/component-power-draw.js";
import type { PhysicalComponentDefinition } from "../components/physical-component.types.js";
import type { PlacedComponentInstance } from "../blueprint/blueprint.types.js";
import type { InstanceState } from "./instance-state.types.js";

/**
 * Lo que la derivación de estado necesita saber del mundo, como interfaz
 * ANGOSTA e inyectada — mismo criterio que `DoorWorldQueries` y
 * `EmitterInputSource`: este módulo no conoce el reparto de energía ni el
 * plano, solo hace preguntas.
 *
 * Agregar un estado nuevo es agregar una consulta acá y una rama en
 * `deriveInstanceStates`, nunca editar una decisión central.
 */
export interface InstanceStateQueries {
  readonly resolveDefinition: (
    id: PlacedComponentInstance["componentDefinitionId"],
  ) => PhysicalComponentDefinition | undefined;
  /** `false` si el reparto de 13b no cubrió la demanda de esta instancia este tick. */
  readonly isInstancePowered: (instanceId: PlacedComponentInstance["instanceId"]) => boolean;
  /** Unidades otorgadas a la sección que contiene a la pieza, para el detalle del aviso. */
  readonly sectionGrantedUnitsAt: (instance: PlacedComponentInstance) => number;
}

/**
 * Estados notables de una pieza, derivados del mundo (Subfase 13h, ronda 3 de
 * playtest).
 *
 * Existe porque el gating de energía por componente era INVISIBLE: una pieza
 * apagada por triaje dentro de una sección con energía parcial se veía igual
 * que una encendida. El operador lo encontró con una compuerta que pide 2
 * unidades en una sección con 1 — el modelo funcionaba bien y no había forma de
 * saberlo. Es la viñeta de legibilidad que 13g ya tenía escrita, adelantada.
 */
export function deriveInstanceStates(
  instance: PlacedComponentInstance,
  queries: InstanceStateQueries,
): InstanceState[] {
  const states: InstanceState[] = [];

  // El guard sobre `powerDraw` NO es una optimización. `allocateComponentPower`
  // marca como alimentada a toda pieza sin consumo declarado (retrocompat
  // deliberada de 13b), pero al revés no vale: sin este guard, cualquier
  // instancia sin `powerDraw` en una sección a 0 se marcaría como apagada —
  // o sea TODO el catálogo salvo la compuerta, que es hoy el único consumidor
  // del juego. El plano entero se vería sin energía.
  const required = componentPowerDraw(queries.resolveDefinition(instance.componentDefinitionId));
  if (required > 0 && !queries.isInstancePowered(instance.instanceId)) {
    states.push({
      flag: "unpowered",
      required,
      available: queries.sectionGrantedUnitsAt(instance),
    });
  }

  return states;
}
