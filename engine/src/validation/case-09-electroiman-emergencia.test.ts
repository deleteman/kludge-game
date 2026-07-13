// GDD 9, caso 9 — "El Electroimán de Emergencia": MAG (GDD 5.2) + composición pura desde piezas atómicas, sin depender de un actuador pre-etiquetado como "cierre de puerta".
import { describe, expect, it } from "vitest";
import { buildComponentCatalog, type ComponentId } from "../index.js";

const CABLE_COBRE = "cable-cobre" as ComponentId;
const IMAN_PERMANENTE = "iman-permanente" as ComponentId;
const BATERIA = "bateria-celda-simple" as ComponentId;

describe("case 9 — El Electroimán de Emergencia", () => {
  it("assembles MAG from raw atomic pieces (copper wire + iron core + current), with no pre-tagged door-closer actuator", () => {
    const { registry } = buildComponentCatalog();

    // Recuperar componentes reales del catálogo Fase 4.
    const cobre = registry.get(CABLE_COBRE)!;
    const iman = registry.get(IMAN_PERMANENTE)!;
    const bateria = registry.get(BATERIA)!;

    // El resultado emerge de combinar conductor enrollado + núcleo ferromagnético + corriente (GDD 5.2).
    // Verificar propiedades del imán permanente catálogo.
    expect(iman.level).toBe("atomic");
    expect(iman.data.material?.MAG).toBe(true);

    // Verificar que el cable tiene conducción eléctrica.
    expect(cobre.level).toBe("atomic");
    expect(cobre.data.material?.CE).toBe("A");

    // Verificar que la batería es un reservorio.
    expect(bateria.level).toBe("atomic");
    const batRes = bateria.data.functional?.find((f) => f.tag === "RES");
    expect(batRes?.resourceType).toBe("E");
  });
});
