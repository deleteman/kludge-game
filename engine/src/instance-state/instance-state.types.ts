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
 * `unsignaled` (ronda 2 de playtest de 14a-4) es el tercero, y llega por el
 * mismo camino: el triaje de fan-out (`signals/emitter-fanout.ts`) hace que una
 * pieza deje de responder porque su emisor no da abasto, y sin este flag el
 * jugador vería una puerta cableada que simplemente no se abre, sin ninguna
 * pista de por qué. El pedido del operador fue explícito: "un icono nuevo, como
 * el rayo cuando no tienen energía", y que los dos estados **puedan convivir**.
 *
 * `frozen-content` (Subfase 14a-3) es el cuarto, y vuelve a cobrar la promesa:
 * el contenido de un reservorio en una sala bajo el punto de fusión queda
 * sólido y no se puede mover. Sin el flag, el jugador vería un tanque con
 * sustancia dentro cuyos botones están todos grises, y el panel es justamente
 * lo que NO tiene que hacer falta abrir para entender el plano.
 *
 * Candidatos que siguen pendientes con la infraestructura ya lista: pieza
 * sobre una brecha sin sellar, reservorio vacío.
 */
export type InstanceStateFlag = "unpowered" | "overloaded" | "unsignaled" | "frozen-content";

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
  /**
   * Lo que se PIDE. `unpowered`: las unidades que demanda la pieza.
   * `unsignaled`: la demanda total colgada del emisor que la gobierna — el
   * número que hay que bajar. `frozen-content`: la temperatura a la que se
   * destraba (el punto de fusión de la sustancia).
   */
  readonly required?: number;
  /**
   * Lo que HAY. `unpowered`: unidades otorgadas a su sección este tick.
   * `unsignaled`: la capacidad de salida de ese emisor. `frozen-content`: la
   * temperatura ACTUAL de la sección.
   */
  readonly available?: number;
}
