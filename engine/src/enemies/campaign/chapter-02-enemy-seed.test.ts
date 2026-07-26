import { describe, expect, it } from "vitest";
import { ENEMY_SEED_BY_CHAPTER_ID } from "./chapter-02-enemy-seed.js";
import { CHAPTER_02_BY_ARCHETYPE } from "../../crisis/campaign/chapter-02-ecos-en-el-pasillo.js";

describe("capítulo 2 — contenido de enemigo (Fase 11d.4)", () => {
  it("siembra un único intruso para el arquetipo exploración, con arma no letal (severidad < high)", () => {
    const seed = ENEMY_SEED_BY_CHAPTER_ID.get(CHAPTER_02_BY_ARCHETYPE.exploracion.id);
    expect(seed).toBeDefined();
    expect(seed?.enemies).toHaveLength(1);
    const enemy = seed!.enemies[0]!;
    expect(enemy.archetype).toBe("agile");
    // Decisión explícita del operador (Fase 11d.4): el capítulo 2 es no letal
    // (su propio hazard/consecuencia declaran `lethal: false`), así que el
    // enemigo no debe portar un arma de severidad "high" (letal por sí sola,
    // ver `weapon-damage.test.ts::torreta-automatizada → "high"`).
    expect(enemy.weaponComponentId).toBe("garra-de-abordaje");
  });

  it("otros capítulos (ej. capítulo 1) no tienen contenido de enemigo todavía", () => {
    expect(ENEMY_SEED_BY_CHAPTER_ID.size).toBe(1);
  });

  it("la ruta del intruso tiene waypoints con arrivalSeconds estrictamente creciente y termina sosteniendo posición", () => {
    const seed = ENEMY_SEED_BY_CHAPTER_ID.get(CHAPTER_02_BY_ARCHETYPE.exploracion.id)!;
    const enemy = seed.enemies[0]!;
    const route = seed.routes.get(enemy.id);
    expect(route).toBeDefined();
    expect(route?.onComplete).toBe("hold");
    const arrivals = route!.waypoints.map((wp) => wp.arrivalSeconds);
    expect(arrivals).toEqual([...arrivals].sort((a, b) => a - b));
    expect(new Set(arrivals).size).toBe(arrivals.length);
    // Primer waypoint = celda de spawn del `EnemyActor` (convención de `route-progression.ts`).
    expect(route!.waypoints[0]!.cell).toEqual(enemy.cell);
  });
});
