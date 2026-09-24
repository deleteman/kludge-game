import type { Comparator } from "./instance-config.types.js";

/**
 * Compara una lectura contra un umbral. `=` sobre una magnitud continua no
 * puede ser igualdad exacta (una temperatura nunca vale justo 60.000…): se
 * entiende como "dentro de `tolerance` del valor", y cada sensor declara la
 * suya (`sensor-thresholds.ts`). `<=`/`>=` incluyen ese mismo margen para que
 * `>=` y `=` sean coherentes en el borde.
 */
export function compareReading(reading: number, comparator: Comparator, value: number, tolerance: number): boolean {
  switch (comparator) {
    case "<":
      return reading < value;
    case ">":
      return reading > value;
    case "<=":
      return reading <= value + tolerance;
    case ">=":
      return reading >= value - tolerance;
    case "=":
      return Math.abs(reading - value) <= tolerance;
  }
}

/**
 * ¿El comparador es de "exceso" (dispara al SUPERAR el valor)? Es la dirección
 * de una alarma de contaminación: los avisos de sala (tooltip, siseo) sólo
 * pueden apoyarse en umbrales así, porque uno de "defecto" o de igualdad se
 * cumple con aire limpio y no dice nada de una fuga.
 */
export function isExcessComparator(comparator: Comparator): boolean {
  return comparator === ">" || comparator === ">=";
}
