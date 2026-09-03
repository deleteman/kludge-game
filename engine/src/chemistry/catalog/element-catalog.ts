/**
 * Catálogo de elementos base (GDD 5.4.1) — nivel atómico químico.
 * 27 elementos con tags químicos conforme a la tabla de resolución en Fase 4.
 * Elementos sin tag existente que encaje usan INERTE por defecto; notas descriptivas quedan en comentarios.
 *
 * **Puntos de transición (Subfase 14a-3)**: cada entrada declara sus dos puntos,
 * obligatorios por tipo (`AuthoredSubstanceData`). No son física real, son
 * números de juego, y se eligen mirando la ventana térmica REALMENTE alcanzable
 * del motor —de -69 °C (equilibrio del enfriador) a ~161 °C (pico de una
 * combustión violenta)—:
 *  - Las sustancias cuyo cambio de estado es una MECÁNICA llevan sus puntos
 *    dentro de esa ventana (bromo, azufre, fósforo, sodio, potasio).
 *  - Los metales, minerales y gases nobles llevan puntos fuera de la ventana a
 *    propósito: son inertes al eje térmico, y eso es una decisión declarada, no
 *    un olvido. Sus valores siguen a la física real por trazabilidad.
 */

import type { ChemicalSubstanceId } from "../chemical-substance.types.js";
import type { ChemicalProperties } from "../../properties/chemical-tag.types.js";
import type { AuthoredSubstanceData } from "../phase/phase-change.types.js";

export interface ElementSpec {
  readonly id: ChemicalSubstanceId;
  readonly name: string;
  /**
   * `state` y los dos puntos son OBLIGATORIOS acá aunque sean opcionales en
   * `ChemicalSubstanceData`: ese tipo también describe productos sintetizados en
   * runtime, una entrada de catálogo no.
   */
  readonly data: { readonly tags: ChemicalProperties } & AuthoredSubstanceData;
}

export const ELEMENT_CATALOG: ReadonlyArray<ElementSpec> = [
  {
    id: "hidrogeno" as ChemicalSubstanceId,
    name: "Hidrógeno",
    data: {
      tags: [{ name: "COMB" }, { name: "VOLAT" }],
      state: "G",
      meltingPointCelsius: -259,
      boilingPointCelsius: -253,
    },
  },
  {
    id: "oxigeno" as ChemicalSubstanceId,
    name: "Oxígeno",
    data: {
      tags: [{ name: "OXI" }],
      state: "G",
      meltingPointCelsius: -218,
      boilingPointCelsius: -183,
    },
  },
  {
    id: "nitrogeno" as ChemicalSubstanceId,
    name: "Nitrógeno",
    data: {
      tags: [{ name: "INERTE" }],
      state: "G",
      meltingPointCelsius: -210,
      boilingPointCelsius: -196,
    },
  },
  {
    id: "carbono" as ChemicalSubstanceId,
    name: "Carbono",
    data: {
      tags: [{ name: "COMB" }],
      state: "S",
      meltingPointCelsius: 3550,
      boilingPointCelsius: 4027,
    },
  },
  {
    id: "cloro" as ChemicalSubstanceId,
    name: "Cloro",
    data: {
      tags: [{ name: "TOX", level: "M" }, { name: "CORR", level: "M" }],
      state: "G",
      // Su ebullición (-34) SÍ es alcanzable con el enfriador: un cloro tóxico
      // condensa a líquido en una sala muy fría y deja de estar en el aire.
      meltingPointCelsius: -101,
      boilingPointCelsius: -34,
    },
  },
  {
    id: "sodio" as ChemicalSubstanceId,
    name: "Sodio",
    data: {
      tags: [{ name: "INERTE" }],
      state: "S",
      // Funde a 98: alcanzable dentro de un incendio.
      meltingPointCelsius: 98,
      boilingPointCelsius: 883,
    },
    // Nota: reactivo violento con agua, no modelado.
  },
  {
    id: "potasio" as ChemicalSubstanceId,
    name: "Potasio",
    data: {
      tags: [{ name: "INERTE" }],
      state: "S",
      meltingPointCelsius: 63,
      boilingPointCelsius: 759,
    },
    // Nota: reactivo violento con agua (más intenso que sodio), no modelado.
  },
  {
    id: "hierro" as ChemicalSubstanceId,
    name: "Hierro",
    data: {
      tags: [{ name: "INERTE" }],
      state: "S",
      meltingPointCelsius: 1538,
      boilingPointCelsius: 2861,
    },
    // Nota: MAG-Sí, CE-M, estructural; no modelado en tags químicos.
  },
  {
    id: "cobre" as ChemicalSubstanceId,
    name: "Cobre",
    data: {
      tags: [{ name: "INERTE" }],
      state: "S",
      meltingPointCelsius: 1085,
      boilingPointCelsius: 2562,
    },
    // Nota: CE-A, no modelado en tags químicos.
  },
  {
    id: "aluminio" as ChemicalSubstanceId,
    name: "Aluminio",
    data: {
      tags: [{ name: "INERTE" }],
      state: "S",
      meltingPointCelsius: 660,
      boilingPointCelsius: 2470,
    },
    // Nota: RE-M, ligero, CE-M; no modelado en tags químicos.
  },
  {
    id: "azufre" as ChemicalSubstanceId,
    name: "Azufre",
    data: {
      tags: [{ name: "COMB" }],
      state: "S",
      meltingPointCelsius: 115,
      boilingPointCelsius: 445,
    },
  },
  {
    id: "fosforo" as ChemicalSubstanceId,
    name: "Fósforo",
    data: {
      tags: [{ name: "VOLAT" }],
      state: "S",
      meltingPointCelsius: 44,
      boilingPointCelsius: 280,
    },
  },
  {
    id: "fluor" as ChemicalSubstanceId,
    name: "Flúor",
    data: {
      tags: [{ name: "CORR", level: "A" }, { name: "TOX", level: "A" }],
      state: "G",
      meltingPointCelsius: -220,
      boilingPointCelsius: -188,
    },
  },
  {
    id: "helio" as ChemicalSubstanceId,
    name: "Helio",
    data: {
      tags: [{ name: "INERTE" }],
      state: "G",
      meltingPointCelsius: -272,
      boilingPointCelsius: -269,
    },
  },
  {
    id: "neon" as ChemicalSubstanceId,
    name: "Neón",
    data: {
      tags: [{ name: "INERTE" }],
      state: "G",
      meltingPointCelsius: -249,
      boilingPointCelsius: -246,
    },
  },
  {
    id: "argon" as ChemicalSubstanceId,
    name: "Argón",
    data: {
      tags: [{ name: "INERTE" }],
      state: "G",
      meltingPointCelsius: -189,
      boilingPointCelsius: -186,
    },
  },
  {
    id: "silicio" as ChemicalSubstanceId,
    name: "Silicio",
    data: {
      tags: [{ name: "INERTE" }],
      state: "S",
      meltingPointCelsius: 1414,
      boilingPointCelsius: 3265,
    },
    // Nota: base de receptores; no modelado en tags químicos.
  },
  {
    id: "calcio" as ChemicalSubstanceId,
    name: "Calcio",
    data: {
      tags: [{ name: "INERTE" }],
      state: "S",
      meltingPointCelsius: 842,
      boilingPointCelsius: 1484,
    },
    // Nota: estructural, reactivo con ácidos; no modelado en tags químicos.
  },
  {
    id: "magnesio" as ChemicalSubstanceId,
    name: "Magnesio",
    data: {
      tags: [{ name: "COMB" }],
      state: "S",
      meltingPointCelsius: 650,
      boilingPointCelsius: 1090,
    },
  },
  {
    id: "plomo" as ChemicalSubstanceId,
    name: "Plomo",
    data: {
      tags: [{ name: "INERTE" }],
      state: "S",
      meltingPointCelsius: 327,
      boilingPointCelsius: 1749,
    },
    // Nota: RE-A, denso, aislante de radiación; no modelado en tags químicos.
  },
  {
    id: "zinc" as ChemicalSubstanceId,
    name: "Zinc",
    data: {
      tags: [{ name: "INERTE" }],
      state: "S",
      meltingPointCelsius: 420,
      boilingPointCelsius: 907,
    },
    // Nota: CE-M, anticorrosivo; no modelado en tags químicos.
  },
  {
    id: "niquel" as ChemicalSubstanceId,
    name: "Níquel",
    data: {
      tags: [{ name: "INERTE" }],
      state: "S",
      meltingPointCelsius: 1455,
      boilingPointCelsius: 2913,
    },
    // Nota: MAG-Sí, resistente a corrosión; no modelado en tags químicos.
  },
  {
    id: "platino" as ChemicalSubstanceId,
    name: "Platino",
    data: {
      tags: [{ name: "INERTE" }],
      state: "S",
      meltingPointCelsius: 1768,
      boilingPointCelsius: 3825,
    },
    // Nota: catalizador (acelera reacciones sin consumirse), sin parámetro numérico definido (Especif. §5).
  },
  {
    id: "litio" as ChemicalSubstanceId,
    name: "Litio",
    data: {
      tags: [{ name: "INERTE" }],
      state: "S",
      meltingPointCelsius: 180,
      boilingPointCelsius: 1330,
    },
    // Nota: RES(E) alta densidad energética, reactivo con agua/aire; no modelado en tags químicos.
  },
  {
    id: "yodo" as ChemicalSubstanceId,
    name: "Yodo",
    data: {
      tags: [{ name: "TOX", level: "B" }],
      state: "S",
      meltingPointCelsius: 114,
      boilingPointCelsius: 184,
    },
  },
  {
    id: "bromo" as ChemicalSubstanceId,
    name: "Bromo",
    data: {
      tags: [{ name: "CORR", level: "M" }, { name: "TOX", level: "M" }],
      state: "L",
      // Los DOS puntos caen dentro de la ventana jugable: es la sustancia que
      // mejor ejercita el eje completo (se congela con el enfriador, se evapora
      // con un incendio menor).
      meltingPointCelsius: -7,
      boilingPointCelsius: 59,
    },
  },
  {
    id: "xenon" as ChemicalSubstanceId,
    name: "Xenón",
    data: {
      tags: [{ name: "INERTE" }],
      state: "G",
      meltingPointCelsius: -112,
      boilingPointCelsius: -108,
    },
    // Nota: ionizable (propulsión); no modelado en tags químicos.
  },
  {
    id: "titanio" as ChemicalSubstanceId,
    name: "Titanio",
    data: {
      tags: [{ name: "INERTE" }],
      state: "S",
      meltingPointCelsius: 1668,
      boilingPointCelsius: 3287,
    },
    // Nota: RE-A, ligero, resistente a corrosión, alto punto de fusión; no modelado en tags químicos.
  },
  // Nitrógeno líquido — variante de estado, no síntesis.
  {
    id: "nitrogeno-liquido" as ChemicalSubstanceId,
    name: "Nitrógeno líquido",
    data: {
      tags: [{ name: "INERTE" }],
      state: "L",
      /**
       * **Única sustancia del catálogo cuyo estado declarado y su estado
       * derivado a 21 °C NO coinciden**, y es deliberado: `state: "L"` describe
       * cómo está DENTRO del tanque criogénico sellado, y fuera de él se evapora
       * al instante — GDD línea 166, "cambia de estado fácilmente (se evapora a
       * gas)". Está declarada como excepción en `CRYOGENIC_SUBSTANCE_IDS`.
       *
       * Los números no son los reales (-210/-196, muy por debajo del clamp de
       * -80 del motor): con los reales la transición sería inalcanzable y el
       * derrame criogénico no podría desplazar oxígeno nunca. -60 lo deja
       * gaseoso en cualquier sala normal y líquido solo en una sala ya helada
       * por el propio enfriador.
       */
      meltingPointCelsius: -100,
      boilingPointCelsius: -60,
    },
    // Nota: estado líquido de nitrógeno, licuado vía equipamiento, no una síntesis elemento→compuesto.
  },
];

/**
 * Sustancias cuyo `state` de catálogo describe cómo están ALMACENADAS y no cómo
 * estarían sueltas a temperatura nominal. Es la lista de excepciones del test de
 * coherencia de datos: cualquier otra entrada cuyo estado derivado a 21 °C no
 * coincida con el declarado es un error de autoría, no una decisión.
 */
export const CRYOGENIC_SUBSTANCE_IDS: ReadonlySet<ChemicalSubstanceId> = new Set([
  "nitrogeno-liquido" as ChemicalSubstanceId,
]);
