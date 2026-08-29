import { describe, expect, it } from "vitest";
import type { ComponentId } from "../components/physical-component.types.js";
import { buildComponentCatalog } from "../components/catalog/build-component-catalog.js";
import { componentPowerDraw } from "./component-power-draw.js";
import { POWER_DRAW_BY_COMPONENT } from "./power-parameters.js";

/**
 * Subfase 13g. Contra el CATÁLOGO REAL a propósito (patrón 13 de la memoria de
 * playtest): el bug que 13g viene a cerrar —`isInstancePowered` siempre `true`—
 * solo se manifestaba con las piezas de verdad, porque ninguna declaraba
 * consumo. Un test con definiciones sintéticas habría seguido en verde.
 */
describe("POWER_DRAW_BY_COMPONENT (Subfase 13g)", () => {
  const { registry } = buildComponentCatalog();
  const drawOf = (id: string) => componentPowerDraw(registry.get(id as ComponentId));

  it("no tiene entradas para ids que no existen en el catálogo", () => {
    // Un id mal escrito es un consumo que nunca se aplica y que nadie nota:
    // el patrón 7 ("un indicador que nunca se mueve está roto") en los DATOS.
    const unknown = Object.keys(POWER_DRAW_BY_COMPONENT).filter(
      (id) => registry.get(id as ComponentId) === undefined,
    );
    expect(unknown).toEqual([]);
  });

  it("el catálogo construido expone la demanda como dato de componente", () => {
    // La lectura ya no pasa por el tag `ACT`: la mesa no es actuador y consume.
    expect(registry.get("banco-de-trabajo" as ComponentId)?.data.powerDraw).toBe(3);
    expect(drawOf("banco-de-trabajo")).toBe(3);
    expect(drawOf("estacion-quimica")).toBe(3);
  });

  it("las piezas de pura señal declaran consumo, que es lo que gatea `outputOf`", () => {
    expect(drawOf("chip-circuito-generico")).toBe(1);
    expect(drawOf("fotorreceptor")).toBe(1);
    expect(drawOf("indicador-led")).toBe(1);
    expect(drawOf("sensor-movimiento-laser")).toBe(1);
  });

  it("la compuerta conserva el consumo que 13h le había escrito a mano en `ACT`", () => {
    expect(drawOf("compuerta-blindada")).toBe(2);
  });

  it("conductores y fuentes no consumen: conducen o aportan, no demandan", () => {
    expect(drawOf("cable-cobre")).toBe(0);
    expect(drawOf("cable-fibra-optica")).toBe(0);
    expect(drawOf("celula-fotovoltaica")).toBe(0);
    expect(drawOf("reactor-alto-amperaje")).toBe(0);
  });

  it("las piezas puramente estructurales tampoco consumen", () => {
    expect(drawOf("plancha-metalica")).toBe(0);
    expect(drawOf("junta-hermetica")).toBe(0);
    expect(drawOf("tubo-flexible")).toBe(0);
  });
});
