/**
 * Catálogo de componentes compuestos — Nave de Investigación (GDD 7.3, líneas 386-406).
 * 17 componentes funcionales (nivel 1 compuesto) con recetas atómicas explícitas.
 */

import type { ComponentId } from "../../physical-component.types.js";
import type { FunctionalProperties } from "../../../properties/functional.types.js";
import type { MaterialProperties } from "../../../properties/material.types.js";
import type { Recipe } from "../../../composition/recipe.types.js";

export interface CompositeComponentSpec {
  readonly id: ComponentId;
  readonly name: string;
  readonly data: {
    readonly functional?: FunctionalProperties;
    readonly material?: MaterialProperties;
  };
  readonly recipe: Recipe<ComponentId>;
}

export const INVESTIGACION_CATALOG: ReadonlyArray<CompositeComponentSpec> = [
  {
    id: "sensor-movimiento-laser" as ComponentId,
    name: "Sensor de movimiento láser",
    data: {
      functional: [
        { tag: "EM", range: 15, triggerType: "motion", frequency: 2 },
        { tag: "REC", threshold: 0.4, responseDelayMs: 50 },
      ],
      material: { CE: "A" },
    },
    recipe: {
      ingredients: [
        { ref: "fotorreceptor" as ComponentId, quantity: 1 },
        { ref: "emisor-laser-baja-potencia" as ComponentId, quantity: 1 },
        { ref: "lente-optica" as ComponentId, quantity: 1 },
        { ref: "chip-circuito-generico" as ComponentId, quantity: 1 },
      ],
    },
  },
  {
    id: "sensor-termico-precision" as ComponentId,
    name: "Sensor térmico de precisión",
    data: {
      functional: [{ tag: "EM", range: 8, triggerType: "thermal", frequency: 1 }],
      material: { CT: "A" },
    },
    recipe: {
      ingredients: [
        { ref: "chip-circuito-generico" as ComponentId, quantity: 2 },
        { ref: "placa-disipadora" as ComponentId, quantity: 1 },
      ],
    },
  },
  {
    id: "sensor-presion-gas" as ComponentId,
    name: "Sensor de presión/gas",
    data: {
      functional: [
        { tag: "EM", range: 5, triggerType: "pressure", frequency: 1 },
        { tag: "REC", threshold: 0.5, responseDelayMs: 100 },
      ],
    },
    recipe: {
      ingredients: [
        { ref: "chip-circuito-generico" as ComponentId, quantity: 1 },
        { ref: "tubo-rigido" as ComponentId, quantity: 1 },
      ],
    },
  },
  {
    id: "brazo-robotico-laboratorio" as ComponentId,
    name: "Brazo robótico de laboratorio",
    data: {
      functional: [
        { tag: "ACT", power: 40, cadence: 8, directional: true },
        { tag: "REC", threshold: 0.5, responseDelayMs: 100 },
      ],
      material: { RE: "M" },
    },
    recipe: {
      ingredients: [
        { ref: "motor-pequeno" as ComponentId, quantity: 2 },
        { ref: "tornilleria-fijacion" as ComponentId, quantity: 4 },
        { ref: "plancha-metalica" as ComponentId, quantity: 1 },
      ],
    },
  },
  {
    id: "servidor-analisis" as ComponentId,
    name: "Servidor de análisis",
    data: {
      functional: [
        { tag: "REC", threshold: 0.3, responseDelayMs: 50 },
        { tag: "EM", range: 0, triggerType: "computation", frequency: 10 },
      ],
      material: { CE: "M" },
    },
    recipe: {
      ingredients: [
        { ref: "chip-circuito-generico" as ComponentId, quantity: 4 },
        { ref: "resistencia-electrica" as ComponentId, quantity: 2 },
        { ref: "placa-aislante-termica" as ComponentId, quantity: 1 },
      ],
    },
  },
  {
    id: "escaner-espectro" as ComponentId,
    name: "Escáner de espectro",
    data: {
      functional: [
        { tag: "EM", range: 12, triggerType: "spectral", frequency: 1 },
        { tag: "REC", threshold: 0.4, responseDelayMs: 150 },
      ],
      material: { CE: "A" },
    },
    recipe: {
      ingredients: [
        { ref: "lente-optica" as ComponentId, quantity: 2 },
        { ref: "chip-circuito-generico" as ComponentId, quantity: 2 },
        { ref: "bateria-celda-simple" as ComponentId, quantity: 1 },
      ],
    },
  },
  {
    id: "microscopio-electronico" as ComponentId,
    name: "Microscopio electrónico",
    data: {
      functional: [
        { tag: "EM", range: 3, triggerType: "magnified", frequency: 1 },
        { tag: "REC", threshold: 0.5, responseDelayMs: 200 },
      ],
      material: { CE: "M" },
    },
    recipe: {
      ingredients: [
        { ref: "lente-optica" as ComponentId, quantity: 3 },
        { ref: "iman-permanente" as ComponentId, quantity: 1 },
        { ref: "chip-circuito-generico" as ComponentId, quantity: 1 },
      ],
    },
  },
  {
    id: "tanque-muestra-criogenica" as ComponentId,
    name: "Tanque de muestra criogénica",
    data: {
      functional: [{ tag: "RES", resourceType: "L", capacity: 100, dischargeRate: 2 }],
      material: { CT: "A" },
    },
    recipe: {
      ingredients: [
        { ref: "tubo-rigido" as ComponentId, quantity: 2 },
        { ref: "placa-disipadora" as ComponentId, quantity: 1 },
        { ref: "junta-hermetica" as ComponentId, quantity: 2 },
      ],
    },
    // Nota: contiene Nitrógeno líquido (catálogo químico: nitrogeno-liquido).
  },
  {
    id: "dron-reconocimiento" as ComponentId,
    name: "Dron de reconocimiento",
    data: {
      functional: [
        { tag: "EM", range: 20, triggerType: "remote", frequency: 2 },
        { tag: "ACT", power: 30, cadence: 12, directional: true },
      ],
      material: { RE: "B" },
    },
    recipe: {
      ingredients: [
        { ref: "motor-pequeno" as ComponentId, quantity: 2 },
        { ref: "chip-circuito-generico" as ComponentId, quantity: 1 },
        { ref: "bateria-celda-simple" as ComponentId, quantity: 1 },
        { ref: "carcasa-plastica" as ComponentId, quantity: 1 },
      ],
    },
  },
  {
    id: "panel-solar-alta-eficiencia" as ComponentId,
    name: "Panel solar de alta eficiencia",
    data: {
      functional: [{ tag: "RES", resourceType: "E", capacity: 150, dischargeRate: 10, powerUnits: 3 }],
      material: { CE: "A" },
    },
    recipe: {
      ingredients: [
        { ref: "celula-fotovoltaica" as ComponentId, quantity: 3 },
        { ref: "cable-cobre" as ComponentId, quantity: 2 },
        { ref: "tornilleria-fijacion" as ComponentId, quantity: 4 },
      ],
    },
  },
  {
    id: "impresora-3d-piezas" as ComponentId,
    name: "Impresora 3D de piezas",
    data: {
      functional: [
        { tag: "ACT", power: 60, cadence: 4, directional: false },
        { tag: "REC", threshold: 0.5, responseDelayMs: 300 },
      ],
      material: { CE: "M" },
    },
    recipe: {
      ingredients: [
        { ref: "motor-pequeno" as ComponentId, quantity: 3 },
        { ref: "chip-circuito-generico" as ComponentId, quantity: 2 },
        { ref: "plancha-metalica" as ComponentId, quantity: 1 },
      ],
    },
  },
  {
    id: "camara-aislamiento" as ComponentId,
    name: "Cámara de aislamiento",
    data: {
      functional: [{ tag: "EST", damageResistance: 60, articulatedRange: undefined }],
      material: { CE: "N" },
    },
    recipe: {
      ingredients: [
        { ref: "carcasa-plastica" as ComponentId, quantity: 2 },
        { ref: "junta-hermetica" as ComponentId, quantity: 4 },
        { ref: "tubo-rigido" as ComponentId, quantity: 1 },
      ],
    },
  },
  {
    id: "centrifuga" as ComponentId,
    name: "Centrífuga",
    data: {
      functional: [
        { tag: "ACT", power: 45, cadence: 20, directional: false },
        { tag: "REC", threshold: 0.5, responseDelayMs: 100 },
      ],
      material: { RE: "M" },
    },
    recipe: {
      ingredients: [
        { ref: "motor-pequeno" as ComponentId, quantity: 2 },
        { ref: "plancha-metalica" as ComponentId, quantity: 1 },
        { ref: "chip-circuito-generico" as ComponentId, quantity: 1 },
      ],
    },
  },
  {
    id: "cable-fibra-optica" as ComponentId,
    name: "Cable de fibra óptica",
    data: {
      functional: [{ tag: "COND", resourceType: "E", maxCapacity: 200 }],
      material: { CE: "A" },
    },
    recipe: {
      ingredients: [
        { ref: "lente-optica" as ComponentId, quantity: 2 },
        { ref: "cable-cobre" as ComponentId, quantity: 1 },
      ],
    },
  },
  {
    id: "sistema-purificacion-aire" as ComponentId,
    name: "Sistema de purificación de aire",
    data: {
      functional: [
        { tag: "ACT", power: 35, cadence: 10, directional: false },
        { tag: "REC", threshold: 0.4, responseDelayMs: 150 },
      ],
      material: { CE: "M" },
    },
    recipe: {
      ingredients: [
        { ref: "motor-pequeno" as ComponentId, quantity: 1 },
        { ref: "tubo-flexible" as ComponentId, quantity: 2 },
        { ref: "valvula-simple" as ComponentId, quantity: 1 },
        { ref: "chip-circuito-generico" as ComponentId, quantity: 1 },
      ],
    },
  },
  {
    id: "reservorio-reactivo-acido" as ComponentId,
    name: "Reservorio de reactivo ácido",
    data: {
      functional: [{ tag: "RES", resourceType: "L", capacity: 80, dischargeRate: 5 }],
      material: { CE: "M" },
    },
    recipe: {
      ingredients: [
        { ref: "tubo-rigido" as ComponentId, quantity: 1 },
        { ref: "valvula-simple" as ComponentId, quantity: 1 },
        { ref: "junta-hermetica" as ComponentId, quantity: 2 },
      ],
    },
    // Nota: contiene Ácido de laboratorio (catálogo químico: acido-de-laboratorio).
  },
  {
    id: "reservorio-reactivo-base" as ComponentId,
    name: "Reservorio de reactivo base",
    data: {
      functional: [{ tag: "RES", resourceType: "L", capacity: 80, dischargeRate: 5 }],
      material: { CE: "M" },
    },
    recipe: {
      ingredients: [
        { ref: "tubo-rigido" as ComponentId, quantity: 1 },
        { ref: "valvula-simple" as ComponentId, quantity: 1 },
        { ref: "junta-hermetica" as ComponentId, quantity: 2 },
      ],
    },
    // Nota: contiene Base de laboratorio (catálogo químico: base-de-laboratorio).
  },
  {
    id: "reservorio-disolvente" as ComponentId,
    name: "Reservorio de disolvente",
    data: {
      functional: [{ tag: "RES", resourceType: "L", capacity: 60, dischargeRate: 4 }],
      material: { CE: "N" },
    },
    recipe: {
      ingredients: [
        { ref: "tubo-flexible" as ComponentId, quantity: 1 },
        { ref: "valvula-simple" as ComponentId, quantity: 1 },
        { ref: "junta-hermetica" as ComponentId, quantity: 2 },
      ],
    },
    // Nota: contiene Disolvente volátil (catálogo químico: disolvente-volatil).
  },
];
