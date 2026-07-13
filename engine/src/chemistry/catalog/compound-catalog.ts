/**
 * Catálogo de compuestos/sustancias pre-mezcladas (GDD 5.4.2 + 5.4.3 + Especificación §3).
 * Incluye compuestos derivados y sustancias funcionales de inventario inicial.
 * Nota: desinfectante es el único caso de receta anidada (yodo + agua); el resto son elemento→compuesto.
 * Placeholders para "Fluido biológico" y "Sustancia médica genérica" (deferred, GDD 7.6).
 */

import type { ChemicalSubstanceId } from "../chemical-substance.types.js";
import type { ChemicalProperties } from "../../properties/chemical-tag.types.js";
import type { MatterState } from "../../properties/material.types.js";
import type { Recipe } from "../../composition/recipe.types.js";

export interface CompoundSpec {
  readonly id: ChemicalSubstanceId;
  readonly name: string;
  readonly data: {
    readonly tags: ChemicalProperties;
    readonly state?: MatterState;
  };
  readonly recipe?: Recipe<ChemicalSubstanceId>;
}

export const COMPOUND_CATALOG: ReadonlyArray<CompoundSpec> = [
  // Compuestos derivados (GDD 5.4.2 ejemplos)
  {
    id: "agua" as ChemicalSubstanceId,
    name: "Agua",
    data: { tags: [{ name: "INERTE" }], state: "L" },
    recipe: {
      ingredients: [
        { ref: "hidrogeno" as ChemicalSubstanceId, quantity: 2 },
        { ref: "oxigeno" as ChemicalSubstanceId, quantity: 1 },
      ],
    },
    // Nota: extingue fuego, reacciona violento con Na/K/Li (no modelado).
  },
  {
    id: "sal-comun" as ChemicalSubstanceId,
    name: "Sal común",
    data: { tags: [{ name: "INERTE" }], state: "S" },
    recipe: {
      ingredients: [
        { ref: "sodio" as ChemicalSubstanceId, quantity: 1 },
        { ref: "cloro" as ChemicalSubstanceId, quantity: 1 },
      ],
    },
  },
  {
    id: "acido-de-laboratorio" as ChemicalSubstanceId,
    name: "Ácido de laboratorio (ácido clorhídrico)",
    data: { tags: [{ name: "ACID" }, { name: "CORR", level: "M" }], state: "L" },
    recipe: {
      ingredients: [
        { ref: "hidrogeno" as ChemicalSubstanceId, quantity: 1 },
        { ref: "cloro" as ChemicalSubstanceId, quantity: 1 },
      ],
    },
    // Nota: GDD 5.4.2 la nombra "Ácido clorhídrico" como ejemplo; 5.4.3/Especif. §3 la llama "Ácido de laboratorio" en el inventario funcional.
  },
  {
    id: "dioxido-de-carbono" as ChemicalSubstanceId,
    name: "Dióxido de carbono",
    data: { tags: [{ name: "INERTE" }], state: "G" },
    recipe: {
      ingredients: [
        { ref: "carbono" as ChemicalSubstanceId, quantity: 1 },
        { ref: "oxigeno" as ChemicalSubstanceId, quantity: 2 },
      ],
    },
    // Nota: asfixiante en alta concentración (TOX indirecto, no modelado).
  },
  {
    id: "amoniaco" as ChemicalSubstanceId,
    name: "Amoníaco",
    data: { tags: [{ name: "TOX", level: "M" }], state: "G" },
    recipe: {
      ingredients: [
        { ref: "nitrogeno" as ChemicalSubstanceId, quantity: 1 },
        { ref: "hidrogeno" as ChemicalSubstanceId, quantity: 1 },
      ],
    },
  },
  {
    id: "oxido-de-hierro" as ChemicalSubstanceId,
    name: "Óxido de hierro (herrumbre)",
    data: { tags: [{ name: "INERTE" }], state: "S" },
    recipe: {
      ingredients: [
        { ref: "hierro" as ChemicalSubstanceId, quantity: 1 },
        { ref: "oxigeno" as ChemicalSubstanceId, quantity: 1 },
      ],
    },
    // Nota: degrada resistencia estructural con el tiempo (no modelado como regla).
  },
  {
    id: "peroxido" as ChemicalSubstanceId,
    name: "Peróxido",
    data: { tags: [{ name: "OXI" }], state: "L" },
    recipe: {
      ingredients: [
        { ref: "hidrogeno" as ChemicalSubstanceId, quantity: 2 },
        { ref: "oxigeno" as ChemicalSubstanceId, quantity: 2 },
      ],
    },
    // Nota: proporción distinta de agua (H+O 2:2 vs agua 2:1).
  },
  {
    id: "oxido-de-magnesio" as ChemicalSubstanceId,
    name: "Óxido de magnesio",
    data: { tags: [{ name: "INERTE" }], state: "S" },
    recipe: {
      ingredients: [
        { ref: "magnesio" as ChemicalSubstanceId, quantity: 1 },
        { ref: "oxigeno" as ChemicalSubstanceId, quantity: 1 },
      ],
    },
    // Nota: producto de combustión, base de bengala (no modelado).
  },
  {
    id: "acero" as ChemicalSubstanceId,
    name: "Acero",
    data: { tags: [{ name: "INERTE" }], state: "S" },
    recipe: {
      ingredients: [
        { ref: "hierro" as ChemicalSubstanceId, quantity: 1 },
        { ref: "carbono" as ChemicalSubstanceId, quantity: 1 },
      ],
    },
  },
  {
    id: "laton" as ChemicalSubstanceId,
    name: "Latón",
    data: { tags: [{ name: "INERTE" }], state: "S" },
    recipe: {
      ingredients: [
        { ref: "cobre" as ChemicalSubstanceId, quantity: 1 },
        { ref: "zinc" as ChemicalSubstanceId, quantity: 1 },
      ],
    },
  },

  // Sustancias funcionales pre-mezcladas (GDD 5.4.3 + Especificación §3)
  {
    id: "refrigerante-sintetico" as ChemicalSubstanceId,
    name: "Refrigerante sintético",
    data: { tags: [{ name: "INERTE" }], state: "L" },
    recipe: {
      ingredients: [
        { ref: "carbono" as ChemicalSubstanceId, quantity: 1 },
        { ref: "fluor" as ChemicalSubstanceId, quantity: 1 },
      ],
    },
  },
  {
    id: "combustible-de-motor" as ChemicalSubstanceId,
    name: "Combustible de motor",
    data: { tags: [{ name: "COMB" }, { name: "VOLAT" }], state: "L" },
    recipe: {
      ingredients: [
        { ref: "carbono" as ChemicalSubstanceId, quantity: 1 },
        { ref: "hidrogeno" as ChemicalSubstanceId, quantity: 1 },
      ],
    },
  },
  {
    id: "acido-de-bateria" as ChemicalSubstanceId,
    name: "Ácido de batería",
    data: { tags: [{ name: "ACID" }, { name: "CORR", level: "A" }], state: "L" },
    recipe: {
      ingredients: [
        { ref: "hidrogeno" as ChemicalSubstanceId, quantity: 1 },
        { ref: "azufre" as ChemicalSubstanceId, quantity: 1 },
        { ref: "oxigeno" as ChemicalSubstanceId, quantity: 4 },
      ],
    },
  },
  {
    id: "base-de-laboratorio" as ChemicalSubstanceId,
    name: "Base de laboratorio",
    data: { tags: [{ name: "BASE" }], state: "L" },
    recipe: {
      ingredients: [
        { ref: "sodio" as ChemicalSubstanceId, quantity: 1 },
        { ref: "oxigeno" as ChemicalSubstanceId, quantity: 1 },
        { ref: "hidrogeno" as ChemicalSubstanceId, quantity: 1 },
      ],
    },
  },
  {
    id: "disolvente-volatil" as ChemicalSubstanceId,
    name: "Disolvente volátil",
    data: { tags: [{ name: "VOLAT" }, { name: "COMB" }], state: "L" },
    recipe: {
      ingredients: [
        { ref: "carbono" as ChemicalSubstanceId, quantity: 1 },
        { ref: "hidrogeno" as ChemicalSubstanceId, quantity: 1 },
        { ref: "oxigeno" as ChemicalSubstanceId, quantity: 1 },
      ],
    },
  },
  {
    id: "anestesico-medico" as ChemicalSubstanceId,
    name: "Anestésico médico",
    data: { tags: [{ name: "TOX", level: "controlado" }], state: "G" },
    recipe: {
      ingredients: [
        { ref: "nitrogeno" as ChemicalSubstanceId, quantity: 1 },
        { ref: "oxigeno" as ChemicalSubstanceId, quantity: 1 },
      ],
    },
    // Nota: dosis baja=sedante, alta=letal (nivel "controlado" refleja el carácter dosis-dependiente).
  },
  {
    id: "desinfectante" as ChemicalSubstanceId,
    name: "Desinfectante",
    data: { tags: [{ name: "CORR", level: "B" }], state: "L" },
    recipe: {
      ingredients: [
        { ref: "yodo" as ChemicalSubstanceId, quantity: 1 },
        { ref: "agua" as ChemicalSubstanceId, quantity: 1 },
      ],
    },
    // Nota: ÚNICO caso de receta anidada (ingrediente es otro compuesto, no un elemento base).
  },
  {
    id: "propelente-oxidante-municion" as ChemicalSubstanceId,
    name: "Propelente/oxidante de munición",
    data: { tags: [{ name: "OXI" }, { name: "COMB" }], state: "S" },
    recipe: {
      ingredients: [
        { ref: "potasio" as ChemicalSubstanceId, quantity: 1 },
        { ref: "nitrogeno" as ChemicalSubstanceId, quantity: 1 },
        { ref: "oxigeno" as ChemicalSubstanceId, quantity: 3 },
      ],
    },
  },

  // Placeholders para sustancias sin definición en GDD/Especificación (GDD 7.6)
  {
    id: "fluido-biologico" as ChemicalSubstanceId,
    name: "Fluido biológico",
    data: { tags: [{ name: "INERTE" }], state: "L" },
    // Nota: categoría especial referida a "contenido narrativo" en GDD 7.6, "Banco de sangre/fluidos".
    // Sin receta ni tags químicos definidos. Pendiente de playtesting/contenido narrativo.
  },
  {
    id: "sustancia-medica-generica" as ChemicalSubstanceId,
    name: "Sustancia médica genérica",
    data: { tags: [{ name: "INERTE" }], state: "L" },
    // Nota: placeholder para "varias sustancias médicas en compartimentos separados" (GDD 7.6, Farmacia automatizada).
    // Pendiente de expansión en Fase 9 o diseño de contenido narrativo posterior.
  },
];
