/**
 * Umbral de "fuga activa" para el Sensor de Presión (Subfase 11h, caso 19):
 * cualquier caída bajo la atmósfera estándar (`standardSectionAtmosphere`,
 * 101 kPa) cuenta como disparo — decisión explícita del operador, sin margen
 * de tolerancia. `Especificacion_datos_tecnicos.md` no define un umbral de
 * presión-peligro; si a futuro se agrega uno, reemplazar esta constante.
 *
 * Desde 14b-3 es el valor de FÁBRICA: cada instancia puede fijar el suyo
 * (`instance-config/`). Vive acá, y no en el resolvedor del sensor, para que
 * `instance-config/` pueda leerlo sin un import circular con `mission/`.
 */
export const PRESSURE_SENSOR_TRIGGER_KPA = 101;
