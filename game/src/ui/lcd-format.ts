import type { LcdDisplayValue } from "engine";
import { t } from "../i18n/i18n.js";

/**
 * Texto que muestra una pantalla LCD para su valor resuelto (Subfase 11h;
 * temperatura y química en 14b-3). Un `switch` exhaustivo por variante: agregar
 * una variante a `LcdDisplayValue` sin formatearla no compila, en vez de mostrar
 * `undefined` en la pantalla. Las unidades salen de la i18n (CLAUDE.md).
 */
export function formatLcdValue(value: LcdDisplayValue): string {
  switch (value.kind) {
    case "pressure":
      return `${value.pressureKpa.toFixed(1)} ${t("ui.floorplan.lcd.pressure-unit")}`;
    case "temperature":
      return `${value.temperatureCelsius.toFixed(1)} ${t("ui.floorplan.lcd.temperature-unit")}`;
    case "chemical":
      // Fracción del aire → porcentaje, que es como se lee una concentración.
      return `${(value.concentration * 100).toFixed(1)} ${t("ui.floorplan.lcd.chemical-unit")}`;
  }
}
