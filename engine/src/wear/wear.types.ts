/**
 * Desgaste por instancia (Subfase 13c, Gap ① de la comparativa con Duskers).
 * Eje ORTOGONAL a `ComponentCondition` (`blueprint/blueprint.types.ts`), que
 * modela si la pieza responde (`ok`/`jammed`/`destroyed`); esto modela cuánta
 * historia arrastra. Una pieza `usado` funciona igual de bien que una `nuevo`
 * — la decisión de diseño explícita fue **fragilidad, no eficiencia**: se
 * descartó el nerf funcional del "80%" literal de Duskers (`nuevo-orden.md`).
 *
 * Lo que sí cambia es cuánto aguanta:
 *  - baja la resistencia estructural efectiva (`effective-resistance.ts`),
 *  - baja la capacidad efectiva ante sobrecarga (`overload-capacity.ts`).
 *
 * Escala cualitativa de 4 niveles, coherente con GDD 5.2 ("bajo/medio/alto, no
 * numérica realista"). Nombres en español, como el resto del contenido de datos
 * del proyecto; la UI los traduce por clave (`component.wear.*`).
 */
export type ComponentWear = "nuevo" | "usado" | "degradado" | "critico";

/** De mejor a peor. El índice ES la cantidad de escalones de daño acumulados. */
export const WEAR_ORDER: ReadonlyArray<ComponentWear> = [
  "nuevo",
  "usado",
  "degradado",
  "critico",
];

export const DEFAULT_WEAR: ComponentWear = "nuevo";

export function isComponentWear(value: unknown): value is ComponentWear {
  return typeof value === "string" && WEAR_ORDER.includes(value as ComponentWear);
}

/** Escalones de daño acumulados: `nuevo` → 0 … `critico` → 3. */
export function wearSteps(wear: ComponentWear): number {
  return WEAR_ORDER.indexOf(wear);
}

/**
 * Baja un escalón. `critico` es el piso: no existe un quinto nivel, la pieza ya
 * está en la antesala del fallo estructural y no se "rompe más".
 *
 * Consecuencia permanente (principio 5 de CLAUDE.md): no hay función inversa a
 * propósito — nada en el motor mejora el desgaste de una pieza. Una tarea de
 * reparación sería contenido nuevo con su propio coste, no un undo gratuito.
 */
export function worsenWear(wear: ComponentWear): ComponentWear {
  return WEAR_ORDER[Math.min(wearSteps(wear) + 1, WEAR_ORDER.length - 1)]!;
}

/** El peor desgaste del conjunto (`undefined` si está vacío). */
export function worstWear(levels: ReadonlyArray<ComponentWear>): ComponentWear | undefined {
  let worst: ComponentWear | undefined;
  for (const level of levels) {
    if (worst === undefined || wearSteps(level) > wearSteps(worst)) {
      worst = level;
    }
  }
  return worst;
}
