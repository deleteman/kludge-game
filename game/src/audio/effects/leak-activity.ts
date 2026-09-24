/**
 * Actividad de una fuga: cuánto está LLEGANDO gas a una sala, no cuánto hay.
 *
 * El siseo de fuga seguía a la concentración presente, y como una sustancia
 * vertida nunca desaparece de verdad (principio 5, sólo se redistribuye por
 * difusión) una sala que quedaba por encima del umbral sonaba PARA SIEMPRE:
 * al dejar de verter, el siseo seguía escuchándose más bajo (playtest de
 * 14b-3). Una fuga es un flujo; el residuo estático no es una fuga.
 *
 * Se mide la subida de concentración en una ventana corta y la intensidad
 * decae sola: cuando el gas deja de llegar, el siseo se apaga en segundos aunque
 * la sala siga contaminada (para eso están el tooltip y el escáner).
 */
export interface LeakActivityState {
  /** Concentración al inicio de la ventana en curso. */
  lastConcentration: number;
  /** Tiempo acumulado en la ventana en curso. */
  windowSeconds: number;
  /** Intensidad vigente, 0..1. */
  level: number;
}

/** Ventana de medición: la atmósfera cambia por ticks de simulación, no por frame. */
export const LEAK_WINDOW_SECONDS = 0.5;
/** Subida (fracción del aire por segundo) que suena a volumen pleno. */
export const LEAK_FULL_RISE_PER_SECOND = 0.004;
/** Por debajo de esta subida se considera difusión residual y no suena. */
export const LEAK_DEAD_ZONE_PER_SECOND = 0.0003;
/** Segundos que tarda un siseo a pleno en apagarse una vez que el gas deja de llegar. */
export const LEAK_FADE_SECONDS = 3;

export function createLeakActivityState(concentration = 0): LeakActivityState {
  return { lastConcentration: concentration, windowSeconds: 0, level: 0 };
}

/** Avanza el estado `deltaSeconds` con la concentración actual; devuelve la intensidad 0..1. */
export function advanceLeakActivity(state: LeakActivityState, concentration: number, deltaSeconds: number): number {
  if (deltaSeconds > 0) state.level = Math.max(0, state.level - deltaSeconds / LEAK_FADE_SECONDS);
  state.windowSeconds += Math.max(0, deltaSeconds);
  if (state.windowSeconds >= LEAK_WINDOW_SECONDS) {
    const rise = (concentration - state.lastConcentration) / state.windowSeconds;
    state.lastConcentration = concentration;
    state.windowSeconds = 0;
    if (rise > LEAK_DEAD_ZONE_PER_SECOND) {
      state.level = Math.max(state.level, Math.min(1, rise / LEAK_FULL_RISE_PER_SECOND));
    }
  }
  return state.level;
}
