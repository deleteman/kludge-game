/**
 * Catálogo de componentes compuestos — Nave de Exploración (GDD 7.5, líneas 438-454).
 * 16 componentes funcionales (nivel 1 compuesto).
 */

import type { ComponentId } from "../../physical-component.types.js";
import type { CompositeComponentSpec } from "./composite-component-spec.types.js";
export type { CompositeComponentSpec } from "./composite-component-spec.types.js";
import type { ChemicalSubstanceId } from "../../../chemistry/chemical-substance.types.js";


export const EXPLORACION_CATALOG: ReadonlyArray<CompositeComponentSpec> = [
  {
    id: "tanque-combustible-largo-alcance" as ComponentId,
    contains: "combustible-de-motor" as ChemicalSubstanceId,
    name: "Tanque de combustible de largo alcance",
    data: {
      functional: [{ tag: "RES", resourceType: "L", capacity: 300, dischargeRate: 20 }],
      material: { RE: "M" },
    },
    recipe: {
      ingredients: [
        { ref: "tubo-rigido" as ComponentId, quantity: 3 },
        { ref: "valvula-simple" as ComponentId, quantity: 2 },
        { ref: "junta-hermetica" as ComponentId, quantity: 3 },
        { ref: "tornilleria-fijacion" as ComponentId, quantity: 4 },
      ],
    },
    // Nota: contiene Combustible de motor (catálogo químico: combustible-de-motor).
  },
  {
    id: "motor-crucero-eficiente" as ComponentId,
    name: "Motor de crucero eficiente",
    data: {
      functional: [{ tag: "ACT", power: 100, cadence: 8, directional: true }],
      material: { CE: "M", CT: "A" },
    },
    recipe: {
      ingredients: [
        { ref: "motor-pequeno" as ComponentId, quantity: 2 },
        { ref: "cable-cobre" as ComponentId, quantity: 3 },
        { ref: "placa-disipadora" as ComponentId, quantity: 1 },
        { ref: "resistencia-electrica" as ComponentId, quantity: 1 },
      ],
    },
  },
  {
    id: "panel-solar-desplegable" as ComponentId,
    name: "Panel solar desplegable",
    data: {
      functional: [{ tag: "RES", resourceType: "E", capacity: 180, dischargeRate: 15, powerUnits: 3 }],
      material: { CE: "A" },
    },
    recipe: {
      ingredients: [
        { ref: "celula-fotovoltaica" as ComponentId, quantity: 4 },
        { ref: "cable-cobre" as ComponentId, quantity: 2 },
        { ref: "tornilleria-fijacion" as ComponentId, quantity: 4 },
        { ref: "plancha-metalica" as ComponentId, quantity: 1 },
      ],
    },
  },
  {
    id: "sistema-reciclaje-agua-aire" as ComponentId,
    name: "Sistema de reciclaje de agua/aire",
    data: {
      functional: [
        { tag: "ACT", power: 40, cadence: 6, directional: false },
        { tag: "REC", threshold: 0.4, responseDelayMs: 120 },
      ],
      material: { CE: "M" },
    },
    recipe: {
      ingredients: [
        { ref: "motor-pequeno" as ComponentId, quantity: 1 },
        { ref: "tubo-flexible" as ComponentId, quantity: 2 },
        { ref: "valvula-simple" as ComponentId, quantity: 2 },
        { ref: "chip-circuito-generico" as ComponentId, quantity: 1 },
      ],
    },
  },
  {
    id: "bodega-carga-modular" as ComponentId,
    name: "Bodega de carga modular",
    data: {
      functional: [{ tag: "EST", damageResistance: 50, articulatedRange: undefined }],
      material: { RE: "M" },
    },
    recipe: {
      ingredients: [
        { ref: "carcasa-plastica" as ComponentId, quantity: 2 },
        { ref: "plancha-metalica" as ComponentId, quantity: 1 },
        { ref: "tornilleria-fijacion" as ComponentId, quantity: 6 },
      ],
    },
  },
  {
    id: "impresora-piezas-repuesto" as ComponentId,
    name: "Impresora de piezas de repuesto",
    data: {
      functional: [
        { tag: "ACT", power: 50, cadence: 4, directional: false },
        { tag: "REC", threshold: 0.5, responseDelayMs: 250 },
      ],
      material: { CE: "M" },
    },
    recipe: {
      ingredients: [
        { ref: "motor-pequeno" as ComponentId, quantity: 2 },
        { ref: "chip-circuito-generico" as ComponentId, quantity: 2 },
        { ref: "plancha-metalica" as ComponentId, quantity: 1 },
        { ref: "bateria-celda-simple" as ComponentId, quantity: 1 },
      ],
    },
  },
  {
    id: "traje-eva" as ComponentId,
    name: "Traje EVA",
    data: {
      functional: [{ tag: "EST", damageResistance: 45, articulatedRange: undefined }],
      material: { RE: "M", ES: "S" },
    },
    recipe: {
      ingredients: [
        { ref: "carcasa-plastica" as ComponentId, quantity: 1 },
        { ref: "junta-hermetica" as ComponentId, quantity: 4 },
        { ref: "tubo-flexible" as ComponentId, quantity: 1 },
      ],
    },
  },
  {
    id: "telescopio-largo-alcance" as ComponentId,
    name: "Telescopio de largo alcance",
    data: {
      functional: [
        { tag: "EM", range: 30, triggerType: "visual", frequency: 1 },
        { tag: "REC", threshold: 0.4, responseDelayMs: 200 },
      ],
      material: { CE: "A" },
    },
    recipe: {
      ingredients: [
        { ref: "lente-optica" as ComponentId, quantity: 3 },
        { ref: "chip-circuito-generico" as ComponentId, quantity: 1 },
        { ref: "bateria-celda-simple" as ComponentId, quantity: 1 },
      ],
    },
  },
  {
    id: "bateria-gran-capacidad" as ComponentId,
    name: "Batería de gran capacidad",
    data: {
      functional: [{ tag: "RES", resourceType: "E", capacity: 250, dischargeRate: 30, powerUnits: 4 }],
      material: { CE: "A" },
    },
    recipe: {
      ingredients: [
        { ref: "bateria-celda-simple" as ComponentId, quantity: 4 },
        { ref: "cable-cobre" as ComponentId, quantity: 3 },
        { ref: "resistencia-electrica" as ComponentId, quantity: 1 },
      ],
    },
  },
  {
    id: "sistema-hibernacion" as ComponentId,
    name: "Sistema de hibernación",
    data: {
      functional: [
        { tag: "ACT", power: 30, cadence: 1, directional: false },
        { tag: "REC", threshold: 0.3, responseDelayMs: 500 },
      ],
      material: { CT: "B" },
    },
    recipe: {
      ingredients: [
        { ref: "placa-aislante-termica" as ComponentId, quantity: 2 },
        { ref: "chip-circuito-generico" as ComponentId, quantity: 1 },
        { ref: "tubo-flexible" as ComponentId, quantity: 1 },
      ],
    },
  },
  {
    id: "sellador-emergencia-casco" as ComponentId,
    name: "Sellador de emergencia de casco",
    data: {
      functional: [
        { tag: "ACT", power: 20, cadence: 10, directional: false },
        { tag: "REC", threshold: 0.5, responseDelayMs: 50 },
      ],
      material: { CE: "N" },
    },
    recipe: {
      ingredients: [
        { ref: "junta-hermetica" as ComponentId, quantity: 3 },
        { ref: "tubo-flexible" as ComponentId, quantity: 1 },
        { ref: "valvula-simple" as ComponentId, quantity: 1 },
        { ref: "chip-circuito-generico" as ComponentId, quantity: 1 },
      ],
    },
  },
  {
    id: "radio-largo-alcance" as ComponentId,
    name: "Radio de largo alcance",
    data: {
      functional: [
        { tag: "EM", range: 80, triggerType: "radio", frequency: 1 },
        { tag: "REC", threshold: 0.3, responseDelayMs: 75 },
      ],
      material: { CE: "A" },
      // Footprint de catálogo, ver nota en `herramientas-reparacion-externa` —
      // consola de radio con antena, ocupa 1x2.
      footprint: { width: 1, height: 2 },
    },
    recipe: {
      ingredients: [
        { ref: "chip-circuito-generico" as ComponentId, quantity: 2 },
        { ref: "cable-cobre" as ComponentId, quantity: 2 },
        { ref: "bateria-celda-simple" as ComponentId, quantity: 1 },
      ],
    },
  },
  {
    id: "sistema-navegacion-estelar" as ComponentId,
    name: "Sistema de navegación estelar",
    data: {
      functional: [
        { tag: "EM", range: 0, triggerType: "navigation", frequency: 1 },
        { tag: "REC", threshold: 0.2, responseDelayMs: 100 },
      ],
      material: { CE: "M" },
    },
    recipe: {
      ingredients: [
        { ref: "chip-circuito-generico" as ComponentId, quantity: 3 },
        { ref: "cable-cobre" as ComponentId, quantity: 2 },
        { ref: "bateria-celda-simple" as ComponentId, quantity: 1 },
      ],
    },
  },
  {
    id: "invernadero-hidroponico" as ComponentId,
    contains: "agua" as ChemicalSubstanceId,
    name: "Invernadero hidropónico",
    data: {
      functional: [
        { tag: "RES", resourceType: "L", capacity: 150, dischargeRate: 8 },
        { tag: "ACT", power: 20, cadence: 4, directional: false },
      ],
      material: { RE: "M" },
    },
    recipe: {
      ingredients: [
        { ref: "tubo-flexible" as ComponentId, quantity: 2 },
        { ref: "valvula-simple" as ComponentId, quantity: 2 },
        { ref: "carcasa-plastica" as ComponentId, quantity: 1 },
        { ref: "chip-circuito-generico" as ComponentId, quantity: 1 },
      ],
    },
    // Nota: contiene Agua (catálogo químico: agua).
    // genera O2 pasivamente, no implementado — ver Especificación §4, diferido fuera de Fase 4.
  },
  {
    id: "herramientas-reparacion-externa" as ComponentId,
    name: "Herramientas de reparación externa",
    data: {
      functional: [
        { tag: "ACT", power: 25, cadence: 12, directional: true },
        { tag: "REC", threshold: 0.5, responseDelayMs: 100 },
      ],
      material: { RE: "A" },
      // Footprint de catálogo (no de mesa de creación): necesario para poder
      // sembrarlo directo en el plano vía la capa Tiled `semillas`
      // (`floorplan/instantiate-component-seeds.ts`) — caja de herramientas
      // portátil, ocupa 2x1.
      footprint: { width: 2, height: 1 },
    },
    recipe: {
      ingredients: [
        { ref: "motor-pequeno" as ComponentId, quantity: 1 },
        { ref: "plancha-metalica" as ComponentId, quantity: 1 },
        { ref: "tornilleria-fijacion" as ComponentId, quantity: 3 },
        { ref: "cable-cobre" as ComponentId, quantity: 1 },
      ],
    },
  },
  {
    id: "reservorio-refrigerante-motor" as ComponentId,
    contains: "refrigerante-sintetico" as ChemicalSubstanceId,
    name: "Reservorio de refrigerante de motor",
    data: {
      functional: [{ tag: "RES", resourceType: "L", capacity: 120, dischargeRate: 8 }],
      material: { CT: "A" },
    },
    recipe: {
      ingredients: [
        { ref: "tubo-rigido" as ComponentId, quantity: 1 },
        { ref: "valvula-simple" as ComponentId, quantity: 1 },
        { ref: "junta-hermetica" as ComponentId, quantity: 2 },
      ],
    },
    // Nota: contiene Refrigerante sintético (catálogo químico: refrigerante-sintetico).
  },
  {
    id: "reservorio-agua-reciclada" as ComponentId,
    contains: "agua" as ChemicalSubstanceId,
    name: "Reservorio de agua reciclada",
    data: {
      functional: [{ tag: "RES", resourceType: "L", capacity: 100, dischargeRate: 5 }],
      material: { CE: "N" },
      // Footprint de catálogo, ver nota en `herramientas-reparacion-externa` —
      // tanque cilíndrico, ocupa 2x2.
      footprint: { width: 2, height: 2 },
    },
    recipe: {
      ingredients: [
        { ref: "tubo-flexible" as ComponentId, quantity: 1 },
        { ref: "valvula-simple" as ComponentId, quantity: 1 },
        { ref: "junta-hermetica" as ComponentId, quantity: 2 },
      ],
    },
    // Nota: contiene Agua reciclada (id: agua del catálogo químico).
  },
];
