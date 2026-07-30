import type Phaser from "phaser";

import { buildStaticOccluderEdges, type OccluderGrid } from "./occluder-edges.js";
import { computeVisibilityPolygon, type Segment } from "./visibility-polygon.js";

/**
 * Capa de sombras dinámicas con oclusión real (Fase 12d). Glue de Phaser sobre
 * la geometría pura (`visibility-polygon.ts` + `occluder-edges.ts`): mantiene
 * una `RenderTexture` del tamaño del mundo, rellena de oscuridad, y por cada luz
 * activa BORRA (blend ERASE) su polígono de visibilidad — donde una luz alcanza,
 * la oscuridad se despeja; detrás de un oclusor el polígono no llega y la
 * oscuridad queda = sombra arrojada.
 *
 * La RT vive a un depth apenas por encima del piso/decals y por DEBAJO de los
 * componentes/paredes/tripulación, así que la sombra se lee "sobre el suelo" y
 * los sprites que la proyectan quedan por encima, a brillo pleno (criterio
 * clásico de sombra top-down: se oscurece el suelo, no el objeto).
 *
 * 12d.1 = pipeline mínimo: solo paredes estáticas como oclusores + las
 * PointLight de 12a. 12d.2 sumó casters móviles. La iteración post-playtest
 * quitó la ambiental global (lavaba el contraste) — ahora la oscuridad es el
 * default y la iluminan luces reales (focales autoradas + dinámicas).
 */

/** Color de la oscuridad de sombra: casi negro con leve tinte frío. */
export const DYNAMIC_SHADOW_COLOR = 0x05060a;

/**
 * Alpha de la oscuridad PLENA: la sombra donde ninguna luz llega. Las luces
 * (focales autoradas + dinámicas) la despejan en sus focos según su intensidad;
 * detrás de un oclusor queda a este valor = sombra nítida. La diferencia entre
 * este valor y lo que despeja una luz es el contraste de la sombra.
 */
export const DYNAMIC_SHADOW_DARKNESS_ALPHA = 0.5;

export interface DynamicShadowOptions {
  /** Color de la oscuridad (típicamente casi negro, o azul muy oscuro). */
  readonly darknessColor: number;
  /** Alpha de la oscuridad plena donde ninguna luz llega (0 = sin sombra, 1 = negro). */
  readonly darknessAlpha: number;
  /** Depth de la RT — entre el piso y los objetos colocados. */
  readonly depth: number;
  /** Rayos por luz para aproximar el arco circular (ver `computeVisibilityPolygon`). */
  readonly angularSteps?: number;
}

/** Polígono de visibilidad cacheado de una luz mientras no se muevan ella ni los oclusores. */
interface CachedVisibility {
  x: number;
  y: number;
  radius: number;
  occludersVersion: number;
  polygon: ReturnType<typeof computeVisibilityPolygon>;
}

export class DynamicShadowLayer {
  private readonly rt: Phaser.GameObjects.RenderTexture;
  /** Graphics scratch reusado para pintar cada polígono antes de borrarlo de la RT. */
  private readonly scratch: Phaser.GameObjects.Graphics;
  private staticEdges: Segment[] = [];
  private dynamicEdges: Segment[] = [];
  private readonly lights = new Set<Phaser.GameObjects.PointLight>();
  /** Intensidad global (0..1, slider de accesibilidad 12d.4): escala el alpha de oscuridad. */
  private intensity = 1;
  /**
   * Versión de los oclusores: se incrementa cuando cambian los estáticos o los
   * dinámicos. Sirve para invalidar el cache de polígonos de visibilidad — sin
   * cambios de oclusor ni de posición de luz, el polígono se reusa entre frames
   * (el parpadeo de una luz cambia su `clearAlpha`, no su forma). Es la
   * optimización clave de 12d.4: en reposo el `redraw` es solo re-erase (barato).
   */
  private occludersVersion = 0;
  private readonly visibilityCache = new Map<Phaser.GameObjects.PointLight, CachedVisibility>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly worldWidth: number,
    private readonly worldHeight: number,
    private readonly options: DynamicShadowOptions,
  ) {
    this.rt = scene.add.renderTexture(0, 0, worldWidth, worldHeight).setOrigin(0, 0).setDepth(options.depth);
    // El scratch nunca se agrega al display list (no debe renderizarse solo);
    // se usa únicamente como fuente de `rt.erase`.
    this.scratch = scene.make.graphics({});
  }

  /** La RT que el llamador debe marcar como objeto de mundo (que la ignore la hudCamera). */
  get renderTexture(): Phaser.GameObjects.RenderTexture {
    return this.rt;
  }

  /** Intensidad global de sombra (0 = apagadas). Leída del slider de Opciones cada frame. */
  setIntensity(value: number): void {
    this.intensity = Math.min(1, Math.max(0, value));
  }

  /**
   * Fija los oclusores estáticos (paredes + objetos Tiled) a partir de la
   * grilla del mapa. Se llama una vez por misión y se cachea.
   *
   * Nota: NO se agrega el marco del mundo como oclusor — el recorte al radio de
   * cada luz ya cierra los rayos que no chocan con nada. (Además, un marco
   * cerrado bloquearía cualquier luz colocada fuera del rectángulo del mundo.)
   */
  setStaticOccluders(grid: OccluderGrid | undefined, cellSize: number): void {
    this.staticEdges = grid ? buildStaticOccluderEdges(grid, cellSize) : [];
    this.occludersVersion += 1;
  }

  /**
   * Oclusores dinámicos (casters móviles: componentes, tokens) — 12d.2. Se llama
   * cada frame; solo bumpea la versión (invalida el cache) si las aristas de
   * verdad cambiaron, para que en reposo el cache siga válido.
   */
  setDynamicOccluders(edges: Segment[]): void {
    if (!segmentsEqual(this.dynamicEdges, edges)) {
      this.dynamicEdges = edges;
      this.occludersVersion += 1;
    }
  }

  /** Registra una luz activa. Se conecta al hook `registerLight` de la escena. */
  addLight(light: Phaser.GameObjects.PointLight): void {
    this.lights.add(light);
  }

  /** Recalcula y repinta las sombras. Llamar por frame desde `update()`. */
  redraw(): void {
    this.pruneDeadLights();

    this.rt.clear();

    // Slider a 0 → sombras apagadas: RT transparente, sin trabajo de raycast.
    const darknessAlpha = this.options.darknessAlpha * this.intensity;
    if (darknessAlpha <= 0.01) return;

    this.rt.fill(this.options.darknessColor, darknessAlpha);
    if (this.lights.size === 0) return;

    const edges = this.dynamicEdges.length > 0 ? [...this.staticEdges, ...this.dynamicEdges] : this.staticEdges;
    // Culling por viewport: una luz cuyo círculo no toca lo visible no puede
    // aclarar ningún píxel en pantalla — se saltea su raycast + erase.
    const view = this.scene.cameras.main.worldView;

    for (const light of this.lights) {
      if (!circleIntersectsRect(light.x, light.y, light.radius, view)) continue;
      const polygon = this.visibilityFor(light, edges);
      // El clear escala con la intensidad de la luz (parpadeo) para que la
      // sombra lata con ella, con un piso para que una luz tenue despeje algo.
      const clearAlpha = Math.max(0.3, Math.min(1, light.intensity));
      this.stampErase(polygon, clearAlpha);
    }
  }

  /** Polígono de visibilidad de la luz, reusado del cache si nada se movió. */
  private visibilityFor(
    light: Phaser.GameObjects.PointLight,
    edges: readonly Segment[],
  ): ReturnType<typeof computeVisibilityPolygon> {
    const cached = this.visibilityCache.get(light);
    if (
      cached &&
      cached.x === light.x &&
      cached.y === light.y &&
      cached.radius === light.radius &&
      cached.occludersVersion === this.occludersVersion
    ) {
      return cached.polygon;
    }
    const polygon = computeVisibilityPolygon({
      light: { x: light.x, y: light.y },
      radius: light.radius,
      edges,
      angularSteps: this.options.angularSteps,
    });
    this.visibilityCache.set(light, {
      x: light.x,
      y: light.y,
      radius: light.radius,
      occludersVersion: this.occludersVersion,
      polygon,
    });
    return polygon;
  }

  /** Borra (ERASE parcial) el polígono iluminado de la oscuridad. */
  private stampErase(polygon: ReturnType<typeof computeVisibilityPolygon>, clearAlpha: number): void {
    const [first, ...rest] = polygon;
    if (!first || rest.length < 2) return;

    this.scratch.clear();
    this.scratch.fillStyle(0xffffff, clearAlpha);
    this.scratch.beginPath();
    this.scratch.moveTo(first.x, first.y);
    for (const point of rest) {
      this.scratch.lineTo(point.x, point.y);
    }
    this.scratch.closePath();
    this.scratch.fillPath();

    // Un stamp de alpha parcial hace un ERASE parcial: aclara la oscuridad sin
    // borrarla del todo si la luz es tenue; a alpha 1 la despeja del todo.
    this.rt.erase(this.scratch);
  }

  private pruneDeadLights(): void {
    for (const light of this.lights) {
      if (!light.active) {
        this.lights.delete(light);
        this.visibilityCache.delete(light);
      }
    }
  }

  destroy(): void {
    this.rt.destroy();
    this.scratch.destroy();
    this.lights.clear();
    this.visibilityCache.clear();
  }
}

/** ¿Dos listas de segmentos son idénticas (mismo orden y coords)? */
function segmentsEqual(a: readonly Segment[], b: readonly Segment[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const s = a[i]!;
    const t = b[i]!;
    if (s.a.x !== t.a.x || s.a.y !== t.a.y || s.b.x !== t.b.x || s.b.y !== t.b.y) return false;
  }
  return true;
}

/** ¿El círculo (cx,cy,r) interseca el rectángulo de viewport? (bbox, conservador). */
function circleIntersectsRect(cx: number, cy: number, r: number, rect: Phaser.Geom.Rectangle): boolean {
  return cx + r >= rect.x && cx - r <= rect.right && cy + r >= rect.y && cy - r <= rect.bottom;
}
