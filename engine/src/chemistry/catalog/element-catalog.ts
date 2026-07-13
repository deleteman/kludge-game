/**
 * Catálogo de elementos base (GDD 5.4.1) — nivel atómico químico.
 * 27 elementos con tags químicos conforme a la tabla de resolución en Fase 4.
 * Elementos sin tag existente que encaje usan INERTE por defecto; notas descriptivas quedan en comentarios.
 */

import type { ChemicalSubstanceId } from "../chemical-substance.types.js";
import type { ChemicalProperties } from "../../properties/chemical-tag.types.js";
import type { MatterState } from "../../properties/material.types.js";

export interface ElementSpec {
  readonly id: ChemicalSubstanceId;
  readonly name: string;
  readonly data: {
    readonly tags: ChemicalProperties;
    readonly state?: MatterState;
  };
}

export const ELEMENT_CATALOG: ReadonlyArray<ElementSpec> = [
  {
    id: "hidrogeno" as ChemicalSubstanceId,
    name: "Hidrógeno",
    data: { tags: [{ name: "COMB" }, { name: "VOLAT" }], state: "G" },
  },
  {
    id: "oxigeno" as ChemicalSubstanceId,
    name: "Oxígeno",
    data: { tags: [{ name: "OXI" }], state: "G" },
  },
  {
    id: "nitrogeno" as ChemicalSubstanceId,
    name: "Nitrógeno",
    data: { tags: [{ name: "INERTE" }], state: "G" },
  },
  {
    id: "carbono" as ChemicalSubstanceId,
    name: "Carbono",
    data: { tags: [{ name: "COMB" }], state: "S" },
  },
  {
    id: "cloro" as ChemicalSubstanceId,
    name: "Cloro",
    data: { tags: [{ name: "TOX", level: "M" }, { name: "CORR", level: "M" }], state: "G" },
  },
  {
    id: "sodio" as ChemicalSubstanceId,
    name: "Sodio",
    data: { tags: [{ name: "INERTE" }], state: "S" },
    // Nota: reactivo violento con agua, no modelado.
  },
  {
    id: "potasio" as ChemicalSubstanceId,
    name: "Potasio",
    data: { tags: [{ name: "INERTE" }], state: "S" },
    // Nota: reactivo violento con agua (más intenso que sodio), no modelado.
  },
  {
    id: "hierro" as ChemicalSubstanceId,
    name: "Hierro",
    data: { tags: [{ name: "INERTE" }], state: "S" },
    // Nota: MAG-Sí, CE-M, estructural; no modelado en tags químicos.
  },
  {
    id: "cobre" as ChemicalSubstanceId,
    name: "Cobre",
    data: { tags: [{ name: "INERTE" }], state: "S" },
    // Nota: CE-A, no modelado en tags químicos.
  },
  {
    id: "aluminio" as ChemicalSubstanceId,
    name: "Aluminio",
    data: { tags: [{ name: "INERTE" }], state: "S" },
    // Nota: RE-M, ligero, CE-M; no modelado en tags químicos.
  },
  {
    id: "azufre" as ChemicalSubstanceId,
    name: "Azufre",
    data: { tags: [{ name: "COMB" }], state: "S" },
  },
  {
    id: "fosforo" as ChemicalSubstanceId,
    name: "Fósforo",
    data: { tags: [{ name: "VOLAT" }], state: "S" },
  },
  {
    id: "fluor" as ChemicalSubstanceId,
    name: "Flúor",
    data: { tags: [{ name: "CORR", level: "A" }, { name: "TOX", level: "A" }], state: "G" },
  },
  {
    id: "helio" as ChemicalSubstanceId,
    name: "Helio",
    data: { tags: [{ name: "INERTE" }], state: "G" },
  },
  {
    id: "neon" as ChemicalSubstanceId,
    name: "Neón",
    data: { tags: [{ name: "INERTE" }], state: "G" },
  },
  {
    id: "argon" as ChemicalSubstanceId,
    name: "Argón",
    data: { tags: [{ name: "INERTE" }], state: "G" },
  },
  {
    id: "silicio" as ChemicalSubstanceId,
    name: "Silicio",
    data: { tags: [{ name: "INERTE" }], state: "S" },
    // Nota: base de receptores; no modelado en tags químicos.
  },
  {
    id: "calcio" as ChemicalSubstanceId,
    name: "Calcio",
    data: { tags: [{ name: "INERTE" }], state: "S" },
    // Nota: estructural, reactivo con ácidos; no modelado en tags químicos.
  },
  {
    id: "magnesio" as ChemicalSubstanceId,
    name: "Magnesio",
    data: { tags: [{ name: "COMB" }], state: "S" },
  },
  {
    id: "plomo" as ChemicalSubstanceId,
    name: "Plomo",
    data: { tags: [{ name: "INERTE" }], state: "S" },
    // Nota: RE-A, denso, aislante de radiación; no modelado en tags químicos.
  },
  {
    id: "zinc" as ChemicalSubstanceId,
    name: "Zinc",
    data: { tags: [{ name: "INERTE" }], state: "S" },
    // Nota: CE-M, anticorrosivo; no modelado en tags químicos.
  },
  {
    id: "niquel" as ChemicalSubstanceId,
    name: "Níquel",
    data: { tags: [{ name: "INERTE" }], state: "S" },
    // Nota: MAG-Sí, resistente a corrosión; no modelado en tags químicos.
  },
  {
    id: "platino" as ChemicalSubstanceId,
    name: "Platino",
    data: { tags: [{ name: "INERTE" }], state: "S" },
    // Nota: catalizador (acelera reacciones sin consumirse), sin parámetro numérico definido (Especif. §5).
  },
  {
    id: "litio" as ChemicalSubstanceId,
    name: "Litio",
    data: { tags: [{ name: "INERTE" }], state: "S" },
    // Nota: RES(E) alta densidad energética, reactivo con agua/aire; no modelado en tags químicos.
  },
  {
    id: "yodo" as ChemicalSubstanceId,
    name: "Yodo",
    data: { tags: [{ name: "TOX", level: "B" }], state: "S" },
  },
  {
    id: "bromo" as ChemicalSubstanceId,
    name: "Bromo",
    data: { tags: [{ name: "CORR", level: "M" }, { name: "TOX", level: "M" }], state: "L" },
  },
  {
    id: "xenon" as ChemicalSubstanceId,
    name: "Xenón",
    data: { tags: [{ name: "INERTE" }], state: "G" },
    // Nota: ionizable (propulsión); no modelado en tags químicos.
  },
  {
    id: "titanio" as ChemicalSubstanceId,
    name: "Titanio",
    data: { tags: [{ name: "INERTE" }], state: "S" },
    // Nota: RE-A, ligero, resistente a corrosión, alto punto de fusión; no modelado en tags químicos.
  },
  // Nitrógeno líquido — variante de estado, no síntesis.
  {
    id: "nitrogeno-liquido" as ChemicalSubstanceId,
    name: "Nitrógeno líquido",
    data: { tags: [{ name: "INERTE" }], state: "L" },
    // Nota: estado líquido de nitrógeno, licuado vía equipamiento, no una síntesis elemento→compuesto.
  },
];
