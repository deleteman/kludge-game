/**
 * Cómo se muestra una MAGNITUD del motor en la UI (ronda 1 de playtest de
 * 14a-3).
 *
 * El operador reportó `-10.9483472938279` en el aviso de contenido congelado.
 * Al ir a arreglarlo aparecieron **tres copias** de la misma regla escritas a
 * mano en tres archivos (la capacidad de un cable en `floorplan-scene`, la
 * resistencia efectiva en `mission-interaction-controller`, y la que acabo de
 * escribir para el detalle de estado), y ninguna de las tres se conocía entre
 * sí. Es el patrón de 13c aplicado al formateo: si voy a tocar un cálculo,
 * primero contar cuántas copias tiene — antes de agregar la cuarta.
 *
 * La regla, una sola vez: **un decimal como máximo, sin `.0` sobrante.** Un
 * entero se lee como entero (`2`, no `2.0`), porque muchas de estas magnitudes
 * son unidades contables (energía otorgada, demanda de señal) y ahí el decimal
 * sería ruido; y un float del motor —una temperatura, una capacidad derateada—
 * se corta en la primera décima, que es toda la precisión que un jugador puede
 * usar para decidir algo.
 *
 * El motor sigue transportando el valor exacto: esto es cómo se DIBUJA, no cómo
 * se guarda. Redondear en el runtime dejaría a los otros consumidores con una
 * versión mutilada del dato.
 */
export function formatMeasure(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
