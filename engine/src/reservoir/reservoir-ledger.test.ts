import { describe, expect, it } from "vitest";
import {
  contentOf,
  drawFrom,
  emptyReservoir,
  freeCapacity,
  pourInto,
  ReservoirOccupiedError,
  type ReservoirContents,
} from "./reservoir-ledger.js";
import type { PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { ChemicalSubstanceId } from "../chemistry/chemical-substance.types.js";

const TANQUE = "tanque-1" as PlacedComponentInstanceId;
const OTRO = "tanque-2" as PlacedComponentInstanceId;
const AGUA = "agua" as ChemicalSubstanceId;
const ACIDO = "acido-de-laboratorio" as ChemicalSubstanceId;

const withAgua = (amount: number): ReservoirContents => [
  { componentInstanceId: TANQUE, substanceId: AGUA, amount },
];

describe("contentOf / freeCapacity", () => {
  it("un reservorio sin entrada está vacío", () => {
    expect(contentOf([], TANQUE)).toBeUndefined();
    expect(freeCapacity([], TANQUE, 100)).toBe(100);
  });

  it("una entrada en cero cuenta como vacía, no como contenido", () => {
    expect(contentOf(withAgua(0), TANQUE)).toBeUndefined();
  });

  it("el espacio libre descuenta lo que ya hay", () => {
    expect(freeCapacity(withAgua(30), TANQUE, 100)).toBe(70);
  });

  it("no devuelve espacio negativo si el contenido excede la capacidad", () => {
    expect(freeCapacity(withAgua(150), TANQUE, 100)).toBe(0);
  });
});

describe("pourInto", () => {
  it("llena un reservorio vacío", () => {
    const result = pourInto([], TANQUE, AGUA, 40, 100);
    expect(result.poured).toBe(40);
    expect(result.overflow).toBe(0);
    expect(contentOf(result.contents, TANQUE)).toEqual({
      componentInstanceId: TANQUE,
      substanceId: AGUA,
      amount: 40,
    });
  });

  it("suma sobre la MISMA sustancia", () => {
    const result = pourInto(withAgua(30), TANQUE, AGUA, 20, 100);
    expect(contentOf(result.contents, TANQUE)?.amount).toBe(50);
  });

  it("recorta a la capacidad y reporta el desborde perdido", () => {
    const result = pourInto(withAgua(90), TANQUE, AGUA, 30, 100);
    expect(result.poured).toBe(10);
    expect(result.overflow).toBe(20);
    expect(contentOf(result.contents, TANQUE)?.amount).toBe(100);
  });

  it("RECHAZA verter otra sustancia distinta: hay que purgar antes", () => {
    // Decisión de diseño (2026-08-06): un reservorio contiene una sustancia a
    // la vez; mezclar in-situ sería otro sistema.
    expect(() => pourInto(withAgua(30), TANQUE, ACIDO, 10, 100)).toThrow(ReservoirOccupiedError);
  });

  it("sí admite otra sustancia si el reservorio quedó vacío", () => {
    const vaciado = emptyReservoir(withAgua(30), TANQUE);
    const result = pourInto(vaciado.contents, TANQUE, ACIDO, 10, 100);
    expect(contentOf(result.contents, TANQUE)?.substanceId).toBe(ACIDO);
  });

  it("verter cero o negativo es un no-op", () => {
    expect(pourInto(withAgua(30), TANQUE, AGUA, 0, 100).poured).toBe(0);
    expect(pourInto(withAgua(30), TANQUE, AGUA, -5, 100).poured).toBe(0);
  });

  it("no toca el contenido de otras instancias", () => {
    const contents: ReservoirContents = [
      ...withAgua(10),
      { componentInstanceId: OTRO, substanceId: ACIDO, amount: 5 },
    ];
    const result = pourInto(contents, TANQUE, AGUA, 5, 100);
    expect(contentOf(result.contents, OTRO)?.amount).toBe(5);
  });
});

describe("drawFrom / emptyReservoir", () => {
  it("saca lo pedido y devuelve qué sustancia era", () => {
    const result = drawFrom(withAgua(50), TANQUE, 20);
    expect(result.drawn).toBe(20);
    expect(result.substanceId).toBe(AGUA);
    expect(contentOf(result.contents, TANQUE)?.amount).toBe(30);
  });

  it("el parcial SÍ es válido: saca lo que hay si se pide de más", () => {
    const result = drawFrom(withAgua(5), TANQUE, 50);
    expect(result.drawn).toBe(5);
    expect(contentOf(result.contents, TANQUE)).toBeUndefined();
  });

  it("borra la entrada al vaciarse, sin dejar fila fantasma en el guardado", () => {
    expect(drawFrom(withAgua(5), TANQUE, 5).contents).toEqual([]);
  });

  it("sacar de un reservorio vacío no rompe", () => {
    const result = drawFrom([], TANQUE, 10);
    expect(result.drawn).toBe(0);
    expect(result.substanceId).toBeUndefined();
  });

  it("emptyReservoir vacía por completo", () => {
    const result = emptyReservoir(withAgua(42), TANQUE);
    expect(result.drawn).toBe(42);
    expect(result.contents).toEqual([]);
  });

  it("no muta el array de entrada", () => {
    const contents = withAgua(50);
    drawFrom(contents, TANQUE, 20);
    expect(contents[0]?.amount).toBe(50);
  });
});
