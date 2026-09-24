import type { SectionAtmosphereTooltip } from "./widgets/mission-tooltip.js";

/**
 * Firma del contenido VIVO de atmósfera que muestra un tooltip abierto. El
 * tooltip se reconstruye cuando esta firma cambia, así que TODO campo de
 * `SectionAtmosphereTooltip` que se muestre tiene que entrar acá, redondeado a
 * lo que el jugador ve (si no, se reconstruye por ruido decimal en cada tick).
 *
 * Extraído de `floorplan-scene.ts` porque se quedó corto tres veces por el mismo
 * motivo — 14a-1 (temperatura), 14b-2 (oxígeno), 14b-3 (alarma química y
 * sustancias del aire): alguien agregaba un campo al contenido y nadie lo
 * agregaba a la clave, y el tooltip abierto mostraba el número del primer frame.
 * El test `tooltip-redraw-key.test.ts` recorre TODOS los campos del tipo y
 * falla si uno no mueve la firma: el campo siguiente ya no puede olvidarse en
 * silencio.
 */
export function atmosphereRedrawKey(atmosphere: SectionAtmosphereTooltip | undefined): string {
  if (!atmosphere) return "";
  return [
    Math.round(atmosphere.pressureKpa),
    atmosphere.trend,
    atmosphere.vacuum,
    Math.round(atmosphere.temperatureCelsius),
    atmosphere.heating,
    atmosphere.selfIgniting,
    atmosphere.chemicalAlarm,
    atmosphere.oxygen ? `${atmosphere.oxygen.percent}/${atmosphere.oxygen.bucket}` : "",
    atmosphere.wiringHeatCelsiusPerSecond === undefined ? "" : Math.round(atmosphere.wiringHeatCelsiusPerSecond * 10),
    (atmosphere.substanceStates ?? []).map((entry) => `${entry.name}/${entry.state}/${entry.percent}`).join(","),
  ].join(":");
}
