/**
 * Fuente de azar INYECTADA — el primer y único azar de `/engine` (Subfase 13c).
 *
 * Hasta esta fase el motor era 100% determinista: cero `Math.random` en todo
 * `/engine`, con la regla escrita explícitamente en su código
 * (`enemies/route-progression.ts`: "misma entrada → misma salida, sin
 * `Math.random`, sin reloj real"). Ese determinismo es lo que hace que los 16
 * casos de validación del GDD §9 sean reproducibles, y no se abandona acá.
 *
 * Lo que 13c necesita es la probabilidad de dañar una pieza al canibalizarla
 * según el tier del especialista (GDD §6.5). Se resuelve por INYECCIÓN, mismo
 * patrón de DI que ya usan `EmitterInputSource` (`mission-signal-runtime.ts`) y
 * `SectionPressureSinkSource` (`mission-atmosphere-runtime.ts`): el motor
 * declara qué necesita, el llamador decide. Los tests inyectan una secuencia
 * fija y siguen siendo deterministas; solo `/game` inyecta azar real.
 *
 * Restricción deliberada: este azar vive FUERA del bucle de simulación (solo se
 * consulta al resolver una tarea de desmontaje). La sobrecarga por desgaste se
 * modeló como capacidad reducida (`wear/overload-capacity.ts`) justamente para
 * no meter dados en el tick.
 */
export type RandomSource = () => number;

/**
 * Secuencia fija para tests: devuelve los valores en orden y luego cicla. Evita
 * tener que mockear `Math.random` global (que filtraría entre tests).
 */
export function sequenceRandom(values: ReadonlyArray<number>): RandomSource {
  if (values.length === 0) {
    throw new Error("sequenceRandom requires at least one value");
  }
  let index = 0;
  return () => {
    const value = values[index % values.length]!;
    index += 1;
    return value;
  };
}

/** Azar real. Único punto del motor autorizado a llamar `Math.random`, y solo si el llamador lo elige. */
export const systemRandom: RandomSource = () => Math.random();
