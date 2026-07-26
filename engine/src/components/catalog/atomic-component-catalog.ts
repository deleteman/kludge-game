/**
 * Catálogo de componentes atómicos universales (GDD 7.2).
 * 21 piezas, disponibles en los 4 arquetipos. Solo los atómicos tienen footprint fijo de catálogo.
 */

import type { ComponentId } from "../physical-component.types.js";
import type { Footprint } from "../../geometry/grid-position.types.js";
import type { FunctionalProperties } from "../../properties/functional.types.js";
import type { MaterialProperties } from "../../properties/material.types.js";

export interface AtomicComponentSpec {
  readonly id: ComponentId;
  readonly name: string;
  readonly data: {
    readonly footprint: Footprint;
    readonly functional?: FunctionalProperties;
    readonly material?: MaterialProperties;
  };
}

export const ATOMIC_COMPONENT_CATALOG: ReadonlyArray<AtomicComponentSpec> = [
  {
    id: "plancha-metalica" as ComponentId,
    name: "Plancha metálica",
    data: {
      footprint: { width: 2, height: 2 },
      functional: [{ tag: "EST", damageResistance: 50, articulatedRange: undefined }],
      material: { RE: "M" },
    },
  },
  {
    id: "tornilleria-fijacion" as ComponentId,
    name: "Tornillería/fijación",
    data: {
      footprint: { width: 1, height: 1 },
      functional: [{ tag: "EST", damageResistance: 20, articulatedRange: undefined }],
      material: { RE: "B" },
    },
  },
  {
    id: "cable-cobre" as ComponentId,
    name: "Cable de cobre",
    data: {
      footprint: { width: 1, height: 1 },
      functional: [{ tag: "COND", resourceType: "E", maxCapacity: 100 }],
      material: { CE: "A" },
    },
  },
  {
    id: "bobina-cobre" as ComponentId,
    name: "Bobina de cobre",
    data: {
      footprint: { width: 1, height: 1 },
      functional: [{ tag: "COND", resourceType: "E", maxCapacity: 100 }],
      material: { CE: "A" },
    },
    // Nota: enrollado; cuando se combina con núcleo ferromagnético + corriente → electroimán (GDD 5.2, caso 9).
  },
  {
    id: "resistencia-electrica" as ComponentId,
    name: "Resistencia eléctrica",
    data: {
      footprint: { width: 1, height: 1 },
      functional: [{ tag: "COND", resourceType: "E", maxCapacity: 50 }],
      material: { CE: "A" },
    },
    // Nota: conductor con pérdida controlada, limita corriente.
  },
  {
    id: "celula-fotovoltaica" as ComponentId,
    name: "Célula fotovoltaica",
    data: {
      footprint: { width: 1, height: 2 },
      functional: [{ tag: "RES", resourceType: "E", capacity: 60, dischargeRate: 5 }],
      material: { CE: "A" },
    },
    // Nota: reservorio pequeño, regenerable (GDD 7.2).
  },
  {
    id: "bateria-celda-simple" as ComponentId,
    name: "Batería celda simple",
    data: {
      footprint: { width: 1, height: 1 },
      functional: [{ tag: "RES", resourceType: "E", capacity: 40, dischargeRate: 5 }],
      material: { CE: "A" },
    },
    // Nota: reservorio pequeño, no regenerable.
  },
  {
    id: "chip-circuito-generico" as ComponentId,
    name: "Chip de circuito genérico",
    data: {
      footprint: { width: 1, height: 1 },
      functional: [{ tag: "REC", threshold: 0.5, responseDelayMs: 100 }],
    },
  },
  {
    id: "lente-optica" as ComponentId,
    name: "Lente óptica",
    data: {
      footprint: { width: 1, height: 1 },
    },
    // Nota: componente óptico base. Propiedad óptica no tiene representación en propiedades actuales (properties/).
  },
  {
    id: "emisor-laser-baja-potencia" as ComponentId,
    name: "Emisor láser de baja potencia",
    data: {
      footprint: { width: 1, height: 1 },
      functional: [{ tag: "ACT", power: 20, cadence: 10, directional: true }],
    },
  },
  {
    id: "fotorreceptor" as ComponentId,
    name: "Fotorreceptor",
    data: {
      footprint: { width: 1, height: 1 },
      functional: [{ tag: "EM", range: 10, triggerType: "optical", frequency: 1 }],
    },
  },
  {
    id: "iman-permanente" as ComponentId,
    name: "Imán permanente",
    data: {
      footprint: { width: 1, height: 1 },
      material: { MAG: true, RE: "M" },
    },
    // Nota: núcleo ferromagnético para electroimanes (caso 9), sin conductividad eléctrica declarada.
    // `RE` declarada en la Fase 11a.1: como proyectil de un riel (caso 17) su masa virtual sale
    // ligera — es un imán chico, no un ariete. Que no reviente una puerta ni mate a un tripulante
    // es el resultado buscado: para eso está `pieza-hierro`.
  },
  {
    id: "pieza-hierro" as ComponentId,
    name: "Pieza de hierro",
    data: {
      footprint: { width: 1, height: 1 },
      material: { MAG: true, RE: "A" },
    },
    // Nota: hierro macizo. El documento §5 la nombra junto al imán permanente como proyectil
    // posible del riel improvisado ("un imán permanente o pieza de hierro"); hasta la Fase 11a.1
    // solo existía como cuerpo ficticio del test del caso 17. Es la contraparte pesada del imán:
    // mismo footprint, `RE` alta, masa virtual mayor -> daño de impacto mayor (ASA 1).
  },
  {
    id: "tubo-rigido" as ComponentId,
    name: "Tubo rígido",
    data: {
      footprint: { width: 1, height: 2 },
      functional: [
        { tag: "COND", resourceType: "L", maxCapacity: 80 },
        { tag: "COND", resourceType: "G", maxCapacity: 80 },
      ],
      material: { RE: "M" },
    },
    // Nota: transporta líquido o gas (array de dos COND, uno por tipo de recurso).
  },
  {
    id: "tubo-flexible" as ComponentId,
    name: "Tubo flexible",
    data: {
      footprint: { width: 1, height: 2 },
      functional: [
        { tag: "COND", resourceType: "L", maxCapacity: 60 },
        { tag: "COND", resourceType: "G", maxCapacity: 60 },
      ],
      material: { RE: "B" },
    },
    // Nota: transporta líquido o gas, flexible/maleable.
  },
  {
    id: "junta-hermetica" as ComponentId,
    name: "Junta hermética/goma",
    data: {
      footprint: { width: 1, height: 1 },
      material: { ES: "S", CE: "N" },
    },
    // Nota: sellado, sin propiedades funcionales ni conductividad.
  },
  {
    id: "valvula-simple" as ComponentId,
    name: "Válvula simple",
    data: {
      footprint: { width: 1, height: 1 },
      functional: [{ tag: "ACT", power: 10, cadence: 5, directional: false }],
    },
    // Nota: actuador para abrir/cerrar flujo en conductos.
  },
  {
    id: "placa-disipadora" as ComponentId,
    name: "Placa disipadora",
    data: {
      footprint: { width: 1, height: 2 },
      material: { CT: "A" },
    },
    // Nota: regulador térmico, conductividad térmica alta.
  },
  {
    id: "placa-aislante-termica" as ComponentId,
    name: "Placa aislante térmica",
    data: {
      footprint: { width: 1, height: 2 },
      material: { CT: "B" },
    },
  },
  {
    id: "motor-pequeno" as ComponentId,
    name: "Motor pequeño (servo)",
    data: {
      footprint: { width: 2, height: 2 },
      functional: [{ tag: "ACT", power: 50, cadence: 15, directional: true }],
    },
    // Nota: movimiento mecánico básico.
  },
  {
    id: "carcasa-plastica" as ComponentId,
    name: "Carcasa plástica",
    data: {
      footprint: { width: 2, height: 2 },
      functional: [{ tag: "EST", damageResistance: 30, articulatedRange: undefined }],
      material: { CE: "N" },
    },
    // Nota: contenedor, sin conductividad eléctrica.
  },
];
