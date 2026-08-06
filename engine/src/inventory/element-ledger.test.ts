import { describe, expect, it } from "vitest";
import {
  consumeElements,
  creditElementList,
  creditElements,
  elementStockOf,
  hasElements,
  missingElements,
  tallyElements,
} from "./element-ledger.js";
import type { ElementStock } from "./inventory.types.js";
import type { ChemicalSubstanceId } from "../chemistry/chemical-substance.types.js";

const H = "hidrogeno" as ChemicalSubstanceId;
const O = "oxigeno" as ChemicalSubstanceId;
const NA = "sodio" as ChemicalSubstanceId;

/** Selección estilo mesa de creación: array con repetidos, la proporción es la multiplicidad. */
const AGUA = [H, H, O];

describe("elementStockOf", () => {
  it("una clave ausente vale cero", () => {
    expect(elementStockOf({}, H)).toBe(0);
    expect(elementStockOf({ [H]: 3 }, H)).toBe(3);
  });
});

describe("tallyElements", () => {
  it("cuenta la multiplicidad de la selección", () => {
    expect([...tallyElements(AGUA)]).toEqual([
      [H, 2],
      [O, 1],
    ]);
  });
});

describe("missingElements / hasElements", () => {
  it("detalla QUÉ falta y cuánto, no solo que falta", () => {
    expect(missingElements({ [H]: 1 }, AGUA)).toEqual([
      { elementId: H, missing: 1 },
      { elementId: O, missing: 1 },
    ]);
  });

  it("con stock exacto no falta nada", () => {
    const stock: ElementStock = { [H]: 2, [O]: 1 };
    expect(missingElements(stock, AGUA)).toEqual([]);
    expect(hasElements(stock, AGUA)).toBe(true);
  });

  it("el stock se cuenta por elemento, no por total de unidades", () => {
    // 3 unidades en total, pero ninguna de oxígeno.
    expect(hasElements({ [H]: 3 }, AGUA)).toBe(false);
  });
});

describe("consumeElements", () => {
  it("descuenta la selección completa respetando la multiplicidad", () => {
    expect(consumeElements({ [H]: 5, [O]: 2 }, AGUA)).toEqual({ [H]: 3, [O]: 1 });
  });

  it("borra la clave al llegar a cero para no dejar ruido en el guardado", () => {
    expect(consumeElements({ [H]: 2, [O]: 1 }, AGUA)).toEqual({});
  });

  it("devuelve null SIN descontar parcialmente si algo no alcanza", () => {
    const stock: ElementStock = { [H]: 2 };
    expect(consumeElements(stock, AGUA)).toBeNull();
    // El stock original queda intacto: nada de quedarse a medio gastar.
    expect(stock).toEqual({ [H]: 2 });
  });

  it("no muta el stock de entrada", () => {
    const stock: ElementStock = { [H]: 5, [O]: 2 };
    consumeElements(stock, AGUA);
    expect(stock).toEqual({ [H]: 5, [O]: 2 });
  });
});

describe("creditElements / creditElementList", () => {
  it("acredita sobre lo que ya había", () => {
    expect(creditElements({ [H]: 1 }, H, 2)).toEqual({ [H]: 3 });
    expect(creditElements({}, NA)).toEqual({ [NA]: 1 });
  });

  it("ignora cantidades no positivas en vez de dejar claves basura", () => {
    expect(creditElements({ [H]: 1 }, O, 0)).toEqual({ [H]: 1 });
    expect(creditElements({ [H]: 1 }, O, -3)).toEqual({ [H]: 1 });
  });

  it("acredita una lista completa respetando repetidos (extracción, GDD 5.4.1)", () => {
    expect(creditElementList({ [O]: 1 }, AGUA)).toEqual({ [O]: 2, [H]: 2 });
  });

  it("consumir y volver a acreditar la misma selección deja el stock igual", () => {
    const stock: ElementStock = { [H]: 4, [O]: 3 };
    const consumed = consumeElements(stock, AGUA);
    expect(consumed).not.toBeNull();
    expect(creditElementList(consumed as ElementStock, AGUA)).toEqual(stock);
  });
});
