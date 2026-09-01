import type { ComponentId } from "../components/physical-component.types.js";

/**
 * Cuánta demanda puede SOSTENER la salida de una pieza (14a-4, ronda 2 de
 * playtest). Data-driven (CLAUDE.md): `build-component-catalog.ts` inyecta
 * estos números en `data.signalOutputCapacity` al construir el catálogo, exacto
 * mismo mecanismo que `POWER_DRAW_BY_COMPONENT` en 13g — ni los specs de
 * catálogo ni el triaje de `emitter-fanout.ts` contienen un literal.
 *
 * **Por qué existe.** La ronda 1 dejó el cable con carga y capacidad reales,
 * pero el operador colgó 7 consumidores de un solo fotorreceptor y ningún cable
 * llegó nunca a ámbar. No era un bug: `edgeElectricalLoad` cuenta lo que cuelga
 * AGUAS ABAJO de cada arista, y en estrella cada cable lleva una sola pieza.
 * Sobrecargar un cable exige un TRONCO (`sensor → chip → N piezas`), y montar
 * en tronco cuesta un cable MÁS que la estrella — así que nadie lo iba a
 * construir jamás y la mecánica de carga era inalcanzable.
 *
 * El límite del emisor es lo que la vuelve alcanzable: si un sensor no puede
 * sostener a todos sus consumidores, el chip-relé deja de ser un capricho y
 * pasa a ser necesario, aparece el tronco solo, y el tronco sí se puede quemar.
 * Las dos mecánicas se completan; sin esta, la otra no tiene camino.
 *
 * **Unidades**: las mismas de `powerDraw` (1 = pieza de señal, 2 = actuador,
 * 3 = equipamiento pesado), para que "demanda 8 / capacidad 3" sea una sola
 * magnitud comparable y no dos números que se ven igual y miden distinto — el
 * error que 14a-2 tuvo que corregir en `COND.maxCapacity`.
 *
 * Los números finos son balanceo (Fase 23). Lo que cierra esta ronda es que
 * EXISTAN y se respeten.
 */
export const SIGNAL_OUTPUT_CAPACITY_BY_COMPONENT: Readonly<Record<string, number>> = {
  /**
   * El relé. Absorbe entero el montaje del reporte (demanda 8) y crea el tronco
   * de carga 9 sobre cobre de capacidad 6 — la lección siguiente. Es la razón
   * de que este número sea justo 8 y no 6: tiene que resolver el problema de
   * arriba para poder enseñar el de abajo.
   *
   * Solo declara `REC`, y desde que `orientSignalWiring` acepta
   * receptor→receptor (misma ronda) eso alcanza para alimentar a otras piezas.
   * Que la demanda NO sea transitiva (`emitter-fanout.ts`) es lo que hace que
   * intercalarlo sirva de algo: el sensor pasa a pagar 1 —el chip— en vez de 8.
   */
  "chip-circuito-generico": 8,

  // ── Piezas de mando: gobiernan mucho, pero cuestan y ocupan ───────────────
  "consola-mando-central": 12,
  "sistema-diagnostico": 12,
};

/**
 * Capacidad por defecto de un emisor sin entrada propia en la tabla: un sensor
 * suelto sostiene poco. Con los 7 consumidores del reporte (demanda 8) el
 * fotorreceptor NO da abasto, que es exactamente el caso que enseña la regla.
 */
export const DEFAULT_SIGNAL_OUTPUT_CAPACITY = 3;

/**
 * Capacidad de la salida de un `ACT` (el nodo emisor que la ronda 1 le agregó a
 * todo actuador). Encadenar puerta→puerta funciona; colgar media nave de una
 * puerta, no. Es más baja que la de un sensor a propósito: emitir su estado es
 * un efecto secundario de actuar, no la función de la pieza.
 */
export const ACTUATOR_OUTPUT_CAPACITY = 2;

/** Capacidad declarada de la salida de una pieza, o el default si no la declara. */
export function declaredSignalOutputCapacity(componentId: ComponentId): number {
  return SIGNAL_OUTPUT_CAPACITY_BY_COMPONENT[componentId] ?? DEFAULT_SIGNAL_OUTPUT_CAPACITY;
}
