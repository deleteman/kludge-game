/**
 * Catálogo de componentes compuestos — Nave Médica (GDD 7.6, líneas 462-479).
 * 18 componentes funcionales (nivel 1 compuesto).
 */

import type { ComponentId } from "../../physical-component.types.js";
import type { ChemicalSubstanceId } from "../../../chemistry/chemical-substance.types.js";
import type { CompositeComponentSpec } from "./composite-component-spec.types.js";
export type { CompositeComponentSpec } from "./composite-component-spec.types.js";

export const MEDICA_CATALOG: ReadonlyArray<CompositeComponentSpec> = [
  {
    id: "laser-quirurgico" as ComponentId,
    name: "Láser quirúrgico",
    data: {
      functional: [{ tag: "ACT", power: 30, cadence: 8, directional: true }],
      material: { CE: "A", CT: "B" },
    },
    recipe: {
      ingredients: [
        { ref: "emisor-laser-baja-potencia" as ComponentId, quantity: 2 },
        { ref: "lente-optica" as ComponentId, quantity: 2 },
        { ref: "placa-disipadora" as ComponentId, quantity: 1 },
        { ref: "cable-cobre" as ComponentId, quantity: 2 },
      ],
    },
  },
  {
    id: "tanque-anestesico" as ComponentId,
    contains: "anestesico-medico" as ChemicalSubstanceId,
    name: "Tanque de anestésico",
    data: {
      functional: [{ tag: "RES", resourceType: "G", capacity: 80, dischargeRate: 5 }],
      material: { CE: "N" },
    },
    recipe: {
      ingredients: [
        { ref: "tubo-flexible" as ComponentId, quantity: 1 },
        { ref: "valvula-simple" as ComponentId, quantity: 1 },
        { ref: "junta-hermetica" as ComponentId, quantity: 2 },
      ],
    },
    // Nota: contiene Anestésico médico (catálogo químico: anestesico-medico).
  },
  {
    id: "camilla-automatizada" as ComponentId,
    name: "Camilla automatizada",
    data: {
      functional: [
        { tag: "ACT", power: 35, cadence: 4, directional: false },
        { tag: "REC", threshold: 0.5, responseDelayMs: 100 },
      ],
      material: { RE: "M" },
    },
    recipe: {
      ingredients: [
        { ref: "motor-pequeno" as ComponentId, quantity: 1 },
        { ref: "plancha-metalica" as ComponentId, quantity: 1 },
        { ref: "chip-circuito-generico" as ComponentId, quantity: 1 },
        { ref: "tornilleria-fijacion" as ComponentId, quantity: 4 },
      ],
    },
  },
  {
    id: "esterilizador-uv" as ComponentId,
    name: "Esterilizador UV",
    data: {
      functional: [
        { tag: "ACT", power: 40, cadence: 6, directional: false },
        { tag: "REC", threshold: 0.5, responseDelayMs: 150 },
      ],
      material: { CE: "M" },
    },
    recipe: {
      ingredients: [
        { ref: "emisor-laser-baja-potencia" as ComponentId, quantity: 2 },
        { ref: "lente-optica" as ComponentId, quantity: 1 },
        { ref: "chip-circuito-generico" as ComponentId, quantity: 1 },
        { ref: "cable-cobre" as ComponentId, quantity: 1 },
      ],
    },
  },
  {
    id: "sistema-diagnostico" as ComponentId,
    name: "Sistema de diagnóstico",
    data: {
      functional: [
        { tag: "REC", threshold: 0.3, responseDelayMs: 75 },
        { tag: "EM", range: 5, triggerType: "biometric", frequency: 2 },
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
    id: "banco-sangre-fluidos" as ComponentId,
    contains: "fluido-biologico" as ChemicalSubstanceId,
    name: "Banco de sangre/fluidos",
    data: {
      functional: [
        { tag: "RES", resourceType: "L", capacity: 200, dischargeRate: 10 },
        { tag: "ACT", power: 15, cadence: 3, directional: false },
      ],
      material: { CT: "A", CE: "N" },
    },
    recipe: {
      ingredients: [
        { ref: "tubo-rigido" as ComponentId, quantity: 2 },
        { ref: "valvula-simple" as ComponentId, quantity: 2 },
        { ref: "junta-hermetica" as ComponentId, quantity: 3 },
        { ref: "placa-disipadora" as ComponentId, quantity: 1 },
      ],
    },
    // Nota: contiene "Fluido biológico" (catálogo químico: fluido-biologico, placeholder de GDD 7.6).
  },
  {
    id: "brazo-robotico-quirurgico" as ComponentId,
    name: "Brazo robótico quirúrgico",
    data: {
      functional: [
        { tag: "ACT", power: 35, cadence: 10, directional: true },
        { tag: "REC", threshold: 0.4, responseDelayMs: 80 },
      ],
      material: { RE: "M", CE: "M" },
    },
    recipe: {
      ingredients: [
        { ref: "motor-pequeno" as ComponentId, quantity: 2 },
        { ref: "chip-circuito-generico" as ComponentId, quantity: 2 },
        { ref: "plancha-metalica" as ComponentId, quantity: 1 },
        { ref: "tornilleria-fijacion" as ComponentId, quantity: 3 },
      ],
    },
  },
  {
    id: "ventilador-mecanico" as ComponentId,
    contains: "oxigeno" as ChemicalSubstanceId,
    name: "Ventilador mecánico",
    data: {
      functional: [
        { tag: "ACT", power: 25, cadence: 12, directional: false },
        { tag: "REC", threshold: 0.5, responseDelayMs: 100 },
      ],
      material: { CE: "M" },
    },
    recipe: {
      ingredients: [
        { ref: "motor-pequeno" as ComponentId, quantity: 1 },
        { ref: "tubo-flexible" as ComponentId, quantity: 1 },
        { ref: "valvula-simple" as ComponentId, quantity: 1 },
        { ref: "chip-circuito-generico" as ComponentId, quantity: 1 },
      ],
    },
    // Nota: contiene Oxígeno (catálogo químico: oxigeno).
  },
  {
    id: "sensor-biometrico-tripulante" as ComponentId,
    name: "Sensor biométrico por tripulante",
    data: {
      functional: [
        { tag: "EM", range: 3, triggerType: "biometric", frequency: 5 },
        { tag: "REC", threshold: 0.4, responseDelayMs: 50 },
      ],
      material: { CE: "A" },
    },
    recipe: {
      ingredients: [
        { ref: "chip-circuito-generico" as ComponentId, quantity: 2 },
        { ref: "cable-cobre" as ComponentId, quantity: 1 },
        { ref: "bateria-celda-simple" as ComponentId, quantity: 1 },
      ],
    },
  },
  {
    id: "farmacia-automatizada" as ComponentId,
    contains: "sustancia-medica-generica" as ChemicalSubstanceId,
    name: "Farmacia automatizada",
    data: {
      functional: [
        { tag: "RES", resourceType: "L", capacity: 90, dischargeRate: 3 },
        { tag: "ACT", power: 20, cadence: 5, directional: false },
      ],
      material: { CE: "N" },
    },
    recipe: {
      ingredients: [
        { ref: "carcasa-plastica" as ComponentId, quantity: 1 },
        { ref: "motor-pequeno" as ComponentId, quantity: 1 },
        { ref: "valvula-simple" as ComponentId, quantity: 2 },
        { ref: "chip-circuito-generico" as ComponentId, quantity: 1 },
      ],
    },
    // Nota: contiene "Sustancia médica genérica" (catálogo químico: sustancia-medica-generica, placeholder).
  },
  {
    id: "camara-aislamiento-biologico" as ComponentId,
    name: "Cámara de aislamiento biológico",
    data: {
      functional: [
        { tag: "EST", damageResistance: 50, articulatedRange: undefined },
        { tag: "REC", threshold: 0.5, responseDelayMs: 100 },
      ],
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
    id: "generador-oxigeno-precision" as ComponentId,
    contains: "oxigeno" as ChemicalSubstanceId,
    name: "Generador de oxígeno de precisión",
    data: {
      functional: [
        { tag: "ACT", power: 30, cadence: 4, directional: false },
        { tag: "RES", resourceType: "G", capacity: 120, dischargeRate: 8 },
      ],
      material: { CE: "M" },
    },
    recipe: {
      ingredients: [
        { ref: "motor-pequeno" as ComponentId, quantity: 1 },
        { ref: "tubo-flexible" as ComponentId, quantity: 1 },
        { ref: "chip-circuito-generico" as ComponentId, quantity: 1 },
        { ref: "valvula-simple" as ComponentId, quantity: 1 },
      ],
    },
    // Nota: contiene Oxígeno (catálogo químico: oxigeno).
    // genera O2 pasivamente, no implementado — ver Especificación §4, diferido fuera de Fase 4.
  },
  {
    id: "sistema-refrigeracion-muestras" as ComponentId,
    name: "Sistema de refrigeración de muestras",
    data: {
      functional: [
        { tag: "ACT", power: 25, cadence: 8, directional: false },
        { tag: "REC", threshold: 0.4, responseDelayMs: 120 },
      ],
      material: { CT: "A" },
    },
    recipe: {
      ingredients: [
        { ref: "placa-disipadora" as ComponentId, quantity: 2 },
        { ref: "motor-pequeno" as ComponentId, quantity: 1 },
        { ref: "tubo-flexible" as ComponentId, quantity: 1 },
        { ref: "chip-circuito-generico" as ComponentId, quantity: 1 },
      ],
    },
  },
  {
    id: "comunicador-emergencia-medica" as ComponentId,
    name: "Comunicador de emergencia médica",
    data: {
      functional: [
        { tag: "EM", range: 50, triggerType: "emergency", frequency: 2 },
        { tag: "REC", threshold: 0.3, responseDelayMs: 30 },
      ],
      material: { CE: "A" },
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
    id: "bateria-respaldo-bajo-consumo" as ComponentId,
    name: "Batería de respaldo bajo consumo",
    data: {
      functional: [{ tag: "RES", resourceType: "E", capacity: 60, dischargeRate: 5, powerUnits: 1 }],
      material: { CE: "A" },
    },
    recipe: {
      ingredients: [
        { ref: "bateria-celda-simple" as ComponentId, quantity: 2 },
        { ref: "cable-cobre" as ComponentId, quantity: 1 },
        { ref: "resistencia-electrica" as ComponentId, quantity: 1 },
      ],
    },
  },
  {
    id: "reservorio-anestesico-concentrado" as ComponentId,
    contains: "anestesico-medico" as ChemicalSubstanceId,
    name: "Reservorio de anestésico concentrado",
    data: {
      functional: [{ tag: "RES", resourceType: "G", capacity: 50, dischargeRate: 3 }],
      material: { CE: "N" },
    },
    recipe: {
      ingredients: [
        { ref: "tubo-flexible" as ComponentId, quantity: 1 },
        { ref: "valvula-simple" as ComponentId, quantity: 1 },
        { ref: "junta-hermetica" as ComponentId, quantity: 2 },
      ],
    },
    // Nota: contiene Anestésico médico concentrado (catálogo químico: anestesico-medico).
  },
  {
    id: "reservorio-desinfectante" as ComponentId,
    contains: "desinfectante" as ChemicalSubstanceId,
    name: "Reservorio de desinfectante",
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
    // Nota: contiene Desinfectante (catálogo químico: desinfectante).
  },
  {
    id: "reservorio-oxigeno-medico-concentrado" as ComponentId,
    contains: "oxigeno" as ChemicalSubstanceId,
    name: "Reservorio de oxígeno médico concentrado",
    data: {
      functional: [{ tag: "RES", resourceType: "G", capacity: 100, dischargeRate: 6 }],
      material: { CE: "M" },
    },
    recipe: {
      ingredients: [
        { ref: "tubo-rigido" as ComponentId, quantity: 1 },
        { ref: "valvula-simple" as ComponentId, quantity: 1 },
        { ref: "junta-hermetica" as ComponentId, quantity: 2 },
        { ref: "placa-disipadora" as ComponentId, quantity: 1 },
      ],
    },
    // Nota: contiene Oxígeno (catálogo químico: oxigeno).
  },
];
