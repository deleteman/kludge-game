/**
 * Nivel de corriente por bobina activa (extensión GDD 5.2/5.6,
 * docs/Extension_aceleracion_magnetica.md §1). El motor no modela corriente
 * numérica en ningún otro lado (solo capacidad/carga de un conductor o
 * caudal de un reservorio) — se declara explícitamente en la bobina activa,
 * no se deriva de esos campos. Misma familia cualitativa que CE/CT/RE
 * (GDD 7.0), decisión tomada con el operador para mantener la escala simple
 * en vez de introducir física numérica real (CLAUDE.md, principio 3).
 */
export type CurrentLevel = "B" | "M" | "A";
