import Phaser from "phaser";
import type { ConduitKind } from "engine";

import type { FlowTokenHook, GridPosition, StateDrivenEffect } from "../particle-effect.types.js";
import { type EffectScene, pickTexture, textureScale, toPixel } from "../particle-utils.js";
import type { PixelPoint } from "../../render/conduit-path.js";
import { CONDUIT_COLORS } from "../../render/palette.js";
import { CIRCLE_TEXTURES } from "../particle-texture-registry.js";

/**
 * Flujo animado en conducto activo (GDD §10/11.1): partículas discretas en la
 * dirección del flujo, densidad/velocidad ∝ caudal, color por recurso
 * (reutiliza `CONDUIT_COLORS` de `floorplan-renderer.ts`, mismo criterio que
 * el resto del render). State-driven, no evento (principio 6: ruido continuo).
 *
 * `intensity`/`direction` los calcula quien conoce el estado real del
 * conducto — Fase 8 no decide esa derivación: para `ventilacion` sale del
 * gradiente de presión/concentración entre las dos secciones que conecta
 * (`ConduitConnection.a`/`b`), para `electrico`/`fluido`/`senal` de la
 * `SignalNodeState`/carga del grafo de la mesa (Fase 7). Ese cableado real es
 * de Fase 10; este efecto solo sabe pintar el estado que le pasan.
 *
 * IMPORTANTE (fix 11f.4): el emisor se crea con su config de emisión COMPLETO
 * (`frequency`/`quantity`/`angle` incluidos) y emite por el default
 * `emitting: true`, igual que los efectos de `spawnBurst` que sí se ven. NO se
 * usa `emitter.setConfig(...)` para actualizar en vivo: `setConfig` recarga
 * TODOS los ops del emisor desde el config parcial y los ausentes (`scale`,
 * `speed`, `lifespan`) vuelven a su default (scale 1 → partículas de 512px,
 * speed 0 → inmóviles), lo que hacía que el flujo fuera invisible. Los cambios
 * en vivo usan setters puntuales (`setFrequency`, `setEmitterAngle`), y solo
 * cuando el valor cambia (ambos resetean el `flowCounter`, así que llamarlos
 * cada frame impediría emitir).
 */
export interface ConduitFlowState {
  readonly active: boolean;
  /** Caudal normalizado, 0 = sin flujo. Escala densidad y velocidad de partícula. */
  readonly intensity: number;
  readonly kind: ConduitKind;
  /** Vector unitario (o casi) de dirección del flujo, en espacio de pantalla. */
  readonly direction: { readonly x: number; readonly y: number };
}

export function createConduitFlowEffect(): StateDrivenEffect<ConduitFlowState> {
  let scene: EffectScene | undefined;
  let px = 0;
  let py = 0;
  let emitter: Phaser.GameObjects.Particles.ParticleEmitter | undefined;
  let lastIntensity = Number.NaN;
  let lastAngleDeg = Number.NaN;

  return {
    start(s: EffectScene, position: GridPosition): void {
      scene = s;
      ({ px, py } = toPixel(position));
    },
    update(state: ConduitFlowState): void {
      if (!scene) return;
      if (!state.active || state.intensity <= 0) {
        emitter?.stop();
        return;
      }
      const angleDeg = angleDegBetween(state.direction);
      if (!emitter) {
        emitter = createFlowEmitter(scene, px, py, angleDeg, state.intensity, state.kind);
        lastIntensity = state.intensity;
        lastAngleDeg = angleDeg;
        return;
      }
      if (!emitter.emitting) emitter.start();
      // Solo cuando cambia: ambos setters resetean `flowCounter` (ver nota del
      // encabezado), así que aplicarlos cada frame impediría emitir.
      if (lastAngleDeg !== angleDeg) {
        emitter.setEmitterAngle({ min: angleDeg - 6, max: angleDeg + 6 });
        lastAngleDeg = angleDeg;
      }
      if (lastIntensity !== state.intensity) {
        emitter.setFrequency(flowFrequency(state.intensity), flowQuantity(state.intensity));
        lastIntensity = state.intensity;
      }
    },
    stop(): void {
      emitter?.destroy();
      emitter = undefined;
    },
  };
}

/**
 * Estado del flujo animado sobre una POLILÍNEA (Fase 11f, resuelve la
 * Observación #1 de `PENDIENTES_OBSERVACIONES.md`) — sin `direction`: no hay
 * señal de dirección física real y confiable en el motor hoy para ningún
 * `ConduitKind` (Fase 11f.5), así que ambos sentidos del conducto se muestran
 * simultáneamente con la MISMA intensidad — simplificación consciente, no
 * pendiente a resolver ahora.
 */
export interface ConduitPathFlowState {
  readonly active: boolean;
  readonly intensity: number;
  readonly kind: ConduitKind;
  /**
   * Fase 11f.6: la escena la deriva del toggle de capa (`FloorplanLayerId`) —
   * a diferencia de la línea estática del conducto (que solo se ATENÚA al
   * desactivar su capa, `CONDUIT_LAYER_INACTIVE_ALPHA`), el flujo animado se
   * OCULTA por completo (alpha 0), porque un flujo tenue pero visible de una
   * capa "apagada" confunde más que ayuda (feedback del operador). El flujo
   * interno (spawn/avance) sigue corriendo aunque `visible` sea `false` —
   * solo se oculta el render — para que al reactivar la capa el tráfico ya
   * esté en curso, no arranque de cero.
   */
  readonly visible: boolean;
  /**
   * Sentido REAL del flujo (Subfase 13h). `"both"` conserva el comportamiento
   * simétrico de 11f.5 y sigue siendo lo correcto para `electrico`/`senal`,
   * donde no hay un "hacia dónde" que mostrar.
   *
   * En ventilación sí lo hay: con la nave compartimentada, ver que el aire va
   * DE la sala presurizada HACIA la brechada es la mitad de la información —
   * la intensidad sola dice que algo pasa, no en qué dirección se está
   * desangrando la nave. `"forward"` es el sentido `a → b` del conducto.
   */
  readonly direction?: "forward" | "backward" | "both";
}

/** Tope de tokens viajeros concurrentes por SENTIDO — acota el conteo de `Image` en pantalla a intensidad máxima. */
const MAX_TOKENS_PER_STREAM = 4;
/** Diámetro visual (px) de la cabeza y de cada fantasma — subido en 11f.6 (10/7 → 18/13/9), se perdían contra el fondo. */
const HEAD_SIZE_PX = 18;
const GHOST_SIZES_PX = [13, 9] as const;
/** Separación (en píxeles a lo largo del camino) de cada "fantasma" de la estela detrás de la cabeza. */
const GHOST_OFFSETS_PX = [16, 30] as const;
const GHOST_ALPHAS = [0.55, 0.28] as const;

interface FlowToken {
  readonly head: Phaser.GameObjects.Image;
  readonly ghosts: readonly Phaser.GameObjects.Image[];
  /** Velocidad fijada al SPAWN del token (no la de `intensity` en vivo): si el conducto se apaga a mitad de
   * camino, el token ya en viaje debe completar su recorrido a velocidad constante y recién ahí destruirse
   * — congelarlo dejaría "fantasmas" inmóviles para siempre en el mapa. */
  readonly speedPxPerSec: number;
  distancePx: number;
}

/** Geometría precalculada de un sentido de recorrido (path original, o invertido para el sentido contrario). */
interface FlowStream {
  readonly path: readonly PixelPoint[];
  readonly cumulative: readonly number[];
  readonly totalLength: number;
  spawnAccumulatorMs: number;
  tokens: FlowToken[];
}

/**
 * Tokens viajeros que recorren la POLILÍNEA COMPLETA de punta a punta (Fase
 * 11f.5, reemplaza el emisor-por-segmento de 11f/11f.4 tras feedback del
 * operador: "no me gusta como está, sería mejor que tengamos partículas que
 * recorren todos los caminos del conducto"). Se mantienen DOS `FlowStream`
 * independientes y simultáneos — uno con `path` y otro con `path` invertido —
 * para que ambos extremos del conducto estén siempre cubiertos como origen,
 * sin depender de azar (confirmado con el operador).
 *
 * No se usa `Phaser.Curves.Path`/`PathFollower` (el proyecto no los usa en
 * ningún lado — precedente existente es el lerp manual punto-a-punto de
 * `hop-movement.ts`) ni un `ParticleEmitter` con `moveTo` (solo soporta un
 * destino recto, no una polilínea con curvas alrededor de paredes — Fase
 * 11f.2). Cada token es un control manual de posición cuadro a cuadro sobre
 * `pointAtDistance`, con 2 "fantasmas" de estela a distancia fija detrás de
 * la cabeza (no por tiempo: más simple, sin drift de framerate, mismo efecto
 * visual de estela de separación constante) y fade in/out suave en los
 * extremos del recorrido.
 */
export function createConduitPathFlowEffect(
  path: readonly PixelPoint[],
  // La escena registra cada `Image` recién creada (depth + cámara de mundo) —
  // ver `FlowTokenHook`. Sin esto las partículas no se ven en el mapa.
  onTokenCreated?: FlowTokenHook,
): StateDrivenEffect<ConduitPathFlowState> {
  let scene: EffectScene | undefined;
  let forward: FlowStream | undefined;
  let backward: FlowStream | undefined;

  return {
    // `position` (2do parámetro de `StateDrivenEffect.start`) se ignora a propósito:
    // el `path` ya trae toda la posición necesaria.
    start(s: EffectScene): void {
      scene = s;
      if (path.length < 2) return; // camino degenerado: sin geometría que recorrer.
      forward = buildStream(path);
      backward = buildStream([...path].reverse());
    },
    update(state: ConduitPathFlowState, deltaSeconds: number): void {
      if (!scene || !forward || !backward) return;
      const spawnEnabled = state.active && state.intensity > 0;
      // Subfase 13h: se apaga el SPAWN del sentido contrario, no el stream. Los
      // tokens que ya iban en viaje terminan su recorrido — congelarlos dejaría
      // fantasmas inmóviles en el mapa, el mismo motivo por el que la velocidad
      // se fija al spawn y no se lee en vivo.
      const direction = state.direction ?? "both";
      updateStream(
        scene,
        forward,
        state,
        spawnEnabled && direction !== "backward",
        deltaSeconds,
        onTokenCreated,
      );
      updateStream(
        scene,
        backward,
        state,
        spawnEnabled && direction !== "forward",
        deltaSeconds,
        onTokenCreated,
      );
    },
    stop(): void {
      forward?.tokens.forEach(destroyToken);
      backward?.tokens.forEach(destroyToken);
      forward = undefined;
      backward = undefined;
    },
  };
}

function buildStream(path: readonly PixelPoint[]): FlowStream {
  const cumulative = cumulativeLengths(path);
  return {
    path,
    cumulative,
    totalLength: cumulative[cumulative.length - 1] ?? 0,
    spawnAccumulatorMs: 0,
    tokens: [],
  };
}

/**
 * Avanza y limpia los tokens ya en viaje (siempre, incluso con el conducto
 * apagado — así terminan su recorrido en vez de quedar congelados) y, si
 * `spawnEnabled`, dispara nuevos tokens a un ritmo ∝ `state.intensity`.
 */
function updateStream(
  scene: EffectScene,
  stream: FlowStream,
  state: ConduitPathFlowState,
  spawnEnabled: boolean,
  deltaSeconds: number,
  onTokenCreated: FlowTokenHook | undefined,
): void {
  if (stream.totalLength <= 0) return;

  stream.tokens = stream.tokens.filter((token) => {
    token.distancePx += token.speedPxPerSec * deltaSeconds;
    if (token.distancePx >= stream.totalLength) {
      destroyToken(token);
      return false;
    }
    positionToken(stream, token, state.visible);
    return true;
  });

  if (!spawnEnabled) return;

  const intervalMs = tokenSpawnIntervalMs(state.intensity);
  stream.spawnAccumulatorMs += deltaSeconds * 1000;
  while (stream.spawnAccumulatorMs >= intervalMs && stream.tokens.length < MAX_TOKENS_PER_STREAM) {
    stream.spawnAccumulatorMs -= intervalMs;
    const token = spawnToken(scene, stream, state.kind, state.intensity, onTokenCreated);
    positionToken(stream, token, state.visible);
    stream.tokens.push(token);
  }
  // Con el tope de tokens alcanzado, no dejar que el acumulador crezca sin
  // límite (spawnearía una ráfaga entera apenas se libere un cupo).
  if (stream.tokens.length >= MAX_TOKENS_PER_STREAM) {
    stream.spawnAccumulatorMs = Math.min(stream.spawnAccumulatorMs, intervalMs);
  }
}

function spawnToken(
  scene: EffectScene,
  stream: FlowStream,
  kind: ConduitKind,
  intensity: number,
  onTokenCreated: FlowTokenHook | undefined,
): FlowToken {
  const texture = pickTexture(CIRCLE_TEXTURES);
  const tint = CONDUIT_COLORS[kind];
  const start = stream.path[0]!;
  // Fase 11f.6: tamaño subido (10→18px cabeza) tras feedback del operador —
  // el diámetro anterior se perdía contra el fondo del plano.
  const head = scene.add.image(start.x, start.y, texture).setTint(tint).setScale(textureScale(HEAD_SIZE_PX));
  const ghosts = GHOST_SIZES_PX.map((sizePx) =>
    scene.add.image(start.x, start.y, texture).setTint(tint).setScale(textureScale(sizePx)),
  );
  onTokenCreated?.(head);
  ghosts.forEach((ghost) => onTokenCreated?.(ghost));
  return { head, ghosts, speedPxPerSec: tokenSpeedPxPerSec(intensity), distancePx: 0 };
}

/**
 * Reposiciona la cabeza y los fantasmas de la estela según `distancePx`, con
 * fade suave en los extremos del camino. `visible` (Fase 11f.6, toggle de
 * capa) multiplica el alpha final a 0 sin detener el avance del token — así
 * el flujo sigue "corriendo" oculto y no arranca de cero al reactivar la capa.
 */
function positionToken(stream: FlowStream, token: FlowToken, visible: boolean): void {
  const visibleFactor = visible ? 1 : 0;
  const headPoint = pointAtDistance(stream.path, stream.cumulative, token.distancePx);
  token.head.setPosition(headPoint.x, headPoint.y);
  token.head.setAlpha(edgeFade(token.distancePx, stream.totalLength) * visibleFactor);

  token.ghosts.forEach((ghost, index) => {
    const ghostDistance = token.distancePx - GHOST_OFFSETS_PX[index]!;
    if (ghostDistance < 0) {
      ghost.setAlpha(0);
      return;
    }
    const ghostPoint = pointAtDistance(stream.path, stream.cumulative, ghostDistance);
    ghost.setPosition(ghostPoint.x, ghostPoint.y);
    ghost.setAlpha(GHOST_ALPHAS[index]! * edgeFade(ghostDistance, stream.totalLength) * visibleFactor);
  });
}

/** Desvanece suavemente cerca de los dos extremos del camino (evita el "pop" de aparición/desaparición). */
function edgeFade(distancePx: number, totalLength: number): number {
  const fadeLenPx = Math.max(1, Math.min(20, totalLength * 0.2));
  const fade = Math.min(1, distancePx / fadeLenPx, (totalLength - distancePx) / fadeLenPx);
  return Phaser.Math.Clamp(fade, 0, 1);
}

function destroyToken(token: FlowToken): void {
  token.head.destroy();
  token.ghosts.forEach((ghost) => ghost.destroy());
}

/** Distancia acumulada (píxeles) en cada vértice del `path` — `cumulative[0] === 0`, el último es la longitud total. */
function cumulativeLengths(path: readonly PixelPoint[]): readonly number[] {
  const cumulative: number[] = [0];
  for (let i = 1; i < path.length; i += 1) {
    const prev = path[i - 1]!;
    const curr = path[i]!;
    const segmentLength = Phaser.Math.Distance.Between(prev.x, prev.y, curr.x, curr.y);
    cumulative.push(cumulative[i - 1]! + segmentLength);
  }
  return cumulative;
}

/** Punto interpolado a `distancePx` píxeles desde el inicio del `path` (clamp a los extremos). */
function pointAtDistance(path: readonly PixelPoint[], cumulative: readonly number[], distancePx: number): PixelPoint {
  const totalLength = cumulative[cumulative.length - 1]!;
  const clamped = Phaser.Math.Clamp(distancePx, 0, totalLength);
  for (let i = 0; i < path.length - 1; i += 1) {
    const segmentEnd = cumulative[i + 1]!;
    if (clamped > segmentEnd && i < path.length - 2) continue;
    const segmentStart = cumulative[i]!;
    const segmentLength = segmentEnd - segmentStart;
    const t = segmentLength > 0 ? (clamped - segmentStart) / segmentLength : 0;
    const from = path[i]!;
    const to = path[i + 1]!;
    return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
  }
  return path[path.length - 1]!;
}

/** Velocidad de recorrido (px/s) — más caudal, más rápido. Fijada por token al spawnear (ver `FlowToken`). */
function tokenSpeedPxPerSec(intensity: number): number {
  return 50 + intensity * 130;
}

/** Intervalo entre spawns (ms) — más caudal, spawns más frecuentes. */
function tokenSpawnIntervalMs(intensity: number): number {
  return Phaser.Math.Clamp(320 - intensity * 220, 90, 320);
}

function angleDegBetween(direction: { readonly x: number; readonly y: number }): number {
  return Phaser.Math.RadToDeg(Math.atan2(direction.y, direction.x));
}

/** Frecuencia de emisión (ms entre ráfagas) — más caudal, más rápido. */
function flowFrequency(intensity: number): number {
  return Math.max(8, 60 - intensity * 50);
}

/** Partículas por ráfaga — más caudal, más densidad. */
function flowQuantity(intensity: number): number {
  return Math.max(1, Math.round(intensity * 3));
}

/**
 * Crea el emisor con su config de emisión COMPLETO (fix 11f.4): incluye
 * `angle`/`frequency`/`quantity` además de `lifespan`/`speed`/`scale`/`tint`,
 * para que emita desde el arranque sin depender de un `setConfig` posterior
 * (que borraría los ops ausentes). Ver la nota del encabezado del archivo.
 */
function createFlowEmitter(
  scene: EffectScene,
  px: number,
  py: number,
  angleDeg: number,
  intensity: number,
  kind: ConduitKind,
): Phaser.GameObjects.Particles.ParticleEmitter {
  return scene.add.particles(px, py, pickTexture(CIRCLE_TEXTURES), {
    lifespan: 500,
    speed: { min: 20, max: 40 },
    scale: { start: textureScale(10), end: textureScale(3) },
    tint: CONDUIT_COLORS[kind],
    angle: { min: angleDeg - 6, max: angleDeg + 6 },
    frequency: flowFrequency(intensity),
    quantity: flowQuantity(intensity),
  });
}
