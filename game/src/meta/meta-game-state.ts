import { EventEmitter } from "engine";

/**
 * Estados del flujo de meta-juego (Fase 9.5). Vive en `/game`, no en
 * `/engine`, porque orquesta transiciones entre ESCENAS de Phaser — distinto
 * de `CoreLoopModeMachine` (motor), que es el estado planificación/ejecución
 * DENTRO de una misión ya en curso. `"paused"` aquí es el menú de pausa de
 * meta-juego (salir/opciones/guardar), no la pausa táctica del core loop.
 */
export const META_GAME_STATES = [
  "title",
  "credits",
  "archetype-select",
  "crew-select",
  "in-mission",
  "paused",
  "crisis-result",
  "options",
  "creative-hub",
  "creative-workbench",
] as const;

export type MetaGameState = (typeof META_GAME_STATES)[number];

export interface MetaGameStateChangedEvent {
  readonly kind: "meta-game-state-changed";
  readonly from: MetaGameState;
  readonly to: MetaGameState;
}

/** Tabla de transiciones explícita — mismo criterio que `validateTaskDependencies` del motor: rechazar lo no declarado en vez de aceptar cualquier salto de estado. */
const ALLOWED_TRANSITIONS: Readonly<Record<MetaGameState, ReadonlySet<MetaGameState>>> = {
  title: new Set(["archetype-select", "in-mission", "creative-hub", "options", "credits"]),
  credits: new Set(["title"]),
  "archetype-select": new Set(["crew-select", "title"]),
  "crew-select": new Set(["in-mission", "archetype-select"]),
  "in-mission": new Set(["paused", "crisis-result"]),
  paused: new Set(["in-mission", "title", "options"]),
  "crisis-result": new Set(["in-mission", "title"]),
  options: new Set(["title", "paused"]),
  "creative-hub": new Set(["creative-workbench", "title"]),
  "creative-workbench": new Set(["creative-hub"]),
};

export class MetaGameStateError extends Error {}

/**
 * State machine explícita del flujo de meta-juego. `options`/`paused` no
 * llevan pila de "volver" propia — el `scene-flow-manager.ts` decide a dónde
 * vuelve `options` según desde dónde se lanzó (title o paused), pasándolo
 * como el `to` de la próxima transición.
 */
export class MetaGameStateMachine {
  private current: MetaGameState = "title";

  constructor(private readonly emitter = new EventEmitter<MetaGameStateChangedEvent>()) {}

  get state(): MetaGameState {
    return this.current;
  }

  canTransition(to: MetaGameState): boolean {
    return ALLOWED_TRANSITIONS[this.current].has(to);
  }

  transition(to: MetaGameState): void {
    if (!this.canTransition(to)) {
      throw new MetaGameStateError(`Illegal meta-game transition: ${this.current} -> ${to}`);
    }
    const from = this.current;
    this.current = to;
    this.emitter.emit({ kind: "meta-game-state-changed", from, to });
  }

  onStateChanged(handler: (event: MetaGameStateChangedEvent) => void): () => void {
    return this.emitter.on("meta-game-state-changed", handler);
  }
}
