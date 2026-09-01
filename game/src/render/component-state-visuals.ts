import type { ComponentCondition, ComponentWear, InstanceState, InstanceStateFlag } from "engine";

import { t } from "../i18n/i18n.js";
import {
  COMPONENT_CONDITION_TINT,
  COMPONENT_WEAR_TINT,
  DOOR_STATE_COLOR,
  hexToCss,
  OVERLOADED_CONDUCTOR_LIGHT_COLOR,
} from "./palette.js";

/**
 * Cómo se ve una pieza según su estado (Subfase 13h, ronda 3 de playtest).
 *
 * **Por qué existe.** El operador pidió un sistema genérico de tintado + aviso
 * en tooltip, reusable para otros estados. Pero el pedido llegó sobre un canal
 * que YA estaba disputado: el tinte de un sprite del plano lo decidían dos
 * lugares distintos —el `condition`/`wear` que `mission-overlay-renderer.ts`
 * aplicaba al crear el sprite, con su prioridad escrita a mano ahí— y agregar
 * un tercero habría hecho que la base oscilara según quién escribió último
 * (es el patrón que ya costó una ronda con `setTint` en 12d).
 *
 * Así que este módulo no se suma a los que deciden: los REEMPLAZA. Es la única
 * fuente de "de qué color va esta pieza y por qué", y tanto el renderer como el
 * update por frame de la escena la llaman.
 *
 * **La tabla es una cadena ORDENADA y el orden ES la prioridad**, igual que
 * `door-rule-registry.ts` en el motor y `doorLayerColor` en el renderer. Gana
 * el dato más grave: una pieza destruida se ve destruida aunque además esté
 * sin energía y degradada, para no colapsar dos estados en un color intermedio
 * ambiguo.
 *
 * **Agregar un estado nuevo** = una fila acá y su derivación en
 * `deriveInstanceStates` (motor). Nada más.
 */

export interface ComponentStateVisual {
  /** Tinte base del sprite. `undefined` = sin tinte propio (color de sección). */
  readonly tint?: number;
  /**
   * Glifo que se dibuja sobre el sprite a BRILLO PLENO, fuera del sombreado por
   * luz. No es decoración: un tinte solo se multiplica por el nivel de luz de
   * su celda, y una pieza sin energía vive justo donde hay menos luz — el
   * estado que más hay que mostrar sería el menos visible. Decisión del
   * operador (ronda 3).
   */
  readonly icon?: string;
  /** Clave i18n del aviso de tooltip. `undefined` = el estado no se comenta. */
  readonly noticeKey?: string;
}

/** Color CSS del aviso en el tooltip, derivado del mismo tinte (una sola fuente de color por estado). */
export function stateNoticeCss(visual: ComponentStateVisual): string {
  return visual.tint === undefined ? "#c8cee0" : hexToCss(visual.tint);
}

/**
 * Estados derivados del mundo. Van ANTES que `wear` y DESPUÉS que `condition`
 * en la cadena de `resolveComponentVisual`.
 *
 * `unpowered` reusa `DOOR_STATE_COLOR.unpowered`, que ya es el gris que
 * significa "sin energía" en el proyecto. Deliberadamente NO usa el ámbar de
 * `ENERGY_LAYER_COLOR.deficit`, aunque sea el color de la energía a nivel
 * sección: ese mismo ámbar es `COMPONENT_WEAR_TINT.degradado`, así que sobre un
 * sprite ya significa otra cosa, y dos estados distintos se verían igual
 * (principio 6 de CLAUDE.md, en su forma inversa). El ícono es lo que
 * desambigua sin depender del color.
 */
const STATE_VISUAL: Readonly<Record<InstanceStateFlag, ComponentStateVisual>> = {
  /**
   * Conductor cortado por sobrecarga (ronda 1 de 14a-2). Reusa el ÁMBAR de la
   * cicatriz de partículas (`OVERLOADED_CONDUCTOR_LIGHT_COLOR`) a propósito: el
   * jugador ya ve ese tono chispear sobre la pieza, y que el tinte, el glifo y
   * el aviso del tooltip hablen el mismo color es lo que convierte tres señales
   * sueltas en una sola lectura. Distinto de `CRISIS_WARNING_COLOR` (0xe0a33f),
   * que es el ámbar de `wear: degradado` — el aserto de no-colisión de abajo lo
   * fija.
   *
   * Va PRIMERO en `deriveInstanceStates`: una pieza cortada se anuncia como
   * cortada aunque además esté sin energía.
   */
  overloaded: {
    tint: OVERLOADED_CONDUCTOR_LIGHT_COLOR,
    icon: "⌁",
    noticeKey: "ui.floorplan.mission.state.overloaded",
  },
  unpowered: {
    tint: DOOR_STATE_COLOR.unpowered,
    icon: "⚡",
    noticeKey: "ui.floorplan.mission.state.unpowered",
  },
};

export function visualForState(flag: InstanceStateFlag): ComponentStateVisual {
  return STATE_VISUAL[flag];
}

/**
 * Texto del aviso, con su detalle numérico. Vive junto a la tabla de color para
 * que un estado tenga UNA sola fila: tinte, ícono y frase salen del mismo lugar
 * y no pueden divergir.
 *
 * `t()` no interpola (los strings vienen de la tabla tal cual), así que el
 * número se compone acá — mismo criterio que la etiqueta de presión del
 * tooltip. Sin el número el aviso describe el síntoma y no da la salida: lo
 * accionable es cuánto le falta a la sección, no que "no tiene energía".
 */
export function instanceStateLabel(state: InstanceState): string {
  const base = visualForState(state.flag).noticeKey;
  const text = base ? t(base) : state.flag;
  if (state.required === undefined || state.available === undefined) {
    return text;
  }
  return `${text}: ${t("ui.floorplan.mission.state.needs")} ${state.required} · ${t("ui.floorplan.mission.state.granted")} ${state.available}`;
}

/**
 * Resuelve el aspecto final de una pieza. La cadena, de más grave a menos:
 * `condition` (destruida/atascada) → estados derivados (sin energía) → `wear`.
 *
 * `condition` va primero porque describe si la pieza EXISTE como pieza; los
 * estados derivados, si está operando; y `wear`, cuánta historia arrastra. Una
 * puerta destruida no necesita que le digan que además no tiene energía.
 */
export function resolveComponentVisual(
  instance: { readonly condition: ComponentCondition; readonly wear: ComponentWear },
  states: readonly InstanceState[] = [],
): ComponentStateVisual {
  const conditionTint = COMPONENT_CONDITION_TINT[instance.condition];
  if (conditionTint !== undefined) {
    return { tint: conditionTint };
  }
  const state = states[0];
  if (state) {
    return visualForState(state.flag);
  }
  const wearTint = COMPONENT_WEAR_TINT[instance.wear];
  return wearTint === undefined ? {} : { tint: wearTint };
}
