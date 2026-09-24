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
  /** `true` si la pieza está en `Blueprint.overloadedRefs` — cicatriz permanente de la Fase 12a. */
  readonly isInstanceOverloaded: (instanceId: PlacedComponentInstance["instanceId"]) => boolean;
  /** Unidades otorgadas a la sección que contiene a la pieza, para el detalle del aviso. */
  readonly sectionGrantedUnitsAt: (instance: PlacedComponentInstance) => number;
  /**
   * Pieza sacrificada por el triaje de fan-out de señal (14a-4 ronda 2):
   * `undefined` si recibe señal, y si no, cuánta demanda cuelga del emisor que
   * la gobierna contra cuánto sostiene. Devolver los dos números y no un
   * booleano es lo que hace accionable el aviso — igual que en `unpowered`, lo
   * útil no es "no recibe señal" sino cuánto sobra.
   */
  /**
   * Contenido congelado (14a-3): `undefined` si no lo está, y si lo está, la
   * temperatura actual de la sección y el punto de fusión de la sustancia. Los
   * DOS números por la misma razón que en `unsignaled`: lo accionable no es
   * "está congelado" sino cuánto falta para que deje de estarlo.
   */
  readonly frozenContentOf: (
    instanceId: PlacedComponentInstance["instanceId"],
  ) => { readonly temperatureCelsius: number; readonly meltingPointCelsius: number } | undefined;
  readonly signalStarvationOf: (
    instanceId: PlacedComponentInstance["instanceId"],
  ) => { readonly demand: number; readonly capacity: number } | undefined;
  /**
   * Válvula automática vertiendo AHORA (Subfase 14b-2), con lo que le queda al
   * reservorio y su capacidad. Los dos números por el mismo motivo que en los
   * demás: lo accionable no es "está vertiendo" sino cuánto le queda antes de
   * que el gasto sea irreversible.
   *
   * `undefined` en todo lo que no sea una válvula vertiendo — incluida una
   * válvula cerrada, que no es un estado notable: una pieza quieta y correcta no
   * tiene por qué llevar un ícono.
   */
  readonly pouringValveOf: (
    instanceId: PlacedComponentInstance["instanceId"],
  ) => { readonly remaining: number; readonly capacity: number } | undefined;
}

/**
 * Por debajo de qué fracción de su capacidad un reservorio se considera BAJO
 * (Subfase 14b-2). Un quinto: suficiente para que el aviso llegue con margen de
 * reacción y no tan pronto como para que un tanque a medio usar viva en alarma
 * — un indicador encendido casi siempre no informa nada (eje 7).
 */
export const RESERVOIR_LOW_FRACTION = 0.2;

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

  // ORDEN = SUBPRIORIDAD: `resolveComponentVisual` (en `/game`) muestra
  // `states[0]`, así que lo más grave se empuja primero. Un conductor CORTADO
  // por sobrecarga es más grave que uno sin energía: lo segundo se arregla
  // moviendo el dial, lo primero es una cicatriz permanente (principio 5) y
  // además explica por qué la pieza dejó de conducir. Sin este orden, un cable
  // quemado en una sección a oscuras se anunciaría como "sin energía" y el
  // jugador buscaría el problema donde no está.
  if (queries.isInstanceOverloaded(instance.instanceId)) {
    states.push({ flag: "overloaded" });
  }

  // El contenido congelado va justo después de la cicatriz de sobrecarga: es lo
  // único que inutiliza a un reservorio POR COMPLETO —no se puede verter, ni
  // trasvasar, ni purgar, ni extraer— así que si además le falta energía o
  // señal, lo primero que hay que contar es que su carga es un bloque de hielo.
  const frozen = queries.frozenContentOf(instance.instanceId);
  if (frozen) {
    states.push({
      flag: "frozen-content",
      required: frozen.meltingPointCelsius,
      available: frozen.temperatureCelsius,
    });
  }

  // Sin señal va DESPUÉS de la sobrecarga y ANTES de la falta de energía: es un
  // problema de montaje que el jugador puede resolver ahora mismo (desconectar
  // algo, subir la prioridad de esta pieza, meter un relé), mientras que la
  // energía se arregla en otro panel y con otro recurso. Anunciar primero lo
  // que se arregla acá.
  const starvation = queries.signalStarvationOf(instance.instanceId);
  if (starvation) {
    states.push({
      flag: "unsignaled",
      required: starvation.demand,
      available: starvation.capacity,
    });
  }

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

  // Vertiendo va al final: es el único estado de esta lista que NO es un
  // problema. Los cinco anteriores cuentan por qué una pieza no hace lo que
  // debería; éste cuenta que está haciendo su trabajo, y si además está
  // congelada o sin energía, eso manda.
  const pouring = queries.pouringValveOf(instance.instanceId);
  if (pouring) {
    states.push({ flag: "pouring", required: pouring.remaining, available: pouring.capacity });
    // El aviso de reserva baja va pegado al de vertido y no en su lugar: hay que
    // poder ver que está vertiendo Y que se está quedando sin nada. Son dos
    // hechos distintos y colapsarlos escondería el que urge (principio 5).
    if (pouring.capacity > 0 && pouring.remaining <= pouring.capacity * RESERVOIR_LOW_FRACTION) {
      states.push({ flag: "reservoir-low", required: pouring.remaining, available: pouring.capacity });
    }
  }

  return states;
}
