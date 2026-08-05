import { describe, expect, it } from "vitest";
import { buildComponentCatalog } from "../components/catalog/build-component-catalog.js";
import type { ComponentId } from "../components/physical-component.types.js";
import { isElectricallyLive, isElectricSource, isInstanceEnergized } from "./instance-energized.js";

/**
 * Fix de playtest de 13d, ronda 1. Estos tests corren contra el CATÁLOGO REAL,
 * no contra definiciones sintéticas: el bug original fue justamente que el
 * predicado se comportaba distinto con las piezas de verdad que con los dobles
 * de los tests.
 */
const REGISTRY = buildComponentCatalog().registry;
const definitionOf = (id: string) => REGISTRY.get(id as ComponentId);

describe("isElectricallyLive (13d)", () => {
  it.each(["cable-cobre", "bobina-cobre", "resistencia-electrica", "valvula-simple", "chip-circuito-generico"])(
    "%s participa del sistema eléctrico",
    (id) => {
      expect(isElectricallyLive(definitionOf(id))).toBe(true);
    },
  );

  it.each(["junta-hermetica", "tubo-flexible", "tubo-rigido", "placa-aislante-termica"])(
    "%s no participa del sistema eléctrico",
    (id) => {
      expect(isElectricallyLive(definitionOf(id))).toBe(false);
    },
  );

  it("una pieza desconocida (definición ausente) nunca es eléctrica", () => {
    expect(isElectricallyLive(undefined)).toBe(false);
  });
});

describe("isElectricSource (13d)", () => {
  it.each(["bateria-celda-simple", "celula-fotovoltaica"])("%s es fuente con carga propia", (id) => {
    expect(isElectricSource(definitionOf(id))).toBe(true);
  });

  it("un conductor no es fuente aunque sea eléctrico", () => {
    expect(isElectricSource(definitionOf("cable-cobre"))).toBe(false);
  });
});

describe("isInstanceEnergized (13d)", () => {
  const cable = definitionOf("cable-cobre");
  const battery = definitionOf("bateria-celda-simple");
  const seal = definitionOf("junta-hermetica");

  it("un conductor en una sección alimentada está vivo", () => {
    expect(
      isInstanceEnergized({ definition: cable, sectionHasGrantedPower: true, sourceDischarged: false }),
    ).toBe(true);
  });

  it("EL BUG: el mismo conductor con la sección en 0 unidades ya NO está vivo", () => {
    expect(
      isInstanceEnergized({ definition: cable, sectionHasGrantedPower: false, sourceDischarged: false }),
    ).toBe(false);
  });

  it("una pieza no eléctrica nunca está viva, aunque la sección tenga energía", () => {
    expect(
      isInstanceEnergized({ definition: seal, sectionHasGrantedPower: true, sourceDischarged: false }),
    ).toBe(false);
  });

  it("una fuente lleva su propia carga: sigue viva con la sección a oscuras", () => {
    expect(
      isInstanceEnergized({ definition: battery, sectionHasGrantedPower: false, sourceDischarged: false }),
    ).toBe(true);
  });

  it("una fuente descargada deja de estar viva", () => {
    expect(
      isInstanceEnergized({ definition: battery, sectionHasGrantedPower: true, sourceDischarged: true }),
    ).toBe(false);
  });
});
