import { describe, expect, it } from "vitest";
import { effectiveResistance, effectiveResistanceSteps } from "./effective-resistance.js";
import { CAPACITY_LOSS_PER_WEAR_STEP, wornCapacity } from "./overload-capacity.js";
import { wearAfterDismantle } from "./dismantle-wear.js";
import { sequenceRandom } from "../simulation/random-source.js";
import { type ComponentWear, WEAR_ORDER, wearSteps, worsenWear, worstWear } from "./wear.types.js";

describe("wear: escala", () => {
  it("cuenta un escalón de daño por nivel", () => {
    expect(wearSteps("nuevo")).toBe(0);
    expect(wearSteps("usado")).toBe(1);
    expect(wearSteps("degradado")).toBe(2);
    expect(wearSteps("critico")).toBe(3);
  });

  it("empeora un escalón a la vez", () => {
    expect(worsenWear("nuevo")).toBe("usado");
    expect(worsenWear("usado")).toBe("degradado");
    expect(worsenWear("degradado")).toBe("critico");
  });

  it("hace piso en critico en vez de desbordar (no hay quinto nivel)", () => {
    expect(worsenWear("critico")).toBe("critico");
  });

  it("no ofrece ninguna forma de mejorar el desgaste (principio 5: sin undo gratuito)", () => {
    // Chequeo de contrato, no de comportamiento: si algún día aparece una
    // función de reparación, debe llegar con su coste y su propio test.
    const api = Object.keys({ wearSteps, worsenWear, worstWear });
    expect(api.some((name) => /improve|repair|restore|reset/i.test(name))).toBe(false);
  });

  it("elige el peor desgaste de un conjunto", () => {
    expect(worstWear(["nuevo", "degradado", "usado"])).toBe("degradado");
    expect(worstWear([])).toBeUndefined();
  });
});

describe("wear: resistencia efectiva (mapeo 1:1)", () => {
  it("no degrada nada cuando la pieza es nueva", () => {
    expect(effectiveResistance("A", "nuevo")).toBe("A");
    expect(effectiveResistance("M", "nuevo")).toBe("M");
    expect(effectiveResistance("B", "nuevo")).toBe("B");
  });

  it("baja un escalón de RE por cada escalón de desgaste, desde catálogo A", () => {
    expect(effectiveResistance("A", "usado")).toBe("M");
    expect(effectiveResistance("A", "degradado")).toBe("B");
    expect(effectiveResistance("A", "critico")).toBe("fallo");
  });

  it("una pieza de catálogo frágil llega a fallo con un solo escalón", () => {
    // No es un caso a suavizar: es exactamente lo que "frágil" significa.
    expect(effectiveResistance("B", "usado")).toBe("fallo");
    expect(effectiveResistance("M", "usado")).toBe("B");
    expect(effectiveResistance("M", "degradado")).toBe("fallo");
  });

  it("nunca devuelve un nivel peor que fallo por mucho que se acumule", () => {
    expect(effectiveResistance("B", "critico")).toBe("fallo");
  });

  it("devuelve null si la pieza no declara RE de catálogo", () => {
    expect(effectiveResistance(undefined, "critico")).toBeNull();
  });

  it("asume nuevo cuando no se pasa desgaste", () => {
    expect(effectiveResistance("M")).toBe("M");
  });

  describe("retrocompatibilidad de saves ≤ v6", () => {
    it("respeta la cicatriz vieja de structuralResistanceOverride", () => {
      expect(effectiveResistance("A", "nuevo", "B")).toBe("B");
    });

    it("se queda con el PEOR de los dos ejes, sin sumarlos", () => {
      // Un save v6 con override "M" + desgaste "degradado" (=B) da B, no fallo:
      // los dos campos describen el MISMO daño, no dos daños distintos.
      expect(effectiveResistance("A", "degradado", "M")).toBe("B");
    });

    it("ignora un override que no empeora nada", () => {
      expect(effectiveResistance("A", "usado", "A")).toBe("M");
    });
  });

  it("expone los niveles como pasos comparables", () => {
    expect(effectiveResistanceSteps("A")).toBe(0);
    expect(effectiveResistanceSteps("fallo")).toBe(3);
  });
});

describe("wear: capacidad ante sobrecarga", () => {
  it("no recorta la capacidad de una pieza nueva", () => {
    expect(wornCapacity(100, "nuevo")).toBe(100);
  });

  it("recorta un porcentaje fijo por escalón", () => {
    expect(wornCapacity(100, "usado")).toBeCloseTo(85);
    expect(wornCapacity(100, "degradado")).toBeCloseTo(70);
    expect(wornCapacity(100, "critico")).toBeCloseTo(55);
  });

  it("deriva del parámetro publicado, no de números sueltos", () => {
    for (const wear of WEAR_ORDER) {
      const expected = 200 * (1 - CAPACITY_LOSS_PER_WEAR_STEP * wearSteps(wear));
      expect(wornCapacity(200, wear)).toBeCloseTo(expected);
    }
  });

  it("nunca deja la capacidad en cero ni negativa con la escala actual", () => {
    expect(wornCapacity(100, "critico")).toBeGreaterThan(0);
  });
});

describe("wear: canibalización (GDD §6.5)", () => {
  const base = { current: "nuevo" as ComponentWear, tier: "novato" as const, specialty: "seguridad" as const };

  it("no degrada nada si no se inyectó azar (comportamiento pre-13c)", () => {
    expect(wearAfterDismantle(base)).toBe("nuevo");
  });

  it("un novato degrada la pieza cuando la tirada supera su 0.6", () => {
    expect(wearAfterDismantle(base, sequenceRandom([0.9]))).toBe("usado");
  });

  it("un novato la conserva cuando la tirada cae por debajo de su 0.6", () => {
    expect(wearAfterDismantle(base, sequenceRandom([0.3]))).toBe("nuevo");
  });

  it("un experto conserva donde un novato habría roto", () => {
    const roll = sequenceRandom([0.75]);
    expect(wearAfterDismantle({ ...base, tier: "novato" }, sequenceRandom([0.75]))).toBe("usado");
    expect(wearAfterDismantle({ ...base, tier: "experto" }, roll)).toBe("nuevo");
  });

  it("el Ingeniero suma su bonus de afinidad sobre el tier (GDD §6.6)", () => {
    // veterano 0.8 → 0.9 con el bonus: una tirada de 0.85 pasa de romper a conservar.
    expect(wearAfterDismantle({ ...base, tier: "veterano" }, sequenceRandom([0.85]))).toBe("usado");
    expect(
      wearAfterDismantle({ ...base, tier: "veterano", specialty: "ingeniero" }, sequenceRandom([0.85])),
    ).toBe("nuevo");
  });

  it("una pieza ya frágil (RE efectiva B) es más fácil de romper todavía más", () => {
    // veterano 0.8 → 0.65 con la penalización de RE baja.
    expect(wearAfterDismantle({ ...base, tier: "veterano" }, sequenceRandom([0.7]))).toBe("nuevo");
    expect(
      wearAfterDismantle({ ...base, tier: "veterano", effectiveResistance: "B" }, sequenceRandom([0.7])),
    ).toBe("usado");
  });

  it("acumula desde el desgaste que la pieza ya traía", () => {
    expect(wearAfterDismantle({ ...base, current: "usado" }, sequenceRandom([0.99]))).toBe("degradado");
  });

  it("no pasa de critico por mucho que se canibalice", () => {
    expect(wearAfterDismantle({ ...base, current: "critico" }, sequenceRandom([0.99]))).toBe("critico");
  });
});
