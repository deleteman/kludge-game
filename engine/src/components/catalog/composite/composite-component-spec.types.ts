/**
 * Forma de una entrada del catálogo de componentes COMPUESTOS (GDD 7.3-7.6).
 *
 * Vivía duplicada palabra por palabra en los cuatro catálogos de arquetipo
 * (`exploracion`/`guerra`/`investigacion`/`medica`) y sus copias ya habían
 * empezado a divergir — solo la de exploración tenía `footprint`. Se extrajo al
 * añadir `contains` en la ronda 1 de fixes de 13e, para no repetir el mismo
 * campo cuatro veces y que la quinta copia se olvide.
 */

import type { ComponentId } from "../../physical-component.types.js";
import type { ChemicalSubstanceId } from "../../../chemistry/chemical-substance.types.js";
import type { FunctionalProperties } from "../../../properties/functional.types.js";
import type { MaterialProperties } from "../../../properties/material.types.js";
import type { Footprint } from "../../../geometry/grid-position.types.js";
import type { Recipe } from "../../../composition/recipe.types.js";

export interface CompositeComponentSpec {
  readonly id: ComponentId;
  readonly name: string;
  readonly data: {
    readonly functional?: FunctionalProperties;
    readonly material?: MaterialProperties;
    /**
     * Footprint de catálogo — opcional (`CompositeComponentData.footprint`,
     * `components/physical-component.types.ts`): la mayoría de los compuestos
     * de catálogo pre-Fase-7 no lo tienen (se instalan solo vía mesa de
     * creación, que calcula su propio footprint). Poblarlo acá es necesario
     * únicamente para los compuestos que se colocan directo en el plano — vía
     * la capa Tiled `semillas` (`floorplan/instantiate-component-seeds.ts`) o
     * vía el kit inicial de nave (`floorplan/initial-ship-state.ts`).
     */
    readonly footprint?: Footprint;
  };
  readonly recipe: Recipe<ComponentId>;
  /**
   * Sustancia que este reservorio trae DE FÁBRICA (Subfase 13e, ronda 1 de
   * fixes de playtest). Es dato de CATÁLOGO — el estado vivo sigue siendo
   * `Blueprint.reservoirContents`, que es lo que se llena, se vacía y se
   * serializa por partida.
   *
   * Existía desde siempre como comentario (`// Nota: contiene X`) en las 21
   * entradas con `RES` de sustancia, pero nunca como dato: por eso TODOS los
   * reservorios nacían vacíos y el ciclo de 13e no tenía de dónde sacar materia
   * prima en partida real. `reservoir/initial-reservoir-contents.ts` lo consume
   * al crear la campaña, llenándolos a su `capacity`.
   *
   * Solo tiene efecto si la pieza declara además `RES` de tipo G/L/T: en una
   * batería (`RES(E)`, Fase 13b) se ignora.
   */
  readonly contains?: ChemicalSubstanceId;
}
