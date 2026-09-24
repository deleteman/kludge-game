import { describe, expect, it } from "vitest";
import { compareReading } from "./comparator.js";
import { configurableSensorKindOf } from "./configurable-of.js";
import { instanceConfigOf, sensorThresholdOf, withInstanceConfig, withoutInstanceConfig } from "./instance-config-store.js";
import type { InstanceConfigEntry } from "./instance-config.types.js";
import {
  SENSOR_THRESHOLD_SPECS,
  defaultSensorThreshold,
  isValidSensorThreshold,
  sensorFires,
} from "./sensor-thresholds.js";
import { buildComponentCatalog } from "../components/catalog/build-component-catalog.js";
import type { ComponentId } from "../components/physical-component.types.js";
import type { PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";

const REGISTRY = buildComponentCatalog().registry;
const A = "a" as PlacedComponentInstanceId;
const B = "b" as PlacedComponentInstanceId;

describe("instance-config: comparador", () => {
  it("< y > son estrictos; <= y >= incluyen el borde", () => {
    expect(compareReading(5, "<", 5, 0)).toBe(false);
    expect(compareReading(5, ">", 5, 0)).toBe(false);
    expect(compareReading(5, "<=", 5, 0)).toBe(true);
    expect(compareReading(5, ">=", 5, 0)).toBe(true);
  });

  it("= significa 'dentro de la tolerancia' porque una magnitud continua nunca vale justo el umbral", () => {
    expect(compareReading(60.3, "=", 60, 0.5)).toBe(true);
    expect(compareReading(61, "=", 60, 0.5)).toBe(false);
    expect(compareReading(59.7, ">=", 60, 0.5)).toBe(true);
  });
});

describe("instance-config: valores de fábrica = comportamiento previo a 14b-3", () => {
  it("presión dispara por debajo de 101 kPa; temperatura y química, por encima de 60 °C y 0.05", () => {
    expect(sensorFires("pressure", 100.9, defaultSensorThreshold("pressure"))).toBe(true);
    expect(sensorFires("pressure", 101, defaultSensorThreshold("pressure"))).toBe(false);
    expect(sensorFires("thermal", 60, defaultSensorThreshold("thermal"))).toBe(false);
    expect(sensorFires("thermal", 60.1, defaultSensorThreshold("thermal"))).toBe(true);
    expect(sensorFires("chemical", 0.05, defaultSensorThreshold("chemical"))).toBe(false);
    expect(sensorFires("chemical", 0.06, defaultSensorThreshold("chemical"))).toBe(true);
  });

  it("sin lectura no hay alarma, con cualquier comparador", () => {
    expect(sensorFires("pressure", undefined, defaultSensorThreshold("pressure"))).toBe(false);
    expect(sensorFires("thermal", undefined, { kind: "sensor-threshold", comparator: "<", value: 1000 })).toBe(false);
  });

  it("valida el rango del umbral por tipo de sensor", () => {
    const at = (value: number) => ({ kind: "sensor-threshold", comparator: ">", value }) as const;
    expect(isValidSensorThreshold("chemical", at(0.5))).toBe(true);
    expect(isValidSensorThreshold("chemical", at(5))).toBe(false);
    expect(isValidSensorThreshold("pressure", at(Number.NaN))).toBe(false);
    expect(isValidSensorThreshold("thermal", at(SENSOR_THRESHOLD_SPECS.thermal.min - 1))).toBe(false);
  });
});

describe("instance-config: mapa disperso", () => {
  const cfg = (value: number): InstanceConfigEntry["config"] => ({ kind: "sensor-threshold", comparator: ">", value });

  it("una instancia sin entrada usa el valor de fábrica; con entrada, el suyo", () => {
    const configs = withInstanceConfig([], A, cfg(80));
    expect(sensorThresholdOf(configs, A, "thermal").value).toBe(80);
    expect(sensorThresholdOf(configs, B, "thermal")).toEqual(defaultSensorThreshold("thermal"));
    expect(instanceConfigOf(configs, B)).toBeUndefined();
  });

  it("fijar dos veces reemplaza, no duplica; quitar vuelve al valor de fábrica", () => {
    const configs = withInstanceConfig(withInstanceConfig([], A, cfg(80)), A, cfg(90));
    expect(configs).toHaveLength(1);
    expect(withoutInstanceConfig(configs, A)).toEqual([]);
    expect(withoutInstanceConfig(configs, B)).toBe(configs);
  });
});

describe("instance-config: qué es configurable se deriva de las propiedades", () => {
  it("las piezas con un EM simulado ganan umbral, compuestas incluidas; el resto no", () => {
    expect(configurableSensorKindOf("sensor-presion-gas" as ComponentId, REGISTRY)).toBe("pressure");
    expect(configurableSensorKindOf("sensor-termico-precision" as ComponentId, REGISTRY)).toBe("thermal");
    expect(configurableSensorKindOf("escaner-espectro" as ComponentId, REGISTRY)).toBe("chemical");
    expect(configurableSensorKindOf("indicador-led" as ComponentId, REGISTRY)).toBeUndefined();
    expect(configurableSensorKindOf("no-existe" as ComponentId, REGISTRY)).toBeUndefined();
  });
});
