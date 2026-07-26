/**
 * Máquina de estados explícita de una crisis (CLAUDE.md: "State machine
 * explícita … no banderas booleanas sueltas"), mismo criterio que `TaskState`
 * (`tasks/task.types.ts`). Transiciones válidas:
 *
 *   not-triggered ──(trigger aplica)──▶ active ──(resolución aplica)──▶ resolved-success
 *                                          │
 *                                          └──(timer expira)──▶ resolved-failure | resolved-partial
 *
 * `resolved-partial` está reservado para desenlaces de "resolvió pero
 * improvisó mal" (ej. capítulo 1, "leve pérdida de tiempo si el jugador
 * improvisa mal") — lo decide `CrisisTimerConfig.onExpire` de cada crisis, no
 * la máquina genérica.
 */
export type CrisisState =
  | "not-triggered"
  | "active"
  | "resolved-success"
  | "resolved-failure"
  | "resolved-partial";

/** Estados de los que ninguna transición sale (la crisis ya terminó su vida). */
export const TERMINAL_CRISIS_STATES: ReadonlySet<CrisisState> = new Set<CrisisState>([
  "resolved-success",
  "resolved-failure",
  "resolved-partial",
]);
