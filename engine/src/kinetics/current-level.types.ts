/**
 * Nivel de corriente por bobina activa (extensión GDD 5.2/5.6,
 * docs/Extension_aceleracion_magnetica.md §1). Misma familia cualitativa que
 * CE/CT/RE (GDD 7.0): escala simple en vez de física numérica real (CLAUDE.md,
 * principio 3).
 *
 * REVISADO en Fase 11a (decisión del operador, 2026-07-17). Antes este
 * comentario decía que la corriente "se declara explícitamente en la bobina
 * activa, no se deriva" — pero nunca existió un campo donde declararla, y
 * fijarla por pieza en el catálogo habría impedido que el jugador la variara
 * conectando una fuente distinta, que es la palanca central del caso 17. Hoy
 * se DERIVA del reservorio eléctrico más fuerte aguas arriba de la bobina en
 * el grafo (`mission/mission-projectile-world.ts`, con sus umbrales
 * documentados). Este tipo sigue siendo solo la escala.
 */
export type CurrentLevel = "B" | "M" | "A";
