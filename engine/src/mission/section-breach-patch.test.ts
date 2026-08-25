import { describe, expect, it } from "vitest";
import { buildComponentCatalog } from "../components/catalog/build-component-catalog.js";
import type { ComponentId } from "../components/physical-component.types.js";
import { isBreachPatch } from "./section-breach-pressure-sink.js";

/**
 * Qué sirve de parche, contra el CATÁLOGO REAL y no contra definiciones
 * sintéticas (patrón 13: un doble que implementa la semántica bajo prueba
 * esconde el bug).
 *
 * Fija la decisión que el operador tomó en la ronda 1 de playtest de 13f tras
 * reportar que "sellar con una junta hermética parece no funcionar": el
 * requisito se MANTIENE —una junta de goma no tapa un agujero al vacío— y lo
 * que cambia es que el juego lo diga. Si alguien afloja el criterio, este test
 * lo obliga a hacerlo explícitamente.
 */
describe("isBreachPatch contra el catálogo real (13f, ronda 1)", () => {
  const { registry } = buildComponentCatalog();
  const patchable = (id: string) => isBreachPatch(registry.get(id as ComponentId), "nuevo");

  it("la plancha metálica SÍ sella: es estructura (EST) con RE media", () => {
    expect(patchable("plancha-metalica")).toBe(true);
  });

  it("la junta hermética NO sella: sella un empalme, no es estructura de casco", () => {
    expect(patchable("junta-hermetica")).toBe(false);
  });

  it("una manguera tampoco: ni estructura ni resistencia", () => {
    expect(patchable("tubo-flexible")).toBe(false);
  });

  it("una estructura demasiado endeble tampoco sirve, aunque tenga EST", () => {
    // Tornillería: `EST` pero RE-B, por debajo del mínimo. Es la parte del
    // criterio que hace que "cualquier cosa con EST" no sea la respuesta.
    expect(patchable("tornilleria-fijacion")).toBe(false);
  });

  it("una plancha lo bastante desgastada deja de servir", () => {
    const plate = registry.get("plancha-metalica" as ComponentId);
    expect(isBreachPatch(plate, "nuevo")).toBe(true);
    expect(isBreachPatch(plate, "critico")).toBe(false);
  });
});
