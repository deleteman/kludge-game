/**
 * Catálogo de compuestos/sustancias pre-mezcladas (GDD 5.4.2 + 5.4.3 + Especificación §3).
 * Incluye compuestos derivados y sustancias funcionales de inventario inicial.
 * Nota: desinfectante es el único caso de receta anidada (yodo + agua); el resto son elemento→compuesto.
 * Placeholders para "Fluido biológico" y "Sustancia médica genérica" (deferred, GDD 7.6).
 *
 * **Puntos de transición (Subfase 14a-3)**: obligatorios, con el mismo criterio
 * que `element-catalog.ts` — dentro de la ventana térmica jugable (-80 a ~157 °C,
 * medida; ver `element-catalog.ts`)
 * para las sustancias cuyo cambio de estado es una mecánica, y fuera de ella,
 * deliberadamente, para los metales y minerales.
 *
 * Las tres que sostienen el diseño de la subfase:
 *  - **Agua** (0 / 100): los dos puntos alcanzables, es la referencia legible.
 *  - **Combustible de motor** (-60 / 75): se congela con el enfriador y se
 *    evapora con poco calor. Evaporado entra a la atmósfera y pasa a ser
 *    reactivo de `CombustionRule` — es la cadena derrame → vapor → ignición.
 *  - **Disolvente volátil** (-90 / 56): se evapora con menos calor todavía, que
 *    es lo que su nombre y su tag `VOLAT` prometen. Desde 14a-3 "volátil" se
 *    autora como un punto de ebullición bajo y no como una excepción en
 *    `isAirborneSubstance`.
 */

import type { ChemicalSubstanceId } from "../chemical-substance.types.js";
import type { ChemicalProperties } from "../../properties/chemical-tag.types.js";
import type { AuthoredSubstanceData } from "../phase/phase-change.types.js";
import type { Recipe } from "../../composition/recipe.types.js";

export interface CompoundSpec {
  readonly id: ChemicalSubstanceId;
  readonly name: string;
  /** `state` y los dos puntos son obligatorios: ver `ElementSpec`. */
  readonly data: { readonly tags: ChemicalProperties } & AuthoredSubstanceData;
  readonly recipe?: Recipe<ChemicalSubstanceId>;
}

export const COMPOUND_CATALOG: ReadonlyArray<CompoundSpec> = [
  // Compuestos derivados (GDD 5.4.2 ejemplos)
  {
    id: "agua" as ChemicalSubstanceId,
    name: "Agua",
    data: {
      tags: [{ name: "INERTE" }],
      state: "L",
      meltingPointCelsius: 0,
      boilingPointCelsius: 100,
    },
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
    data: {
      tags: [{ name: "INERTE" }],
      state: "S",
      meltingPointCelsius: 801,
      boilingPointCelsius: 1465,
    },
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
    data: {
      tags: [{ name: "ACID" }, { name: "CORR", level: "M" }],
      state: "L",
      meltingPointCelsius: -20,
      boilingPointCelsius: 110,
    },
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
    data: {
      tags: [{ name: "INERTE" }],
      state: "G",
      // Sublima: los dos puntos van pegados a propósito, así que la franja
      // líquida es de un grado y en la práctica pasa de sólido a gas.
      meltingPointCelsius: -79,
      boilingPointCelsius: -78,
    },
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
    data: {
      tags: [{ name: "TOX", level: "M" }],
      state: "G",
      // Condensa a -33: un tóxico en el aire se puede sacar del aire enfriando
      // la sala, que es una solución de sistemas y no una pieza dedicada.
      meltingPointCelsius: -78,
      boilingPointCelsius: -33,
    },
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
    data: {
      tags: [{ name: "INERTE" }],
      state: "S",
      meltingPointCelsius: 1565,
      boilingPointCelsius: 2500,
    },
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
    data: {
      tags: [{ name: "OXI" }],
      state: "L",
      // Los dos puntos alcanzables: un oxidante evaporado enriquece el aire y
      // vuelve `high` el bucket de combustión de la sala (GDD 5.5).
      meltingPointCelsius: -1,
      boilingPointCelsius: 150,
    },
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
    data: {
      tags: [{ name: "INERTE" }],
      state: "S",
      meltingPointCelsius: 2852,
      boilingPointCelsius: 3600,
    },
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
    data: {
      tags: [{ name: "INERTE" }],
      state: "S",
      meltingPointCelsius: 1400,
      boilingPointCelsius: 2860,
    },
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
    data: {
      tags: [{ name: "INERTE" }],
      state: "S",
      meltingPointCelsius: 930,
      boilingPointCelsius: 1100,
    },
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
    data: {
      tags: [{ name: "INERTE" }],
      state: "L",
      meltingPointCelsius: -95,
      boilingPointCelsius: 48,
    },
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
    data: {
      tags: [{ name: "COMB" }, { name: "VOLAT" }],
      state: "L",
      // La sustancia que sostiene la cadena de ignición de 14a-3: derramada es
      // un charco inofensivo, evaporada es un reactivo `COMB` en el aire.
      //
      // Los 75 °C de ebullición están DEBAJO de `AUTOIGNITION_CELSIUS` (90) a
      // propósito, y ahí está el hueco jugable de toda la mecánica: entre 75 y
      // 89 la sala tiene vapor inflamable y ninguna fuente de ignición, o sea
      // que el jugador puede cebar una sala y decidir CUÁNDO encenderla. Con el
      // orden invertido —vapor solo por encima del umbral de autoignición— la
      // chispa no habría hecho falta nunca y el charco habría ardido solo.
      meltingPointCelsius: -60,
      boilingPointCelsius: 75,
    },
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
    data: {
      tags: [{ name: "ACID" }, { name: "CORR", level: "A" }],
      state: "L",
      meltingPointCelsius: -35,
      boilingPointCelsius: 110,
    },
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
    data: {
      tags: [{ name: "BASE" }],
      state: "L",
      meltingPointCelsius: -10,
      boilingPointCelsius: 103,
    },
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
    data: {
      tags: [{ name: "VOLAT" }, { name: "COMB" }],
      state: "L",
      meltingPointCelsius: -90,
      boilingPointCelsius: 56,
    },
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
    data: {
      tags: [{ name: "TOX", level: "controlado" }],
      state: "G",
      meltingPointCelsius: -91,
      boilingPointCelsius: -88,
    },
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
    data: {
      tags: [{ name: "CORR", level: "B" }],
      state: "L",
      meltingPointCelsius: -15,
      boilingPointCelsius: 78,
    },
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
    data: {
      tags: [{ name: "OXI" }, { name: "COMB" }],
      state: "S",
      // Por encima de todo lo que el motor puede sostener (~157): el propelente no
      // se funde por estar cerca del fuego, arde.
      meltingPointCelsius: 334,
      boilingPointCelsius: 450,
    },
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
    data: {
      tags: [{ name: "INERTE" }],
      state: "L",
      meltingPointCelsius: -2,
      boilingPointCelsius: 99,
    },
    // Nota: categoría especial referida a "contenido narrativo" en GDD 7.6, "Banco de sangre/fluidos".
    // Sin receta ni tags químicos definidos. Pendiente de playtesting/contenido narrativo.
  },
  {
    id: "sustancia-medica-generica" as ChemicalSubstanceId,
    name: "Sustancia médica genérica",
    data: {
      tags: [{ name: "INERTE" }],
      state: "L",
      meltingPointCelsius: -5,
      boilingPointCelsius: 100,
    },
    // Nota: placeholder para "varias sustancias médicas en compartimentos separados" (GDD 7.6, Farmacia automatizada).
    // Pendiente de expansión en Fase 9 o diseño de contenido narrativo posterior.
  },
];
