import { describe, expect, it } from "vitest";
import {
  effectiveMatterState,
  isFrozenAt,
  nominalStateOf,
  phasePointsOf,
  phaseTransitionOf,
} from "./matter-state.js";
import { DEFAULT_PHASE_POINTS_BY_STATE } from "./phase-change-parameters.js";
import { buildChemicalCatalog } from "../catalog/build-chemical-catalog.js";
import { CRYOGENIC_SUBSTANCE_IDS, ELEMENT_CATALOG } from "../catalog/element-catalog.js";
import { COMPOUND_CATALOG } from "../catalog/compound-catalog.js";
import {
  NOMINAL_TEMPERATURE_CELSIUS,
  TEMPERATURE_CEILING_CELSIUS,
  TEMPERATURE_FLOOR_CELSIUS,
} from "../../atmosphere/thermal-parameters.js";
import type { ChemicalSubstanceDefinition, ChemicalSubstanceId } from "../chemical-substance.types.js";

/**
 * Subfase 14a-3. Dos niveles en el mismo archivo a propósito: el predicado puro
 * y la COHERENCIA DE LOS DATOS del catálogo real, que es donde vive la mitad de
 * los errores posibles de esta subfase (un punto mal autorado no rompe ningún
 * test de lógica, simplemente vuelve la mecánica inalcanzable o permanente).
 */

const REGISTRY = buildChemicalCatalog().registry;
const substance = (id: string): ChemicalSubstanceDefinition =>
  REGISTRY.get(id as ChemicalSubstanceId)!;

describe("effectiveMatterState", () => {
  const agua = () => substance("agua");

  it("deriva los tres estados del agua a partir de la temperatura de la sala", () => {
    expect(effectiveMatterState(agua(), -10)).toBe("S");
    expect(effectiveMatterState(agua(), 21)).toBe("L");
    expect(effectiveMatterState(agua(), 140)).toBe("G");
  });

  it("los bordes EXACTOS caen del lado ya transicionado, en los dos umbrales", () => {
    // Justo en el punto de fusión ya está fundida; justo en el de ebullición ya
    // hirvió. Es una convención arbitraria, pero tiene que ser única: sin
    // fijarla, un cambio futuro de `<` a `<=` pasa desapercibido.
    expect(effectiveMatterState(agua(), 0)).toBe("L");
    expect(effectiveMatterState(agua(), -0.001)).toBe("S");
    expect(effectiveMatterState(agua(), 100)).toBe("G");
    expect(effectiveMatterState(agua(), 99.999)).toBe("L");
  });

  it("una sustancia sintetizada en runtime (sin puntos) NO cambia de estado en ninguna temperatura alcanzable", () => {
    // El residuo de una combustión no sale de ningún catálogo: nadie autoró qué
    // significaría fundirlo, así que el perfil por estado tiene que dejarlo
    // quieto en TODA la ventana del motor, no solo a temperatura ambiente.
    const residuo: ChemicalSubstanceDefinition = {
      id: "reaction:combustion-residue" as ChemicalSubstanceId,
      name: "Residuo de combustión",
      level: "atomic",
      data: { tags: [{ name: "INERTE" }], state: "G" },
    };
    expect(phasePointsOf(residuo)).toEqual(DEFAULT_PHASE_POINTS_BY_STATE.G);
    expect(effectiveMatterState(residuo, TEMPERATURE_FLOOR_CELSIUS)).toBe("G");
    expect(effectiveMatterState(residuo, TEMPERATURE_CEILING_CELSIUS)).toBe("G");
  });

  it("sin `state` declarado cae al perfil líquido, que tampoco transiciona", () => {
    const anonima: ChemicalSubstanceDefinition = {
      id: "mezcla" as ChemicalSubstanceId,
      name: "Mezcla sin identificar",
      level: "atomic",
      data: { tags: [{ name: "INERTE" }] },
    };
    expect(nominalStateOf(anonima)).toBe("L");
    expect(effectiveMatterState(anonima, TEMPERATURE_FLOOR_CELSIUS)).toBe("L");
    expect(effectiveMatterState(anonima, TEMPERATURE_CEILING_CELSIUS)).toBe("L");
  });

  it("`isFrozenAt` es el mismo predicado, no una segunda fórmula", () => {
    expect(isFrozenAt(agua(), -1)).toBe(true);
    expect(isFrozenAt(agua(), 1)).toBe(false);
  });
});

describe("phaseTransitionOf", () => {
  it("nombra la transición desde el estado nominal", () => {
    expect(phaseTransitionOf("L", "S")).toBe("freeze");
    expect(phaseTransitionOf("L", "G")).toBe("boil");
    expect(phaseTransitionOf("S", "L")).toBe("melt");
    expect(phaseTransitionOf("G", "L")).toBe("condense");
    expect(phaseTransitionOf("L", "L")).toBeUndefined();
  });

  it("la sublimación se reporta por su DESTINO, que es lo que consume el motor", () => {
    // S→G y G→S no tienen nombre propio: aguas abajo lo que importa es "ahora
    // está en el aire" o "ahora está sólido".
    expect(phaseTransitionOf("S", "G")).toBe("boil");
    expect(phaseTransitionOf("G", "S")).toBe("freeze");
  });
});

describe("datos del catálogo químico real", () => {
  const entries = [...ELEMENT_CATALOG, ...COMPOUND_CATALOG];

  it("las 49 entradas declaran sus dos puntos y el de fusión es menor que el de ebullición", () => {
    expect(entries.length).toBe(49);
    for (const entry of entries) {
      expect(
        entry.data.meltingPointCelsius,
        `${entry.id} sin punto de fusión`,
      ).toBeTypeOf("number");
      expect(
        entry.data.boilingPointCelsius,
        `${entry.id} sin punto de ebullición`,
      ).toBeTypeOf("number");
      expect(
        entry.data.meltingPointCelsius,
        `${entry.id}: funde por encima de donde hierve`,
      ).toBeLessThan(entry.data.boilingPointCelsius);
    }
  });

  it("el estado derivado a temperatura nominal coincide con el declarado, salvo los criogénicos", () => {
    // El `state` de catálogo describe a la sustancia DENTRO de un contenedor
    // sellado. Que además coincida con el estado derivado a 21 °C es lo que
    // impide que un punto mal autorado deje media nave llena de gases que el
    // diseño creía líquidos. Las excepciones son deliberadas y están nombradas.
    for (const entry of entries) {
      const derived = effectiveMatterState(substance(entry.id), NOMINAL_TEMPERATURE_CELSIUS);
      if (CRYOGENIC_SUBSTANCE_IDS.has(entry.id)) {
        expect(derived, `${entry.id} debería diferir de su estado almacenado`).not.toBe(
          entry.data.state,
        );
        continue;
      }
      expect(derived, `${entry.id} declara ${entry.data.state} y a 21 °C es ${derived}`).toBe(
        entry.data.state,
      );
    }
  });

  it("las sustancias que sostienen la mecánica tienen su transición DENTRO de la ventana alcanzable", () => {
    // Ventana real del motor: el enfriador se estabiliza en -69 °C y una
    // combustión violenta pica en ~161. Un punto fuera de ahí es un escritor
    // muerto, y este test es lo que impide que el balanceo lo saque sin querer.
    const REACHABLE_COLD = -69;
    const REACHABLE_HOT = 161;
    const casos: ReadonlyArray<[string, "melting" | "boiling"]> = [
      ["agua", "melting"],
      ["agua", "boiling"],
      ["combustible-de-motor", "melting"],
      ["combustible-de-motor", "boiling"],
      ["disolvente-volatil", "boiling"],
      ["bromo", "melting"],
      ["bromo", "boiling"],
    ];
    for (const [id, punto] of casos) {
      const points = phasePointsOf(substance(id));
      const value =
        punto === "melting" ? points.meltingPointCelsius : points.boilingPointCelsius;
      expect(value, `${id}.${punto} fuera de la ventana jugable`).toBeGreaterThanOrEqual(
        REACHABLE_COLD,
      );
      expect(value, `${id}.${punto} fuera de la ventana jugable`).toBeLessThanOrEqual(
        REACHABLE_HOT,
      );
    }
  });

  it("el nitrógeno líquido derramado en una sala normal ES un gas", () => {
    // Es la línea 166 del GDD ("cambia de estado fácilmente, se evapora a gas")
    // y la razón de que verter un criogénico enfríe Y desplace oxígeno.
    const nitrogeno = substance("nitrogeno-liquido");
    expect(nominalStateOf(nitrogeno)).toBe("L");
    expect(effectiveMatterState(nitrogeno, NOMINAL_TEMPERATURE_CELSIUS)).toBe("G");
    // Y vuelve a ser líquido en una sala ya helada por el propio enfriador.
    expect(effectiveMatterState(nitrogeno, -69)).toBe("L");
  });
});
