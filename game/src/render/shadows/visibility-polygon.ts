/**
 * Polígono de visibilidad 2D por luz puntual (Fase 12d — sombras dinámicas con
 * oclusión real). Módulo de geometría PURA: no importa Phaser ni ningún estado
 * de escena, solo matemática de rayos contra segmentos — por eso es
 * unit-testeable sin harness de render (ver `visibility-polygon.test.ts`).
 *
 * Dada una luz, un radio y un conjunto de segmentos oclusores, calcula el
 * polígono de la región ILUMINADA: se lanzan rayos hacia cada vértice oclusor
 * (con un ε a cada lado para "asomarse" por las esquinas) más una rejilla de
 * rayos a ángulos fijos (para aproximar el arco del círculo donde no hay
 * oclusores). Cada rayo se corta contra el oclusor más cercano y se limita al
 * radio. Ordenados por ángulo forman un abanico de triángulos desde la luz.
 * Detrás de un oclusor el abanico no llega → esa zona queda fuera del polígono
 * = sombra arrojada con oclusión real.
 */

export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

/** Segmento oclusor: la luz no atraviesa la recta entre `a` y `b`. */
export interface Segment {
  readonly a: Vec2;
  readonly b: Vec2;
}

export interface VisibilityPolygonInput {
  readonly light: Vec2;
  readonly radius: number;
  readonly edges: readonly Segment[];
  /**
   * Rayos adicionales repartidos uniformemente alrededor de la luz para
   * aproximar el borde circular donde no hay ningún vértice oclusor cerca.
   * Más pasos = círculo más liso, más costo. Default 48 (~7.5° por paso).
   */
  readonly angularSteps?: number;
}

const EPSILON_ANGLE = 0.0001;

/**
 * Intersección de un rayo `origin + t·dir` (t ≥ 0, `dir` unitario, así t = la
 * distancia) con el segmento `a→b`. Devuelve la distancia `t` del impacto o
 * `null` si el rayo no cruza el segmento hacia adelante.
 */
export function raySegmentIntersection(origin: Vec2, dir: Vec2, a: Vec2, b: Vec2): number | null {
  const sx = b.x - a.x;
  const sy = b.y - a.y;
  const denom = dir.x * sy - dir.y * sx;
  if (Math.abs(denom) < 1e-9) return null; // paralelos (o colineales): sin cruce puntual

  const dx = a.x - origin.x;
  const dy = a.y - origin.y;
  const t = (dx * sy - dy * sx) / denom; // distancia sobre el rayo (dir unitario)
  const s = (dx * dir.y - dy * dir.x) / denom; // parámetro sobre el segmento [0,1]

  if (t < 0) return null;
  if (s < 0 || s > 1) return null;
  return t;
}

/**
 * Lanza un rayo desde `light` a `angle` y devuelve el punto de impacto contra
 * el oclusor más cercano, recortado al `radius` (si nada se interpone antes del
 * radio, el punto cae sobre el círculo de la luz).
 */
export function castRay(light: Vec2, angle: number, edges: readonly Segment[], radius: number): Vec2 {
  const dir = { x: Math.cos(angle), y: Math.sin(angle) };
  let nearest = radius;
  for (const edge of edges) {
    const t = raySegmentIntersection(light, dir, edge.a, edge.b);
    if (t !== null && t < nearest) nearest = t;
  }
  return { x: light.x + dir.x * nearest, y: light.y + dir.y * nearest };
}

/**
 * Calcula el polígono iluminado (lista de puntos en orden angular alrededor de
 * la luz). El llamador de render lo pinta como abanico de triángulos desde
 * `light`, con un relleno radial que desvanece a 0 en `radius`.
 */
export function computeVisibilityPolygon(input: VisibilityPolygonInput): Vec2[] {
  const { light, radius, edges } = input;
  const angularSteps = input.angularSteps ?? 48;

  const angles: number[] = [];

  // Rayos hacia cada vértice oclusor, con un ε a cada lado para rodear la
  // esquina y capturar tanto lo que queda delante como lo que asoma detrás.
  for (const edge of edges) {
    for (const vertex of [edge.a, edge.b]) {
      const base = Math.atan2(vertex.y - light.y, vertex.x - light.x);
      angles.push(base - EPSILON_ANGLE, base, base + EPSILON_ANGLE);
    }
  }

  // Rejilla uniforme para el arco del círculo donde no hay oclusores cerca.
  for (let i = 0; i < angularSteps; i += 1) {
    angles.push((i / angularSteps) * Math.PI * 2);
  }

  const points = angles
    .map((angle) => ({ angle, point: castRay(light, angle, edges, radius) }))
    .sort((p, q) => p.angle - q.angle)
    .map((p) => p.point);

  return points;
}
