import { describe, expect, it } from "vitest";
import {
  consumeStock,
  creditStock,
  hasStock,
  stockOf,
  stockOfWear,
  wearBucketsOf,
} from "./inventory-ledger.js";
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

  it("credits new stock onto an empty ledger", () => {
    const empty: AtomicPartsStock = {};
    const credited = creditStock(empty, MOTOR, 2);
    expect(stockOf(credited, MOTOR)).toBe(2);
    expect(stockOf(empty, MOTOR)).toBe(0);
  });

  it("credits on top of existing stock of the same component", () => {
    const stock: AtomicPartsStock = { [MOTOR]: { nuevo: 1 } };
    expect(stockOf(creditStock(stock, MOTOR), MOTOR)).toBe(2);
  });

  it("consumes stock when enough is available", () => {
    const stock: AtomicPartsStock = { [MOTOR]: { nuevo: 2 } };
    const consumed = consumeStock(stock, MOTOR, 1);
    expect(consumed).not.toBeNull();
    expect(stockOf(consumed!, MOTOR)).toBe(1);
  });

  it("refuses to consume more than available and does not mutate the input", () => {
    const stock: AtomicPartsStock = { [MOTOR]: { nuevo: 1 } };
    expect(consumeStock(stock, MOTOR, 2)).toBeNull();
    expect(stockOf(stock, MOTOR)).toBe(1);
  });

  it("does not affect stock of other components", () => {
    const stock: AtomicPartsStock = { [MOTOR]: { nuevo: 1 }, [VALVE]: { nuevo: 3 } };
    const consumed = consumeStock(stock, MOTOR, 1);
    expect(stockOf(consumed!, VALVE)).toBe(3);
  });

  describe("wear buckets (13c)", () => {
    it("sums every wear bucket in stockOf, so old callers stay correct", () => {
      const stock: AtomicPartsStock = { [MOTOR]: { nuevo: 2, degradado: 3 } };
      expect(stockOf(stock, MOTOR)).toBe(5);
      expect(hasStock(stock, MOTOR, 5)).toBe(true);
    });

    it("keeps each bucket separate", () => {
      const stock: AtomicPartsStock = { [MOTOR]: { nuevo: 2, usado: 1 } };
      expect(stockOfWear(stock, MOTOR, "nuevo")).toBe(2);
      expect(stockOfWear(stock, MOTOR, "usado")).toBe(1);
      expect(stockOfWear(stock, MOTOR, "critico")).toBe(0);
    });

    it("credits into the requested bucket without touching the others", () => {
      const stock: AtomicPartsStock = { [MOTOR]: { nuevo: 2 } };
      const credited = creditStock(stock, MOTOR, 1, "degradado");
      expect(stockOfWear(credited, MOTOR, "nuevo")).toBe(2);
      expect(stockOfWear(credited, MOTOR, "degradado")).toBe(1);
    });

    it("consumes from the requested bucket only", () => {
      const stock: AtomicPartsStock = { [MOTOR]: { nuevo: 1, usado: 2 } };
      const consumed = consumeStock(stock, MOTOR, 1, "usado");
      expect(stockOfWear(consumed!, MOTOR, "usado")).toBe(1);
      expect(stockOfWear(consumed!, MOTOR, "nuevo")).toBe(1);
    });

    it("refuses to fall back to a different bucket when the requested one is empty", () => {
      // Pedir una pieza `nuevo` teniendo solo `degradado` DEBE fallar: darle la
      // degradada en silencio sería la UI mintiendo sobre el estado del motor.
      const stock: AtomicPartsStock = { [MOTOR]: { degradado: 5 } };
      expect(consumeStock(stock, MOTOR, 1, "nuevo")).toBeNull();
      expect(stockOf(stock, MOTOR)).toBe(5);
    });

    it("drops a bucket that reaches zero instead of leaving noise in the save", () => {
      const stock: AtomicPartsStock = { [MOTOR]: { nuevo: 1, usado: 1 } };
      const consumed = consumeStock(stock, MOTOR, 1, "nuevo");
      expect(consumed![MOTOR]).toEqual({ usado: 1 });
    });

    it("lists non-empty buckets from best to worst wear", () => {
      const stock: AtomicPartsStock = { [MOTOR]: { critico: 1, nuevo: 2, degradado: 4 } };
      expect(wearBucketsOf(stock, MOTOR)).toEqual([
        { wear: "nuevo", quantity: 2 },
        { wear: "degradado", quantity: 4 },
        { wear: "critico", quantity: 1 },
      ]);
    });

    it("lists nothing for a component with no stock", () => {
      expect(wearBucketsOf({}, MOTOR)).toEqual([]);
    });
  });
});
