import type { Brand } from "../shared/brand.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import type { CrewActorId } from "../crew/crew-actor.types.js";
import type { PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { ComponentId } from "../components/physical-component.types.js";
import type { PlacedFootprint } from "../geometry/grid-position.types.js";
import type { SignalEdgeId } from "../signals/signal-edge.types.js";
import type { SignalNodeId } from "../signals/signal-node.types.js";
import type { ComponentWear } from "../wear/wear.types.js";
import type { ChemicalSubstanceId } from "../chemistry/chemical-substance.types.js";

export type CrewTaskId = Brand<string, "CrewTaskId">;

/**
 * Tipos de tarea encolables (GDD §4.2, ejemplos de la secuencia: "ir a la
 * sección X → desmontar componente Y → transportarlo a la mesa → combinarlo →
 * reinstalarlo → conectar").
 *
 * ABSTRACTOS por decisión de alcance: Fase 6 entrega el MECANISMO del core loop
 * (scheduling, dependencias, pausa/reanudación, cancelación). El EFECTO físico
 * real de cada tipo se difiere — desmontaje y recuperación de material (Fase 7
 * mesa de creación / Fase 9 recuperación por tier, GDD 6.5), síntesis (Fase 7),
 * reinstalación/conexión en el plano (Fase 7) — y se conecta vía el hook
 * `TaskEffect`, no aquí.
 */
export type TaskType =
  | "go-to"
  | "dismantle"
  | "transport"
  | "combine"
  | "install"
  | "connect"
  | "analyze-substance"
  // Subfase 13d — tareas de ASEGURADO previas a un desmontaje peligroso.
  | "cut-power"
  | "purge-reservoir"
  | "discharge-source"
  // Subfase 13e — ciclo de vida real de una sustancia: extraer → sintetizar →
  // almacenar → transportar → aplicar.
  | "transfer-substance"
  | "apply-substance"
  | "extract-elements";

/**
 * Máquina de estados explícita de una tarea (CLAUDE.md: "State machine
 * explícita … no banderas booleanas sueltas"). Transiciones válidas:
 *
 *   pending ──(deps cumplidas)──▶ in-progress ──(duración alcanzada)──▶ completed
 *      │                              │
 *      └──(deps sin cumplir)──▶ blocked ──(deps cumplidas)──▶ in-progress
 *
 * `cancelled` y `failed` son terminales y alcanzables desde cualquier estado no
 * terminal: `cancelled` por acción del jugador (GDD §4.5), `failed` reservado
 * para cuando el efecto de una tarea (Fase 7/9/10) reporte un fallo.
 */
export type TaskState =
  "pending" | "in-progress" | "blocked" | "completed" | "cancelled" | "failed";

/** Estados de los que ninguna transición sale (la tarea ya terminó su vida). */
export const TERMINAL_TASK_STATES: ReadonlySet<TaskState> = new Set<TaskState>([
  "completed",
  "cancelled",
  "failed",
]);

/**
 * Datos específicos del efecto físico de una tarea (Fase 10b), por `TaskType`.
 * Solo cubre `dismantle`/`install`/`connect` — los tipos que el capítulo 1
 * ejercita; `transport`/`combine` quedan sin payload hasta que el capítulo que
 * los necesite (mesa de creación en el core loop) lo defina, mismo criterio de
 * "no construir mecanismo antes del caso de uso" ya aplicado a cicatrices/
 * Tickables de química-atmósfera-fallo-cinética en esta misma fase.
 */
export interface DismantleTaskPayload {
  readonly kind: "dismantle";
  readonly instanceId: PlacedComponentInstanceId;
}

export interface InstallTaskPayload {
  readonly kind: "install";
  readonly instanceId: PlacedComponentInstanceId;
  readonly componentDefinitionId: ComponentId;
  readonly placement: PlacedFootprint;
  /**
   * Bucket de desgaste del que se toma la unidad (Fase 13c). El jugador lo
   * elige en el selector de instalación cuando hay unidades en varios estados.
   * Opcional y retrocompatible: ausente = `nuevo`, el bucket por defecto.
   */
  readonly wear?: ComponentWear;
}

export interface ConnectTaskPayload {
  readonly kind: "connect";
  readonly edgeId: SignalEdgeId;
  readonly fromNodeId: SignalNodeId;
  readonly toNodeId: SignalNodeId;
  readonly toPort?: string;
}

/**
 * "Analizar Sustancia" (Fase 11e): un tripulante revela los valores exactos
 * de riesgo (radio de combustión, tasa de degradación estructural) de una
 * "Mezcla sin identificar" que hoy solo se conoce por sus tags genéricos.
 * Cualquier especialidad puede ejecutarla (GDD: "cualquier tripulante puede
 * intentar cualquier tarea") — Médico solo la hace más rápido, vía el
 * modificador de afinidad, no un requisito duro.
 */
export interface AnalyzeSubstanceTaskPayload {
  readonly kind: "analyze-substance";
  readonly substanceId: ChemicalSubstanceId;
}

/**
 * "Cortar energía a la sección" (Subfase 13d): pone en 0 la asignación de
 * unidades de la sección (13b), dejando sin alimentar a todo lo que hay dentro
 * — así desmontar una pieza de ahí deja de producir un chispazo.
 *
 * No hay un flag "purgado" por instancia (decisión del operador, 2026-08-05):
 * el estado seguro es DERIVADO del mundo, así que volver a asignar energía a
 * la sección la vuelve peligrosa de nuevo, sin nada que resincronizar.
 */
export interface CutPowerTaskPayload {
  readonly kind: "cut-power";
  readonly sectionId: SectionId;
}

/**
 * "Purgar reservorio" (Subfase 13d): vacía de forma controlada el contenido de
 * un reservorio antes de desmontarlo. La sustancia se ventea — no vuelve al
 * inventario, porque no existe todavía un destino real para las sustancias
 * (deuda #9, Subfase 13e).
 */
export interface PurgeReservoirTaskPayload {
  readonly kind: "purge-reservoir";
  readonly instanceId: PlacedComponentInstanceId;
}

/**
 * "Descargar fuente" (Subfase 13d, fix de playtest ronda 1): una batería o
 * panel solar lleva su PROPIA carga, así que cortar la energía de la sección
 * no la vuelve segura. Descargarla sí — al precio de que su aporte deja de
 * contar en el presupuesto de la nave (`totalPowerBudget`), permanentemente
 * (principio 5): asegurar una fuente para canibalizarla es un sacrificio de
 * energía, no una casilla gratis.
 */
export interface DischargeSourceTaskPayload {
  readonly kind: "discharge-source";
  readonly instanceId: PlacedComponentInstanceId;
}

/**
 * "Trasvasar sustancia" (Subfase 13e): mueve contenido de un reservorio a otro.
 * Intra-sección es libre (el tripulante lo hace a mano); cruzar de sección
 * exige un camino de conductos `fluido`, validado con
 * `assertFluidTransferReachable` — mismo criterio que el cableado de señal de
 * la Fase 11f, y la razón de que los conductos `fluido` dejen de ser decorado.
 */
export interface TransferSubstanceTaskPayload {
  readonly kind: "transfer-substance";
  readonly fromInstanceId: PlacedComponentInstanceId;
  readonly toInstanceId: PlacedComponentInstanceId;
  readonly amount: number;
}

/**
 * "Aplicar sustancia" (Subfase 13e): vuelca contenido de un reservorio sobre la
 * ATMÓSFERA de una sección. Es el primer escritor real de un
 * `ChemicalSubstanceId` en `atmosphere.gases` — hasta 13e todo el camino lector
 * (contaminantes, corrosión, hazards) existía sin nadie que escribiera. De acá
 * sale el neutralizante del Cap.7.
 */
export interface ApplySubstanceTaskPayload {
  readonly kind: "apply-substance";
  readonly fromInstanceId: PlacedComponentInstanceId;
  readonly sectionId: SectionId;
  readonly amount: number;
}

/**
 * "Extraer elementos" (Subfase 13e, GDD 5.4.1): descompone la sustancia de un
 * reservorio en los elementos que la forman y los acredita al inventario, que
 * es de dónde sale la materia prima para sintetizar.
 *
 * PRECONDICIÓN: la sustancia debe estar analizada (`analyze-substance`, Fase
 * 11e). Se conoce la composición por la receta del catálogo o, si es una mezcla
 * sin identificar, por la procedencia registrada al sintetizarla — pero el
 * jugador no accede a ninguna de las dos hasta que un Médico la analice. Eso le
 * da a `analyze-substance` un rol de puerta y no solo de flavor.
 */
export interface ExtractElementsTaskPayload {
  readonly kind: "extract-elements";
  readonly instanceId: PlacedComponentInstanceId;
  readonly amount: number;
}

export type TaskPayload =
  | DismantleTaskPayload
  | InstallTaskPayload
  | ConnectTaskPayload
  | AnalyzeSubstanceTaskPayload
  | CutPowerTaskPayload
  | PurgeReservoirTaskPayload
  | DischargeSourceTaskPayload
  | TransferSubstanceTaskPayload
  | ApplySubstanceTaskPayload
  | ExtractElementsTaskPayload;

export interface CrewTask {
  readonly id: CrewTaskId;
  readonly actorId: CrewActorId;
  readonly type: TaskType;
  /** Sección donde ocurre la tarea (Fase 5). Opcional para tareas sin lugar fijo. */
  readonly targetSectionId?: SectionId;
  /**
   * Datos del efecto físico (Fase 10b), consumidos por el `TaskEffect` real —
   * no por el scheduler, que sigue sin conocer la semántica de cada tipo.
   * Ausente en tareas sin efecto sobre el plano (`go-to`) o cuyo tipo todavía
   * no tiene payload definido.
   */
  readonly payload?: TaskPayload;
  /** Duración estimada, en segundos simulados. Debe ser > 0 (GDD §4.2: no instantánea). */
  readonly estimatedDurationSeconds: number;
  /**
   * Ids de tareas (posiblemente de OTRO actor) que deben completar antes de
   * arrancar ésta. Mutable: el jugador puede vincular dependencias nuevas en
   * planificación (GDD §4.3), vía `TaskScheduler.linkDependency`, que revalida
   * ciclos antes de aceptar la vinculación.
   */
  dependsOn: CrewTaskId[];
  state: TaskState;
  /** Segundos de ejecución ya transcurridos mientras estuvo `in-progress`. */
  elapsedSeconds: number;
}

/**
 * Piezas atómicas obtenidas como resultado del efecto (hoy solo lo produce
 * `dismantle` de un compuesto, que acredita los ingredientes de su receta al
 * inventario). El scheduler lo reenvía tal cual en `TaskCompletedEvent` para
 * que `/game` pueda mostrar feedback de "obtuviste X" sin recalcular nada
 * (principio 6, legibilidad visual total).
 */
export interface TaskEffectResult {
  readonly obtained?: ReadonlyArray<{
    readonly componentId: ComponentId;
    readonly quantity: number;
    /** Desgaste con el que la pieza volvió al stock (Fase 13c) — `/game` lo muestra en la notificación. */
    readonly wear?: ComponentWear;
    /**
     * `true` si el desmontaje EMPEORÓ el desgaste respecto de lo que la pieza
     * traía (13c, fix de playtest ronda 1). Sin esto `/game` no puede
     * distinguir "el novato rompió algo" de "salió limpio": comparar `wear`
     * contra `nuevo` no alcanza, porque una pieza que ya entraba `usado` y sale
     * `usado` no sufrió nada en ESTE desmontaje.
     */
    readonly degraded?: boolean;
  }>;
  /** Sustancia cuya composición quedó revelada por "Analizar Sustancia" (Fase 11e). */
  readonly analyzedSubstanceId?: ChemicalSubstanceId;
  /**
   * Elementos químicos acreditados al inventario por "Extraer elementos"
   * (Subfase 13e), con repetidos según su proporción — `/game` los muestra en
   * la notificación, igual que `obtained` para las piezas físicas.
   */
  readonly obtainedElements?: ReadonlyArray<ChemicalSubstanceId>;
  /**
   * Unidades que no cupieron al verter/trasvasar y se perdieron (13e). Sirve
   * para avisar al jugador de que midió mal; no es un error.
   */
  readonly overflowAmount?: number;
}

/**
 * Gancho de efecto invocado UNA vez al completar la tarea. Fase 6 lo deja
 * vacío/no-op; Fases 7/9/10 inyectan aquí la mutación real (desmontar el
 * compuesto, materializar la síntesis, instalar en el plano). Mantener el
 * efecto fuera del scheduler preserva la responsabilidad única: el scheduler
 * mide tiempo y resuelve dependencias, no conoce la semántica de cada tipo.
 */
export type TaskEffect = (task: CrewTask) => TaskEffectResult | void;
