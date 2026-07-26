import type { EventEmitter } from "../simulation/event-emitter.js";
import type { TickContext } from "../simulation/simulation-clock.types.js";
import type { Tickable } from "../tasks/core-loop-mode.js";
import { SignalEvaluator, type SignalEmitterInputs } from "../signals/signal-evaluator.js";
import type { SignalDomainEvent } from "../signals/signal-events.types.js";
import type { SignalGraph } from "../signals/signal-graph.types.js";
import type { SignalGraphState } from "../signals/signal-state.types.js";
import type { SignalNode, SignalNodeId } from "../signals/signal-node.types.js";
import type { PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import { sectionContainingCell } from "../floorplan/floorplan.types.js";
import type { ShipFloorplan } from "../floorplan/floorplan.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import type { MutableShipState } from "./mutable-ship-state.js";

/**
 * Cicatriz de energía (Fase 11b): de dónde sale el conjunto de secciones sin
 * suministro AHORA MISMO. `unpoweredSections()` se evalúa en cada lectura
 * (mismo criterio que `EmitterInputSource`) porque `Blueprint.unpoweredSectionIds`
 * puede cambiar de una misión a otra sin que cambie la topología del grafo.
 */
export interface PowerScarSource {
  readonly shipFloorplan: ShipFloorplan;
  unpoweredSections(): ReadonlySet<SectionId>;
}

/**
 * De dónde salen las entradas del mundo a los emisores en cada tick (un sensor
 * que detecta movimiento, un botón pulsado). El evaluador no lo sabe: la salida
 * de un emisor "la fija el mundo, no la topología" (`signal-node.types.ts`).
 */
export type EmitterInputSource = () => SignalEmitterInputs;

/**
 * Puerto mínimo que `MissionProjectileWorld` necesita de un estado de señales
 * (Fase 11a.3, ASA 3): "¿esta salida está activa ahora?". `MissionSignalRuntime`
 * lo satisface estructuralmente sin cambios — aflojar el tipo concreto a esta
 * interfaz es lo que permite construir un lector de señales DESCARTABLE (sobre
 * un `SignalGraphState` clonado) para la predicción de trayectoria, sin
 * instanciar una `MissionSignalRuntime` completa de usar y tirar.
 */
export interface SignalOutputReader {
  outputOf(nodeId: SignalNodeId): boolean;
}

/**
 * Estado de señales VIVO de una misión (Fase 11a).
 *
 * Hasta ahora el motor evaluaba señales solo en ráfagas desechables: la
 * resolución del capítulo 2 (`crisis/rules/signal-output-matches.ts`) crea un
 * `SignalEvaluator`, lo corre con entradas sintéticas de tabla de verdad y
 * tira el estado. Nadie mantenía "qué nodos están energizados AHORA", así que
 * nada del motor podía reaccionar al cableado real en tiempo de misión — que
 * es justo lo que necesita `ProjectileSimulation` para saber qué bobinas
 * pulsan (documento de aceleración magnética §1).
 *
 * Esta clase es ese estado persistente: posee el evaluador y su
 * `SignalGraphState` a través de los ticks, y se registra en el
 * `CoreLoopModeMachine` como un `Tickable` más — de modo que la pausa táctica
 * congela las señales igual que todo lo demás (GDD §4.2).
 */
export class MissionSignalRuntime implements Tickable, SignalOutputReader {
  private evaluator: SignalEvaluator<PlacedComponentInstanceId>;
  private state: SignalGraphState;
  private graph: SignalGraph<PlacedComponentInstanceId>;
  private nodeById: Map<SignalNodeId, SignalNode<PlacedComponentInstanceId>>;

  constructor(
    private readonly shipState: MutableShipState,
    private readonly emitterInputs: EmitterInputSource,
    private readonly emitter?: EventEmitter<SignalDomainEvent>,
    private readonly powerScars?: PowerScarSource,
  ) {
    this.graph = shipState.get().signalGraph;
    this.evaluator = new SignalEvaluator(this.graph, this.emitter);
    this.state = this.evaluator.createState();
    this.nodeById = new Map(this.graph.nodes.map((node) => [node.id, node]));
  }

  get signalState(): SignalGraphState {
    return this.state;
  }

  /**
   * Salida actual de un nodo. `false` si el nodo no existe (cableado a
   * medias) o si su sección quedó marcada sin energía (Fase 11b, cicatriz) —
   * en ese caso la salida se fuerza a `false` sin importar cableado/reservorio.
   */
  outputOf(nodeId: SignalNodeId): boolean {
    const raw = this.state.get(nodeId)?.output ?? false;
    if (!raw || !this.powerScars) {
      return raw;
    }
    const unpowered = this.powerScars.unpoweredSections();
    if (unpowered.size === 0) {
      return raw;
    }
    const node = this.nodeById.get(nodeId);
    const section = node && sectionContainingCell(this.powerScars.shipFloorplan, node.position);
    return section && unpowered.has(section.id) ? false : raw;
  }

  tick(ctx: TickContext): void {
    this.syncGraph();
    this.evaluator.tick(this.state, this.emitterInputs(), ctx);
  }

  /**
   * El jugador re-cablea DURANTE la misión (`queueConnect`), y cada cambio
   * produce un `Blueprint` nuevo con otro `signalGraph`. El evaluador se
   * construye sobre un grafo fijo (indexa las aristas entrantes en el
   * constructor), así que hay que reconstruirlo cuando la topología cambia.
   *
   * La memoria (latch, contador, delay en vuelo) de los nodos que SOBREVIVEN
   * al cambio se conserva: tirar el estado entero haría que tender un cable
   * nuevo reseteara todos los latches de la nave, un efecto invisible y
   * absurdo para el jugador. Los nodos que desaparecen se llevan su memoria
   * con ellos — eso sí es una consecuencia real de desmontar (principio 5).
   */
  private syncGraph(): void {
    const current = this.shipState.get().signalGraph;
    if (current === this.graph) {
      return;
    }
    this.graph = current;
    this.nodeById = new Map(current.nodes.map((node) => [node.id, node]));
    this.evaluator = new SignalEvaluator(current, this.emitter);
    const preserved = this.evaluator.createState();
    for (const [nodeId, nodeState] of this.state) {
      if (preserved.has(nodeId)) {
        preserved.set(nodeId, nodeState);
      }
    }
    this.state = preserved;
  }
}

/**
 * Fuente de entradas por defecto: todos los emisores del grafo activos.
 *
 * LIMITACIÓN CONSCIENTE, no un descuido: el motor todavía no simula qué
 * dispara un sensor (un `EmitterProperty` declara `range`/`triggerType`/
 * `frequency`, pero nada los evalúa contra el mundo). Hasta que exista esa
 * simulación, un emisor cableado se comporta como un sensor permanentemente
 * disparado. Anotado en PENDIENTES_OBSERVACIONES.md.
 */
export function allEmittersActive(shipState: MutableShipState): EmitterInputSource {
  return () =>
    new Map(
      shipState
        .get()
        .signalGraph.nodes.filter((node) => node.role === "emitter")
        .map((node) => [node.id, true]),
    );
}
