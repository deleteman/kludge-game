import type { ComponentId } from "../components/physical-component.types.js";
import { DEFAULT_WEAR } from "../wear/wear.types.js";
import type { PlacedComponentInstance, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { ShipArchetype } from "./floorplan.types.js";
import { SHIP_ARCHETYPES } from "./floorplan.types.js";

/**
 * Estado inicial de componentes instalados por arquetipo (Fase 9.5, punto 5
 * del plan de esa fase). No existe todavía un "modo dev" de autoría (GDD
 * 15.2, Fase 11 punto 3) para fijar esto con la propia UI de juego.
 *
 * VACÍO por ahora (playtest #8): el kit placeholder de Fase 9.5 (plancha/
 * batería/cable en (0,0)/(3,0)/(4,0)) aparecía como piezas fantasma en la
 * esquina del plano, sin función en el capítulo 1 (el selector de instalación
 * ofrece las 20 piezas atómicas igual). Una partida nueva arranca solo con el
 * actuador atascado del capítulo 1, que añade `campaign-save-factory.ts`
 * aparte. Se conserva la estructura por si un capítulo futuro necesita sembrar
 * componentes reales por arquetipo desde el modo dev.
 *
 * Excepción (Fase 13b, rondas 2-3 de playtest): Exploración siembra fuentes
 * reales de energía. Sin ellas el presupuesto total arranca en 0 y el slider
 * de reparto no tiene nada que repartir; con una sola unidad (ronda 2) el
 * slider era binario (0 o 1), sin pasos intermedios. Ronda 3: 5×
 * `celula-fotovoltaica` (atómica, footprint 1×2, `powerUnits: 2`) = **10
 * unidades**, presupuesto elegido por el operador — 10 pasos reales de slider
 * y escasez temática frente a las ~11 secciones del arquetipo.
 *
 * Celdas verificadas libres decodificando `nave-exploracion.json` (capas
 * `walls`/`objects` más TODOS los objetos de `anclajes`/`conductos`/`semillas`,
 * y el `cable-cobre` del demo de Fase 12a en `{22,12}`). `ingenieria` solo
 * tiene 8 celdas libres y 3 pares verticales posibles (tope real de 6 unidades
 * con esta pieza), así que las 2 piezas restantes van a `propulsion` — sala de
 * máquinas, ubicación plausible para una fuente. Ninguna pisa los anclajes
 * `propulsion-a1..a5` (todos en `x:36`) ni la ruta del enemigo del Cap.2
 * (íntegra en `pasillo-central`, `y:9`).
 *
 * Los demás arquetipos no tienen su mapa verificado todavía (mismo criterio
 * que el resto de este archivo), así que siguen con kit vacío.
 */
const EXPLORACION_POWER_SOURCE_CELLS = [
  // `ingenieria` — 3 pares verticales libres (6 unidades).
  { x: 20, y: 11 },
  { x: 23, y: 12 },
  { x: 24, y: 11 },
  // `propulsion` — completan el presupuesto (4 unidades).
  { x: 34, y: 10 },
  { x: 37, y: 10 },
] as const;

function starterKit(archetype: ShipArchetype): ReadonlyArray<PlacedComponentInstance> {
  if (archetype !== "exploracion") {
    return [];
  }
  return EXPLORACION_POWER_SOURCE_CELLS.map((position, index) => ({
    instanceId: `starter-celula-fotovoltaica-${index + 1}` as PlacedComponentInstanceId,
    componentDefinitionId: "celula-fotovoltaica" as ComponentId,
    placement: { position, footprint: { width: 1, height: 2 }, rotation: 0 },
    condition: "ok" as const,
    // Equipamiento de arranque: sale de fábrica, sin historia (13c).
    wear: DEFAULT_WEAR,
  }));
}

export const INITIAL_SHIP_STATE_BY_ARCHETYPE: Record<
  ShipArchetype,
  ReadonlyArray<PlacedComponentInstance>
> = Object.fromEntries(
  SHIP_ARCHETYPES.map((archetype) => [archetype, starterKit(archetype)]),
) as Record<ShipArchetype, ReadonlyArray<PlacedComponentInstance>>;
