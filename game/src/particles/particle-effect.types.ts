import type Phaser from "phaser";
import type { DomainEvent } from "engine";

/**
 * Fase 8: dos categorías de fenómeno, dos formas de enganche (ver plan de
 * Fase 8). `EventDrivenEffect` reacciona a un `DomainEvent` puntual (burst).
 * `StateDrivenEffect` se actualiza cada frame leyendo estado vivo del motor
 * (flujo en conducto, fuga de gas, etc.) — esos fenómenos no tienen evento
 * dedicado (principio 6 CLAUDE.md: un evento por tick sería ruido).
 */

/** Posición en celdas de grid — mismo sistema que `floorplan-renderer.ts` (× `GRID_CELL_SIZE_PX`). */
export interface GridPosition {
  readonly x: number;
  readonly y: number;
}

export type DomainEventOfKind<K extends DomainEvent["kind"]> = Extract<DomainEvent, { kind: K }>;

/**
 * Efecto ligado a un `DomainEvent` de un `kind` concreto. `trigger` recibe la
 * posición explícitamente porque no todo `DomainEvent` la lleva (p.ej.
 * `CombustionEvent` no tiene `sectionId`/`ref`) — quien conoce dónde ocurrió
 * el evento (el driver de Fase 10, o la escena de galería en Fase 8) la pasa.
 */
export interface EventDrivenEffect<K extends DomainEvent["kind"] = DomainEvent["kind"]> {
  readonly kind: K;
  trigger(scene: Phaser.Scene, position: GridPosition, event: DomainEventOfKind<K>): void;
}

/**
 * Efecto continuo: se crea una vez (`start`) y se actualiza cada frame con el
 * estado vivo del subsistema correspondiente (`update`), hasta que se apaga
 * (`stop`) — no hay un `DomainEvent` que dispare esto.
 */
export interface StateDrivenEffect<TState> {
  start(scene: Phaser.Scene, position: GridPosition): void;
  update(state: TState, deltaSeconds: number): void;
  stop(): void;
}

/**
 * Hook para que la ESCENA registre cada emisor que un efecto crea internamente
 * — necesario porque los efectos state-driven crean sus emisores con
 * `scene.add.particles` (lazy, sin handle para el llamador), y sin asignarles
 * cámara/depth caen en el "bug de doble-cámara" (`floorplan-scene.ts`): la
 * `hudCamera` los pinta sin scroll y quedan fuera de lugar. La escena usa este
 * hook para `setDepth(effect)` + `markAsWorldObject`, igual que ya hace con los
 * bursts de `fireFabricationEffect`.
 */
export type ParticleEmitterHook = (emitter: Phaser.GameObjects.Particles.ParticleEmitter) => void;

/**
 * Mismo problema que `ParticleEmitterHook`, para efectos que en vez de un
 * `ParticleEmitter` crean `Image` sueltas (Fase 11f.5: tokens viajeros de
 * flujo de conducto, que necesitan control manual de posición cuadro a
 * cuadro para seguir una polilínea con curvas — un `ParticleEmitter` no
 * soporta eso de forma nativa).
 */
export type FlowTokenHook = (token: Phaser.GameObjects.Image) => void;

/**
 * Mismo problema que `ParticleEmitterHook`, para luces aditivas persistentes
 * (Fase 12a: `game/src/particles/effects/dynamic-light.ts`) — un
 * `Phaser.GameObjects.PointLight` creado con `scene.add.pointlight` es tan
 * susceptible al bug de doble-cámara como un emisor de partículas, y a
 * diferencia de los bursts cortos existentes (`combustion-effect.ts`), una
 * luz persistente queda visible el tiempo suficiente para que el duplicado
 * fijo de `hudCamera` sea notorio.
 */
export type LightHook = (light: Phaser.GameObjects.PointLight) => void;
