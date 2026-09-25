import type { NodeLogicSummary } from "engine";
import { t } from "../i18n/i18n.js";

/**
 * Texto del estado interno de un nodo de señal (Deuda #56), para el tooltip y el
 * panel. `switch` exhaustivo por variante, como `formatLcdValue`: agregar una
 * variante a `NodeLogicSummary` sin formatearla no compila, en vez de mostrar
 * una línea vacía. Las palabras salen de la i18n (CLAUDE.md).
 *
 * También es la FIRMA de redibujo (`tooltip-redraw-key.ts`): el texto cambia si
 * y sólo si lo que el jugador ve cambia, así que la firma no puede quedarse
 * corta (un campo nuevo que se muestra cambia el texto) ni ser ruidosa (un
 * decimal que no se muestra no lo cambia). El tiempo restante de un retardo se
 * redondea hacia arriba a segundos enteros por eso mismo.
 */
export function formatNodeLogic(summary: NodeLogicSummary): string {
  const yesNo = (on: boolean): string => t(on ? "ui.floorplan.mission.logic.on" : "ui.floorplan.mission.logic.off");
  switch (summary.kind) {
    case "gate":
      return t("ui.floorplan.mission.logic.gate")
        .replace("{mode}", t(`ui.floorplan.mission.logic.mode.${summary.mode}`))
        .replace("{active}", String(summary.inputs.active))
        .replace("{total}", String(summary.inputs.total))
        .replace("{output}", yesNo(summary.output));
    case "latch":
      return t(summary.engaged ? "ui.floorplan.mission.logic.latch-engaged" : "ui.floorplan.mission.logic.latch-free");
    case "counter":
      return t(summary.reached ? "ui.floorplan.mission.logic.counter-reached" : "ui.floorplan.mission.logic.counter")
        .replace("{count}", String(summary.count))
        .replace("{threshold}", String(summary.threshold));
    case "oscillator":
      return t(summary.running ? "ui.floorplan.mission.logic.oscillator-running" : "ui.floorplan.mission.logic.oscillator-stopped")
        .replace("{period}", String(summary.periodSeconds))
        .replace("{output}", yesNo(summary.output));
    case "delay":
      return summary.pending
        ? t("ui.floorplan.mission.logic.delay-pending").replace("{seconds}", String(Math.ceil(summary.remainingSeconds)))
        : t("ui.floorplan.mission.logic.delay-idle")
            .replace("{delay}", String(summary.delaySeconds))
            .replace("{output}", yesNo(summary.output));
  }
}
