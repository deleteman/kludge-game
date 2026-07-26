import { describe, expect, it } from "vitest";
import { consumeStock, creditStock, hasStock, stockOf } from "./inventory-ledger.js";
import type { AtomicPartsStock } from "./inventory.types.js";
import type { ComponentId } from "../components/physical-component.types.js";

const MOTOR = "motor-pequeno" as ComponentId;
const VALVE = "valvula-simple" as ComponentId;

describe("inventory-ledger", () => {
  it("treats an absent key as zero stock", () => {
    const stock: AtomicPartsStock = {};
    expect(stockOf(stock, MOTOR)).toBe(0);
    expect(hasStock(stock, MOTOR)).toBe(false);
  });

  it("credits stock immutably", () => {
    const empty: AtomicPartsStock = {};
    const credited = creditStock(empty, MOTOR, 2);
    expect(empty[MOTOR]).toBeUndefined();
    expect(credited[MOTOR]).toBe(2);
  });

  it("credits on top of existing stock of the same component", () => {
    const stock: AtomicPartsStock = { [MOTOR]: 1 };
    expect(creditStock(stock, MOTOR)[MOTOR]).toBe(2);
  });

  it("consumes stock when enough is available", () => {
    const stock: AtomicPartsStock = { [MOTOR]: 2 };
    const consumed = consumeStock(stock, MOTOR, 1);
    expect(consumed).not.toBeNull();
    expect(consumed?.[MOTOR]).toBe(1);
  });

  it("refuses to consume more than available and does not mutate the input", () => {
    const stock: AtomicPartsStock = { [MOTOR]: 1 };
    const result = consumeStock(stock, MOTOR, 2);
    expect(result).toBeNull();
    expect(stock[MOTOR]).toBe(1);
  });

  it("does not affect stock of other components", () => {
    const stock: AtomicPartsStock = { [MOTOR]: 1, [VALVE]: 3 };
    const consumed = consumeStock(stock, MOTOR, 1);
    expect(consumed?.[VALVE]).toBe(3);
  });
});
