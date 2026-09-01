import type { EffectArea, GridPosition } from "../particle-effect.types.js";
import { CELL } from "../particle-utils.js";

/**
 * Cómo un fenómeno de ATMÓSFERA cubre su sala (ronda 1 de playtest de 14a-2).
 *
 * Archivo aparte de `atmosphere-state-effects.ts` por la regla de una
 * responsabilidad por archivo: allá vive "qué partícula es cada fenómeno",
 * acá "cuánta superficie ocupa y con qué densidad". Los tres efectos comparten
 * estas dos preguntas, y tenerlas en un solo lugar es lo que impide arreglar la
 * escarcha y dejar a sus dos hermanos con el mismo defecto — el patrón de
 * "arreglar un indicador y dejar rotos a los de al lado" que ya costó rondas
 * en este proyecto.
 *
 * El defecto que corrige: `initSectionAtmosphereEffects` creaba UN emisor por
 * sección en su celda centroide con `spreadRange(10)` — 10 píxeles, o sea menos
 * de una celda, dentro de salas de 30-60 celdas. Los tres fenómenos de sala se
 * veían como un punto en el medio de la sala.
 */

/**
 * Zona de emisión que reparte partículas sobre las CELDAS REALES de la sección.
 *
 * Deliberadamente no es un rectángulo: el bounding box de una sección incluye
 * pared y, en las secciones en L del mapa real, trozos de pasillo ajeno —
 * pintaría escarcha en salas que no están frías, que es peor que no pintarla
 * (principio 6: la representación tiene que corresponder al estado del motor).
 *
 * Devuelve coordenadas de MUNDO en píxeles, no offsets: el emisor se crea en
 * (0,0) y Phaser suma la posición del emisor al punto de la zona. Así el efecto
 * no necesita saber dónde cae el centroide de nada.
 *
 * Un emisor por sección, igual que antes — la cobertura sale de la zona, no de
 * multiplicar emisores por celda, que en una nave de 335 celdas serían cientos
 * de emisores vivos por fenómeno.
 */
export function sectionEmitZone(area: EffectArea): {
  type: "random";
  source: { getRandomPoint(point: { x: number; y: number }): { x: number; y: number } };
} {
  const cells: ReadonlyArray<GridPosition> = area.cells.length > 0 ? area.cells : [{ x: 0, y: 0 }];
  return {
    type: "random",
    source: {
      getRandomPoint(point) {
        const cell = cells[Math.floor(Math.random() * cells.length)]!;
        // Punto al azar DENTRO de la celda, no su esquina: sin el jitter las
        // partículas salen alineadas a la grilla y se lee como un patrón
        // regular en vez de como una sala llena de vapor.
        point.x = cell.x * CELL + Math.random() * CELL;
        point.y = cell.y * CELL + Math.random() * CELL;
        return point;
      },
    },
  };
}

/**
 * Partículas por emisión para cubrir una sala de `cellCount` celdas.
 *
 * Escala con el ÁREA y no es fija: la densidad percibida es partículas /
 * superficie, así que un número fijo hace que la misma severidad se lea densa
 * en un armario y vacía en el hangar. El techo existe porque a partir de cierta
 * cantidad la sala se vuelve una pantalla opaca y deja de leerse lo que hay
 * debajo — que es el fenómeno que el jugador tiene que diagnosticar.
 */
const PARTICLES_PER_CELL = 0.16;
const MAX_PARTICLES_PER_EMISSION = 14;

/**
 * Densidad final: severidad × área, en una sola función porque los tres efectos
 * deben responder igual a lo mismo.
 *
 * `severity` es 0 en el umbral y 1 en el extremo del rango. El piso de 0.35 es
 * deliberado: en el umbral exacto el fenómeno tiene que verse igual — es el
 * momento en que empieza a doler y es justo cuando el jugador necesita el
 * aviso. Lo que la severidad agrega es cuánto PEOR se puso, no si se ve.
 */
export function coverageQuantity(cellCount: number, severity: number): number {
  const byArea = Math.min(MAX_PARTICLES_PER_EMISSION, Math.max(1, cellCount * PARTICLES_PER_CELL));
  const clamped = Math.min(1, Math.max(0, severity));
  return Math.max(1, Math.round(byArea * (0.35 + 0.65 * clamped)));
}

/**
 * Cuánto se pasó del umbral, normalizado a 0..1 contra el extremo del rango.
 * Sirve para los dos lados del eje térmico: el llamador pasa el umbral y el
 * extremo en el orden que corresponda a su lado.
 */
export function thresholdSeverity(value: number, onset: number, extreme: number): number {
  const span = extreme - onset;
  if (span === 0) return 1;
  return Math.min(1, Math.max(0, (value - onset) / span));
}
