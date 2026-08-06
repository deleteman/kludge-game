/**
 * Catálogo de componentes compuestos — aparatos de fabricación (Subfase 13e).
 *
 * A diferencia de los otros archivos de este directorio, este catálogo NO es
 * de un arquetipo: los dos aparatos son kit base de CUALQUIER nave y se
 * siembran en los 4 arquetipos (`floorplan/initial-ship-state.ts`).
 *
 * Ambos declaran la propiedad funcional `FAB` (GDD 5.1 extendido en 13e), que
 * es lo que habilita la mesa de creación en su dominio — el motor nunca
 * pregunta por el `ComponentId` (Principio 1: emergencia sobre recetas).
 *
 * La estación química declara además `RES` líquido: ese es su reservorio de
 * SALIDA, donde la síntesis deposita la sustancia resultante en vez de dejarla
 * como un id flotante sin ubicación (deuda #9).
 */

import type { ComponentId } from "../../physical-component.types.js";
import type { CompositeComponentSpec } from "./exploracion.js";

export const TALLER_CATALOG: ReadonlyArray<CompositeComponentSpec> = [
  {
    id: "banco-de-trabajo" as ComponentId,
    name: "Banco de trabajo",
    data: {
      functional: [
        { tag: "FAB", domain: "fisica" },
        { tag: "EST", damageResistance: 6 },
      ],
      material: { RE: "A" },
      footprint: { width: 2, height: 2 },
    },
    recipe: {
      ingredients: [
        { ref: "plancha-metalica" as ComponentId, quantity: 3 },
        { ref: "tornilleria-fijacion" as ComponentId, quantity: 4 },
        { ref: "chip-circuito-generico" as ComponentId, quantity: 1 },
      ],
    },
  },
  {
    id: "estacion-quimica" as ComponentId,
    name: "Estación química",
    data: {
      functional: [
        { tag: "FAB", domain: "quimica" },
        // Reservorio de salida: la síntesis deposita acá (13e.4).
        { tag: "RES", resourceType: "L", capacity: 50, dischargeRate: 5 },
        { tag: "EST", damageResistance: 4 },
      ],
      material: { RE: "M", CE: "N" },
      footprint: { width: 2, height: 2 },
    },
    recipe: {
      ingredients: [
        { ref: "plancha-metalica" as ComponentId, quantity: 2 },
        { ref: "tubo-rigido" as ComponentId, quantity: 2 },
        { ref: "valvula-simple" as ComponentId, quantity: 2 },
        { ref: "junta-hermetica" as ComponentId, quantity: 2 },
        { ref: "chip-circuito-generico" as ComponentId, quantity: 1 },
      ],
    },
  },
];
