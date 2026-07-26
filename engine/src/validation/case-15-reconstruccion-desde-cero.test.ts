// GDD 9, caso 15 — "Reconstrucción desde Cero": ruta atómica completa (GDD 7.1) — piezas salvadas de 2-3 compuestos desmontados se combinan en un compuesto nuevo que la nave nunca tuvo preinstalado, en contraste con el caso 1 (que reutiliza compuestos intactos).
import { describe, expect, it } from "vitest";
import {
  atomicRecoveryFraction,
  createPhysicalComponentFactory,
  durationMultiplierFor,
  isCompositeEntity,
  MapEntityRegistry,
  type ComponentId,
  type PhysicalComponentDefinition,
} from "../index.js";

const MOTOR_ATOMICO = "motor-atomico" as ComponentId;
const ENGRANAJE_ATOMICO = "engranaje-atomico" as ComponentId;
const LENTE_ATOMICA = "lente-atomica" as ComponentId;
const FOTOCELDA_ATOMICA = "fotocelda-atomica" as ComponentId;
const SERVO_VIEJO = "servo-viejo" as ComponentId;
const SENSOR_VIEJO = "sensor-viejo" as ComponentId;
const ACTUADOR_PRECISION = "actuador-precision" as ComponentId;

describe("case 15 — Reconstrucción desde Cero", () => {
  it("combines atomic pieces salvaged from 2 disassembled composites into a composite the ship never had preinstalled", () => {
    const registry = new MapEntityRegistry<ComponentId, PhysicalComponentDefinition>();
    const factory = createPhysicalComponentFactory(registry);

    // Piezas atómicas (Nivel 0), las mismas que forman los compuestos viejos.
    const motor = factory.buildAtomic({
      id: MOTOR_ATOMICO,
      name: "Motor atómico",
      data: {
        footprint: { width: 1, height: 1 },
        functional: [{ tag: "ACT", power: 5, cadence: 2, directional: false }],
      },
    });
    registry.register(motor.id, motor);
    const engranaje = factory.buildAtomic({
      id: ENGRANAJE_ATOMICO,
      name: "Engranaje atómico",
      data: { footprint: { width: 1, height: 1 }, material: { RE: "M" } },
    });
    registry.register(engranaje.id, engranaje);
    const lente = factory.buildAtomic({
      id: LENTE_ATOMICA,
      name: "Lente atómica",
      data: {
        footprint: { width: 1, height: 1 },
        functional: [{ tag: "EM", range: 8, triggerType: "optical", frequency: 4 }],
      },
    });
    registry.register(lente.id, lente);
    const fotocelda = factory.buildAtomic({
      id: FOTOCELDA_ATOMICA,
      name: "Fotocelda atómica",
      data: { footprint: { width: 1, height: 1 }, material: { CE: "B" } },
    });
    registry.register(fotocelda.id, fotocelda);

    // Dos compuestos viejos, preinstalados en la nave, ninguno sirve intacto
    // para el problema actual (a diferencia del caso 1).
    const servoViejo = factory.buildComposite({
      id: SERVO_VIEJO,
      name: "Servo viejo",
      data: {},
      recipe: {
        ingredients: [
          { ref: MOTOR_ATOMICO, quantity: 1 },
          { ref: ENGRANAJE_ATOMICO, quantity: 2 },
        ],
      },
    });
    registry.register(servoViejo.id, servoViejo);
    const sensorViejo = factory.buildComposite({
      id: SENSOR_VIEJO,
      name: "Sensor viejo",
      data: {},
      recipe: {
        ingredients: [
          { ref: LENTE_ATOMICA, quantity: 1 },
          { ref: FOTOCELDA_ATOMICA, quantity: 1 },
        ],
      },
    });
    registry.register(sensorViejo.id, sensorViejo);

    // El jugador los desmonta (las piezas atómicas quedan disponibles, ya
    // registradas arriba) y construye en la mesa de creación un actuador de
    // precisión que NINGÚN compuesto de la nave define — no es "servo viejo"
    // ni "sensor viejo" reconfigurado, es una receta nueva desde piezas de
    // ambos.
    const actuadorPrecision = factory.buildComposite({
      id: ACTUADOR_PRECISION,
      name: "Actuador de precisión",
      data: {
        functional: [...(motor.data.functional ?? []), ...(lente.data.functional ?? [])],
      },
      recipe: {
        ingredients: [
          { ref: MOTOR_ATOMICO, quantity: 1 },
          { ref: LENTE_ATOMICA, quantity: 1 },
          { ref: FOTOCELDA_ATOMICA, quantity: 1 },
        ],
      },
    });
    registry.register(actuadorPrecision.id, actuadorPrecision);

    expect(isCompositeEntity(actuadorPrecision)).toBe(true);
    expect(actuadorPrecision.id).not.toBe(SERVO_VIEJO);
    expect(actuadorPrecision.id).not.toBe(SENSOR_VIEJO);
    const resolved = factory.resolveIngredients(actuadorPrecision.recipe);
    expect(resolved.map((r) => r.entity.id).sort()).toEqual(
      [MOTOR_ATOMICO, LENTE_ATOMICA, FOTOCELDA_ATOMICA].sort(),
    );
    // Ninguna de las piezas usadas vino de un único compuesto viejo: se
    // salvaron de los dos desmontajes distintos (motor del servo, lente+
    // fotocelda del sensor) — la ruta atómica completa, no un atajo.
    const motorRefs = servoViejo.recipe.ingredients.map((i) => i.ref);
    const sensorRefs = sensorViejo.recipe.ingredients.map((i) => i.ref);
    expect(motorRefs).toContain(MOTOR_ATOMICO);
    expect(sensorRefs).toEqual(expect.arrayContaining([LENTE_ATOMICA, FOTOCELDA_ATOMICA]));
  });

  it("el coste de tiempo y la pérdida de material al desmontar escalan según el tier del Ingeniero (GDD 6.5)", () => {
    // Un Ingeniero Experto desmonta más rápido (×0.6, GDD 6.6) y recupera casi
    // todo (~92.5%, GDD 6.5 + bonus +10%) que un Novato de otra especialidad
    // (×1.2 de penalización fuera de afinidad, sin el bonus del +10%).
    const expertEngineerDuration = durationMultiplierFor("dismantle", "ingeniero", "experto");
    const noviceMedicDuration = durationMultiplierFor("dismantle", "medico", "novato");
    expect(expertEngineerDuration).toBeLessThan(noviceMedicDuration);

    const expertEngineerRecovery = atomicRecoveryFraction("experto", "ingeniero");
    const noviceMedicRecovery = atomicRecoveryFraction("novato", "medico");
    expect(expertEngineerRecovery).toBeGreaterThan(noviceMedicRecovery);
    expect(expertEngineerRecovery).toBeCloseTo(1); // 0.925 base + 0.1 bonus, clamped a 1
    expect(noviceMedicRecovery).toBeCloseTo(0.6);

    // Un compuesto de baja resistencia estructural (RE=B) pierde piezas
    // frágiles sin importar el tier del especialista (GDD 6.5).
    const lowResistanceRecovery = atomicRecoveryFraction("experto", "ingeniero", "B");
    expect(lowResistanceRecovery).toBeLessThan(expertEngineerRecovery);
  });
});
