/**
 * Estados NOTABLES de una pieza instalada (Subfase 13h, ronda 3 de playtest).
 *
 * "Notable" = algo que el jugador tiene que poder ver sobre el plano sin abrir
 * ningún panel, porque cambia lo que la pieza hace. No son todos los datos de
 * una instancia: `condition` y `wear` ya viven en el blueprint y se resuelven
 * junto a estos en la tabla visual de `/game`; acá van los estados que se
 * DERIVAN del mundo y no están escritos en ningún lado.
 *
 * Nació con uno solo a propósito. El pedido del operador fue un sistema
 * genérico, y lo que lo vuelve genérico no es arrancar con muchos estados sino
 * que agregar el próximo sea **una consulta más y una fila más en la tabla**,
 * sin tocar ninguna decisión central.
 *
 * `overloaded` (ronda 1 de playtest de 14a-2) es el primer cobro de esa
 * promesa, y llegó por donde el propio docblock lo anunciaba: la
 * infraestructura (`Blueprint.overloadedRefs`) estaba lista desde la Fase 12a.
 * El operador lo pidió con "el cable no muestra ningún estado en su tooltip" —
 * 14a-2 cerró el acoplamiento térmico que CORTA conductores y dejó sin hacer
 * la mitad visible: la pieza cambiaba de comportamiento y no lo decía en
 * ninguna parte.
 *
 * Candidatos que siguen pendientes con la infraestructura ya lista: pieza
 * sobre una brecha sin sellar, reservorio vacío.
 */
export type InstanceStateFlag = "unpowered" | "overloaded";

/**
 * Detalle numérico opcional de un estado. Existe porque el aviso útil no es
 * "sin energía" sino "pide 2, la sección otorga 1" — el número es lo que le
 * dice al jugador cuánto le falta, y sin él el aviso describe el síntoma sin
 * dar la salida.
 *
 * Se transporta como datos y no como texto ya compuesto: la capa de
 * localización vive en `/game` y el motor no arma strings de UI (CLAUDE.md).
 */
export interface InstanceState {
  readonly flag: InstanceStateFlag;
  /** Unidades que la pieza demanda. Solo para `unpowered`. */
  readonly required?: number;
  /** Unidades otorgadas a su sección este tick. Solo para `unpowered`. */
  readonly available?: number;
}
