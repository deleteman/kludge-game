/**
 * Catálogo de componentes compuestos — Nave de Guerra (GDD 7.4, líneas 413-430).
 * 17 componentes funcionales (nivel 1 compuesto) + 1 ensamblaje complejo (Torreta automatizada, nivel 2)
 * + 1 arma cuerpo a cuerpo (Garra de abordaje, Fase 11d — ver nota junto a su definición).
 */

import type { ComponentId } from "../../physical-component.types.js";
import type { ChemicalSubstanceId } from "../../../chemistry/chemical-substance.types.js";
import type { CompositeComponentSpec } from "./composite-component-spec.types.js";
export type { CompositeComponentSpec } from "./composite-component-spec.types.js";

export const GUERRA_CATALOG: ReadonlyArray<CompositeComponentSpec> = [
  {
    id: "canon-laser" as ComponentId,
    name: "Cañón láser",
    data: {
      functional: [{ tag: "ACT", power: 80, cadence: 5, directional: true }],
      material: { CE: "A", RE: "A" },
    },
    recipe: {
      ingredients: [
        { ref: "emisor-laser-baja-potencia" as ComponentId, quantity: 2 },
        { ref: "lente-optica" as ComponentId, quantity: 2 },
        { ref: "cable-cobre" as ComponentId, quantity: 3 },
        { ref: "placa-disipadora" as ComponentId, quantity: 1 },
      ],
    },
  },
  {
    id: "generador-escudo" as ComponentId,
    name: "Generador de escudo",
    data: {
      functional: [
        { tag: "ACT", power: 100, cadence: 2, directional: false },
        { tag: "REC", threshold: 0.3, responseDelayMs: 50 },
      ],
      material: { CE: "A" },
    },
    recipe: {
      ingredients: [
        { ref: "cable-cobre" as ComponentId, quantity: 4 },
        { ref: "chip-circuito-generico" as ComponentId, quantity: 3 },
        { ref: "bateria-celda-simple" as ComponentId, quantity: 2 },
        { ref: "placa-disipadora" as ComponentId, quantity: 2 },
      ],
    },
  },
  {
    id: "blindaje-reactivo" as ComponentId,
    name: "Blindaje reactivo",
    data: {
      functional: [{ tag: "EST", damageResistance: 90, articulatedRange: undefined }],
      material: { RE: "A" },
    },
    recipe: {
      ingredients: [
        { ref: "plancha-metalica" as ComponentId, quantity: 3 },
        { ref: "tornilleria-fijacion" as ComponentId, quantity: 6 },
      ],
    },
  },
  {
    id: "torreta-automatizada" as ComponentId,
    name: "Torreta automatizada",
    data: {
      functional: [
        { tag: "EM", range: 18, triggerType: "motion", frequency: 2 },
        { tag: "ACT", power: 80, cadence: 5, directional: true },
      ],
      material: { RE: "A" },
    },
    recipe: {
      ingredients: [
        // Ensamblaje complejo: se hace de compuestos, no átomos.
        { ref: "sensor-movimiento-laser" as ComponentId, quantity: 1 },
        { ref: "canon-laser" as ComponentId, quantity: 1 },
        { ref: "motor-pequeno" as ComponentId, quantity: 2 },
      ],
    },
    // Nota: nivel 2 (ensamblaje complejo), montaje de compuestos (sensor + láser + soporte articulado).
  },
  {
    id: "reactor-alto-amperaje" as ComponentId,
    name: "Reactor de alto amperaje",
    data: {
      functional: [{ tag: "RES", resourceType: "E", capacity: 300, dischargeRate: 50, powerUnits: 6 }],
      material: { CE: "A", CT: "B" },
    },
    recipe: {
      ingredients: [
        { ref: "bobina-cobre" as ComponentId, quantity: 4 },
        { ref: "resistencia-electrica" as ComponentId, quantity: 3 },
        { ref: "placa-disipadora" as ComponentId, quantity: 2 },
        { ref: "chip-circuito-generico" as ComponentId, quantity: 2 },
      ],
    },
  },
  {
    id: "compuerta-blindada" as ComponentId,
    name: "Compuerta blindada",
    data: {
      functional: [
        // Subfase 13h: `ACT` deja de ser decorativo en esta pieza. `cadence`
        // (1.5 s) es lo que tarda la hoja en abrirse o cerrarse, y `power` (70)
        // la fuerza del motor — resiste el forzado manual y aplasta al que quede
        // en el umbral. Su consumo (`powerDraw: 2`) la vuelve consumidora real
        // del reparto de 13b —sin energía se congela donde está— y desde 13g
        // vive en `power/power-parameters.ts`, no acá: ya no es un campo de
        // `ACT` sino dato de componente, para que un chip o una mesa también
        // puedan declararlo.
        //
        // Ronda 2 de playtest: 3 s → 1.5 s. Es el número que comparten la
        // simulación y la animación de la hoja (`easedDoorOpenness`), así que
        // cambiarlo acá cambia las dos cosas a la vez, que es exactamente la
        // invariante que `transitionSecondsOf` existe para sostener.
        { tag: "ACT", power: 70, cadence: 1.5, directional: false },
        { tag: "EST", damageResistance: 80, articulatedRange: undefined },
      ],
      material: { RE: "A" },
      // Necesario para poder sembrarla en la capa Tiled `semillas` o instalarla
      // desde el kit inicial (`composite-component-spec.types.ts`): sin
      // footprint, un compuesto no se puede colocar en el plano.
      footprint: { width: 1, height: 1 },
    },
    recipe: {
      ingredients: [
        { ref: "plancha-metalica" as ComponentId, quantity: 2 },
        { ref: "motor-pequeno" as ComponentId, quantity: 1 },
        { ref: "tornilleria-fijacion" as ComponentId, quantity: 4 },
        { ref: "junta-hermetica" as ComponentId, quantity: 2 },
      ],
    },
  },
  {
    id: "sistema-comunicacion-cifrada" as ComponentId,
    name: "Sistema de comunicación cifrada",
    data: {
      functional: [
        { tag: "EM", range: 100, triggerType: "signal", frequency: 1 },
        { tag: "REC", threshold: 0.3, responseDelayMs: 50 },
      ],
      material: { CE: "A" },
    },
    recipe: {
      ingredients: [
        { ref: "chip-circuito-generico" as ComponentId, quantity: 3 },
        { ref: "cable-cobre" as ComponentId, quantity: 2 },
        { ref: "cable-fibra-optica" as ComponentId, quantity: 1 },
        { ref: "bateria-celda-simple" as ComponentId, quantity: 1 },
      ],
    },
  },
  {
    id: "celda-energia-municion" as ComponentId,
    name: "Celda de energía de munición",
    data: {
      functional: [{ tag: "RES", resourceType: "E", capacity: 120, dischargeRate: 20, powerUnits: 2 }],
      material: { CE: "A" },
    },
    recipe: {
      ingredients: [
        { ref: "bateria-celda-simple" as ComponentId, quantity: 3 },
        { ref: "cable-cobre" as ComponentId, quantity: 2 },
        { ref: "resistencia-electrica" as ComponentId, quantity: 1 },
      ],
    },
  },
  {
    id: "panel-estructural-reforzado" as ComponentId,
    name: "Panel estructural reforzado",
    data: {
      functional: [{ tag: "EST", damageResistance: 70, articulatedRange: undefined }],
      material: { RE: "A" },
    },
    recipe: {
      ingredients: [
        { ref: "plancha-metalica" as ComponentId, quantity: 2 },
        { ref: "tornilleria-fijacion" as ComponentId, quantity: 4 },
        { ref: "cable-cobre" as ComponentId, quantity: 1 },
      ],
    },
  },
  {
    id: "extintor-militar" as ComponentId,
    contains: "nitrogeno" as ChemicalSubstanceId,
    name: "Extintor militar",
    data: {
      functional: [{ tag: "RES", resourceType: "G", capacity: 100, dischargeRate: 15 }],
      material: { RE: "M" },
    },
    recipe: {
      ingredients: [
        { ref: "tubo-rigido" as ComponentId, quantity: 1 },
        { ref: "valvula-simple" as ComponentId, quantity: 1 },
        { ref: "junta-hermetica" as ComponentId, quantity: 2 },
      ],
    },
    // Nota: contiene Nitrógeno (catálogo químico: nitrogeno).
  },
  {
    id: "consola-mando-central" as ComponentId,
    name: "Consola de mando central",
    data: {
      functional: [
        { tag: "REC", threshold: 0.2, responseDelayMs: 30 },
        { tag: "EM", range: 0, triggerType: "manual", frequency: 10 },
      ],
      material: { CE: "M" },
    },
    recipe: {
      ingredients: [
        { ref: "chip-circuito-generico" as ComponentId, quantity: 4 },
        { ref: "cable-cobre" as ComponentId, quantity: 3 },
        { ref: "plancha-metalica" as ComponentId, quantity: 1 },
      ],
    },
  },
  {
    id: "radar-largo-alcance" as ComponentId,
    name: "Radar de largo alcance",
    data: {
      functional: [
        { tag: "EM", range: 50, triggerType: "radar", frequency: 2 },
        { tag: "REC", threshold: 0.3, responseDelayMs: 100 },
      ],
      material: { CE: "A" },
    },
    recipe: {
      ingredients: [
        { ref: "chip-circuito-generico" as ComponentId, quantity: 2 },
        { ref: "cable-cobre" as ComponentId, quantity: 2 },
        { ref: "bateria-celda-simple" as ComponentId, quantity: 1 },
        { ref: "placa-disipadora" as ComponentId, quantity: 1 },
      ],
    },
  },
  {
    id: "motor-propulsion-combate" as ComponentId,
    name: "Motor de propulsión de combate",
    data: {
      functional: [{ tag: "ACT", power: 150, cadence: 8, directional: true }],
      material: { CE: "A", CT: "A" },
    },
    recipe: {
      ingredients: [
        { ref: "motor-pequeno" as ComponentId, quantity: 3 },
        { ref: "cable-cobre" as ComponentId, quantity: 4 },
        { ref: "placa-disipadora" as ComponentId, quantity: 2 },
        { ref: "chip-circuito-generico" as ComponentId, quantity: 1 },
      ],
    },
  },
  {
    id: "reservorio-combustible-motor" as ComponentId,
    contains: "combustible-de-motor" as ChemicalSubstanceId,
    name: "Reservorio de combustible de motor",
    data: {
      functional: [{ tag: "RES", resourceType: "L", capacity: 200, dischargeRate: 30 }],
      material: { RE: "M" },
    },
    recipe: {
      ingredients: [
        { ref: "tubo-rigido" as ComponentId, quantity: 2 },
        { ref: "valvula-simple" as ComponentId, quantity: 1 },
        { ref: "junta-hermetica" as ComponentId, quantity: 2 },
      ],
    },
    // Nota: contiene Combustible de motor (catálogo químico: combustible-de-motor).
  },
  {
    id: "kit-medico-basico" as ComponentId,
    contains: "anestesico-medico" as ChemicalSubstanceId,
    name: "Kit médico básico",
    data: {
      functional: [
        { tag: "RES", resourceType: "L", capacity: 40, dischargeRate: 2 },
        { tag: "REC", threshold: 0.5, responseDelayMs: 100 },
      ],
      material: { CE: "N" },
    },
    recipe: {
      ingredients: [
        { ref: "carcasa-plastica" as ComponentId, quantity: 1 },
        { ref: "tubo-flexible" as ComponentId, quantity: 1 },
        { ref: "junta-hermetica" as ComponentId, quantity: 1 },
      ],
    },
    // Nota: contiene Anestésico médico dosis baja (catálogo químico: anestesico-medico).
  },
  {
    id: "cable-blindado-alto-amperaje" as ComponentId,
    name: "Cable blindado de alto amperaje",
    data: {
      functional: [{ tag: "COND", resourceType: "E", maxCapacity: 150 }],
      material: { CE: "A", RE: "A" },
    },
    recipe: {
      ingredients: [
        { ref: "cable-cobre" as ComponentId, quantity: 2 },
        { ref: "plancha-metalica" as ComponentId, quantity: 1 },
        { ref: "tornilleria-fijacion" as ComponentId, quantity: 2 },
      ],
    },
  },
  {
    id: "reservorio-propelente-municion" as ComponentId,
    contains: "propelente-oxidante-municion" as ChemicalSubstanceId,
    name: "Reservorio de propelente de munición",
    data: {
      functional: [{ tag: "RES", resourceType: "L", capacity: 100, dischargeRate: 10 }],
      material: { CE: "M" },
    },
    recipe: {
      ingredients: [
        { ref: "tubo-rigido" as ComponentId, quantity: 1 },
        { ref: "valvula-simple" as ComponentId, quantity: 1 },
        { ref: "junta-hermetica" as ComponentId, quantity: 2 },
      ],
    },
    // Nota: contiene Propelente/oxidante de munición (catálogo químico: propelente-oxidante-municion).
  },
  {
    id: "reservorio-acido-bateria" as ComponentId,
    contains: "acido-de-bateria" as ChemicalSubstanceId,
    name: "Reservorio de ácido de batería",
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
    // Nota: contiene Ácido de batería (catálogo químico: acido-de-bateria).
  },
  {
    id: "garra-de-abordaje" as ComponentId,
    name: "Garra de abordaje",
    data: {
      // Solo ACT, sin EM: alcance nulo por diseño — es el arma cuerpo a cuerpo
      // de referencia (Fase 11d), en contraste directo con `torreta-automatizada`
      // (EM+ACT, a distancia). Mismo mecanismo de propiedades ya existente en el
      // catálogo, sin inventar un tag de "arma" — así un enemigo cuerpo a cuerpo
      // referencia este componente (`EnemyActor.weaponComponentId`) igual que uno
      // a distancia referencia `torreta-automatizada`, y desarmarlo a futuro es
      // degradar esta misma instancia/definición.
      functional: [{ tag: "ACT", power: 50, cadence: 4, directional: true }],
      material: { RE: "M" },
    },
    recipe: {
      ingredients: [
        { ref: "motor-pequeno" as ComponentId, quantity: 1 },
        { ref: "plancha-metalica" as ComponentId, quantity: 1 },
        { ref: "tornilleria-fijacion" as ComponentId, quantity: 2 },
      ],
    },
  },
];
