/**
 * Comportamiento lógico de un nodo de señal (GDD 5.6). Decisión de Fase 2
 * (confirmada con el operador): la combinación de señales se declara como dato
 * explícito en el nodo — un "nodo combinador" (caso de validación 4) es un
 * dato, no un tipo de componente hardcodeado. Cada comportamiento se evalúa
 * con una Strategy propia (`signals/rules/`), no con un switch central
 * (CLAUDE.md, patrón Strategy para las reglas de 5.6).
 *
 * La emergencia (principio de diseño 1) se mantiene: el jugador obtiene AND /
 * OR / NOT / memoria / reloj según CÓMO conecta y configura los nodos, no
 * porque exista un componente llamado "compuerta AND". Los combos válidos
 * emergen de este comportamiento + la topología del grafo, no de identidades
 * de componente.
 */

/** AND/OR/NOT — combinación combinacional pura de las entradas. */
export type GateMode = "AND" | "OR" | "NOT";

export interface GateBehavior {
  readonly kind: "gate";
  readonly mode: GateMode;
}

/**
 * Memoria/latch (GDD 5.6). Set-Reset con reset de prioridad absoluta (caso 4).
 * Las entradas se distinguen por el puerto del edge (`toPort` "set"/"reset");
 * sin puerto = tratado como "set".
 */
export interface LatchBehavior {
  readonly kind: "latch";
}

/**
 * Oscilador/reloj (GDD 5.6, "permite construir relojes/osciladores"). Onda
 * cuadrada: alterna su salida cada `periodSeconds`. Con entradas actúa como
 * oscilador con enable (corre solo mientras alguna entrada está activa); sin
 * entradas, corre libre.
 */
export interface OscillatorBehavior {
  readonly kind: "oscillator";
  readonly periodSeconds: number;
}

/**
 * Delay de propagación (GDD 5.6, "delay de propagación variable según material
 * del conductor"). La salida sigue a la entrada (OR de entradas) tras
 * `delaySeconds`. Un conductor con material lento se modela con este
 * comportamiento; en Fase 4/5 el `delaySeconds` se derivará del material real.
 */
export interface DelayBehavior {
  readonly kind: "delay";
  readonly delaySeconds: number;
}

/**
 * Sin lógica: la salida es el OR de las entradas. Comportamiento por defecto
 * de un nodo sin `behavior` declarado (retrocompatible con los nodos de
 * Fase 1) — conductores y receptores simples pasan la señal tal cual.
 */
export interface PassthroughBehavior {
  readonly kind: "passthrough";
}

export type SignalBehavior =
  GateBehavior | LatchBehavior | OscillatorBehavior | DelayBehavior | PassthroughBehavior;

export const DEFAULT_SIGNAL_BEHAVIOR: PassthroughBehavior = { kind: "passthrough" };
