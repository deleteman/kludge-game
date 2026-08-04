import type { ComponentId } from "../components/physical-component.types.js";
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
 * Excepción (Fase 13b, ronda 2 de playtest): Exploración siembra una fuente
 * real de energía (`bateria-celda-simple`, `powerUnits: 1`) en `{x:23,y:12}`
 * — celda dentro de `ingenieria`, confirmada libre de paredes y sin colisión
 * con el `cable-cobre` del demo de Fase 12a (`{x:22,y:12}`) contra
 * `nave-exploracion.json`. Sin esto el presupuesto total de energía arranca
 * en 0 y el slider de reparto no tiene nada que repartir desde el minuto uno.
 * Los demás arquetipos no tienen su mapa verificado todavía (mismo criterio
 * que el resto de este archivo), así que siguen con kit vacío.
 */
function starterKit(archetype: ShipArchetype): ReadonlyArray<PlacedComponentInstance> {
  if (archetype !== "exploracion") {
    return [];
  }
  return [
    {
      instanceId: "starter-bateria-celda-simple" as PlacedComponentInstanceId,
      componentDefinitionId: "bateria-celda-simple" as ComponentId,
      placement: { position: { x: 23, y: 12 }, footprint: { width: 1, height: 1 }, rotation: 0 },
      condition: "ok",
    },
  ];
}

export const INITIAL_SHIP_STATE_BY_ARCHETYPE: Record<
  ShipArchetype,
  ReadonlyArray<PlacedComponentInstance>
> = Object.fromEntries(
  SHIP_ARCHETYPES.map((archetype) => [archetype, starterKit(archetype)]),
) as Record<ShipArchetype, ReadonlyArray<PlacedComponentInstance>>;
