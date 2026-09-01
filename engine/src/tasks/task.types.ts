import type { Brand } from "../shared/brand.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import type { CrewActorId } from "../crew/crew-actor.types.js";
import type { PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { ComponentId } from "../components/physical-component.types.js";
import type { GridPosition, PlacedFootprint } from "../geometry/grid-position.types.js";
import type { SignalEdgeId } from "../signals/signal-edge.types.js";
import type { SignalNodeId } from "../signals/signal-node.types.js";
import type { ComponentWear } from "../wear/wear.types.js";
import type { ChemicalSubstanceId } from "../chemistry/chemical-substance.types.js";
import type { ConduitId } from "../floorplan/floorplan.types.js";
import type { DoorId } from "../doors/door.types.js";

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
  // Subfase 14a-4 — retirar un cable tendido (típicamente uno quemado).
  | "disconnect"
  | "analyze-substance"
  // Subfase 13d — tareas de ASEGURADO previas a un desmontaje peligroso.
  | "cut-power"
  | "purge-reservoir"
  | "discharge-source"
  // Subfase 13e — ciclo de vida real de una sustancia: extraer → sintetizar →
  // almacenar → transportar → aplicar.
  | "transfer-substance"
  | "apply-substance"
  | "extract-elements"
  // Subfase 13h — aislamiento deliberado (GDD §5.5): operar la nave como
  // compartimentos en vez de como una sola burbuja de aire.
  | "set-valve"
  | "force-door"
  | "repair-door";

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
  /**
   * Instalar un COMPUESTO de catálogo consumiendo su receta (ronda 7 de
   * fixes de playtest 13e): las creaciones personalizadas del jugador
   * (`customCreations`) se instalan gratis (ya "pagaron" al ensamblarse en la
   * mesa de creación) — este flag distingue ese caso del de un compuesto de
   * catálogo (ej. un segundo reservorio) instalado directo desde
   * "Inventario", que sí debe gastar los ingredientes de `recipe.ingredients`.
   * Ausente/`false` = comportamiento de siempre (compuesto gratis, atómico
   * consume su propio stock).
   */
  readonly consumeRecipe?: boolean;
}

export interface ConnectTaskPayload {
  readonly kind: "connect";
  readonly edgeId: SignalEdgeId;
  readonly fromNodeId: SignalNodeId;
  readonly toNodeId: SignalNodeId;
  readonly toPort?: string;
  /**
   * Pieza conductora con la que se tiende el cable (Subfase 14a-4). El jugador
   * la elige en el selector de cableado, igual que elige el bucket de desgaste
   * al instalar; de acá sale la `maxCapacity` de la arista.
   *
   * Opcional solo para no romper los tests unitarios que ejercitan `connect`
   * con nodos sintéticos: sin conductor la tarea NO consume stock y la arista
   * cae al default de migración (cobre). En juego real siempre viene.
   */
  readonly conductorId?: ComponentId;
  /** Bucket de desgaste del que se toma el cable (14a-4). Ausente = `nuevo`. */
  readonly conductorWear?: ComponentWear;
  /**
   * El conductor es un COMPUESTO de catálogo (fibra, blindado) y se paga con su
   * receta en vez de con una unidad propia — mismo mecanismo y mismo flag que
   * `InstallTaskPayload.consumeRecipe`.
   */
  readonly consumeRecipe?: boolean;
}

/**
 * Retirar un cable ya tendido (Subfase 14a-4). Es el camino de salida de la
 * cicatriz: un cable quemado corta la señal para siempre, y sin una forma de
 * sacarlo el montaje quedaba en un callejón sin salida.
 *
 * **No devuelve nada al stock** (decisión del operador, 2026-09-01): la pieza se
 * perdió en el corto. Retender cuesta otro conductor — Pilar 5 de CLAUDE.md,
 * ninguna reparación es gratis. Por eso no comparte el camino de `dismantle`,
 * que sí acredita.
 */
export interface DisconnectTaskPayload {
  readonly kind: "disconnect";
  readonly edgeId: SignalEdgeId;
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
 * un reservorio antes de desmontarlo.
 *
 * Hasta 13e la sustancia se venteaba a la nada, porque no existía un destino
 * real para las sustancias (deuda #9). Ese destino ya existe, así que la purga
 * **vuelca en la atmósfera de la sección** igual que `apply-substance`: purgar
 * agua es inofensivo, purgar un tóxico contamina la sala. La diferencia entre
 * las dos tareas es la INTENCIÓN (asegurar la pieza vs. usar la sustancia), no
 * el destino — y así la pérdida se ve en pantalla en vez de desaparecer sin
 * rastro (principio 6).
 */
export interface PurgeReservoirTaskPayload {
  readonly kind: "purge-reservoir";
  readonly instanceId: PlacedComponentInstanceId;
  /**
   * Sección que recibe lo purgado. La resuelve el llamador, que ya la calcula
   * para el viaje. Opcional porque el plano puede no resolverla: en ese caso el
   * reservorio se vacía igual (la purga NUNCA debe fallar, es la vía de escape
   * del hazard de 13d) y solo se pierde el volcado — mismo criterio fail-open
   * que `assertFluidTransferReachable`.
   */
  readonly sectionId?: SectionId;
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

/**
 * "Operar válvula" (Subfase 13h, GDD §5.5): abrir o cerrar la válvula de un
 * conducto de ventilación para contener una fuga o drenar el O2 de una sección.
 *
 * Es tarea de tripulante y no un toggle de UI a propósito: nada en este juego
 * cambia el estado físico de la nave sin que alguien vaya y lo haga, y el
 * tiempo que cuesta llegar hasta la válvula es justamente lo que convierte
 * "contener la fuga" en una decisión y no en un reflejo.
 */
export interface SetValveTaskPayload {
  readonly kind: "set-valve";
  readonly conduitId: ConduitId;
  /** Apertura destino en [0,1]. */
  readonly targetAperture: number;
  readonly sectionId: SectionId;
}

/**
 * "Forzar puerta" (Subfase 13h): abrir a mano una puerta que se quedó sin
 * motor. Lenta y modulada por la fuerza del actuador que hay que vencer.
 *
 * Le da a `cut-power` (13d) una consecuencia que hasta ahora no tenía: cortar
 * la energía de una sección para desmontar sin chispas también decide si esa
 * sección queda sellada o abierta de par en par.
 */
export interface ForceDoorTaskPayload {
  readonly kind: "force-door";
  readonly doorId: DoorId;
  readonly sectionId: SectionId;
}

/** "Reparar puerta" (Subfase 13h): devuelve al servicio una hoja rota o trabada por daño. */
export interface RepairDoorTaskPayload {
  readonly kind: "repair-door";
  readonly doorId: DoorId;
  readonly sectionId: SectionId;
}

export type TaskPayload =
  | DismantleTaskPayload
  | InstallTaskPayload
  | ConnectTaskPayload
  | DisconnectTaskPayload
  | AnalyzeSubstanceTaskPayload
  | CutPowerTaskPayload
  | PurgeReservoirTaskPayload
  | DischargeSourceTaskPayload
  | TransferSubstanceTaskPayload
  | ApplySubstanceTaskPayload
  | ExtractElementsTaskPayload
  | SetValveTaskPayload
  | ForceDoorTaskPayload
  | RepairDoorTaskPayload;

export interface CrewTask {
  readonly id: CrewTaskId;
  readonly actorId: CrewActorId;
  readonly type: TaskType;
  /** Sección donde ocurre la tarea (Fase 5). Opcional para tareas sin lugar fijo. */
  readonly targetSectionId?: SectionId;
  /**
   * Celda EXACTA de destino (13f ronda 3). Hermano de `targetSectionId` —los
   * dos son "dónde"— y no un `payload`, que sigue reservado a los datos del
   * efecto físico.
   *
   * Existe porque hasta ahora un `go-to` solo apuntaba a una sección: el token
   * caminaba a una celda concreta únicamente cuando había una acción encolada
   * detrás (de la que se derivaba el destino). Mover a alguien a un punto
   * elegido —lo que el jugador hace con click derecho— no tenía forma de
   * expresarse.
   */
  readonly targetCell?: GridPosition;
  /**
   * Secciones que deben tener energía otorgada para que la tarea corra (ronda
   * 11 de fixes de playtest 13e, "sin energía, la máquina no actúa"). Campo
   * independiente de `targetSectionId`: trabajo manual del tripulante (ir a
   * una sección, instalar, conectar) no lo declara y nunca se gatea; una
   * tarea que mueve sustancia entre dos secciones (transferir, aplicar)
   * declara AMBAS, no solo la de origen.
   */
  readonly powerSectionIds?: ReadonlyArray<SectionId>;
  /**
   * Instancias que deben tener su demanda satisfecha para que la tarea corra
   * (Subfase 13g). Hermano de `powerSectionIds` un nivel más fino: la sección
   * puede tener unidades y el triaje de prioridad dejar sin energía justo a la
   * mesa con la que se trabaja. Lo declaran las tareas que se hacen CON una
   * máquina (fabricar, sintetizar, analizar, extraer); el trabajo manual del
   * tripulante no, y nunca se gatea.
   *
   * Es además el único sitio donde una tarea `combine` conserva de qué mesa
   * habla: su `payload` sigue sin definirse y la instancia solo vivía en un map
   * lateral de `/game`.
   */
  readonly powerInstanceIds?: ReadonlyArray<PlacedComponentInstanceId>;
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
  /**
   * Sustancia y cantidad volcadas sobre la atmósfera de una sección (13e, fix
   * de playtest ronda 2). Un solo par para `apply-substance` y
   * `purge-reservoir` porque es el mismo fenómeno físico; quien consume el
   * evento distingue la intención por `type`, que ya viaja en él.
   */
  readonly pouredSubstanceId?: ChemicalSubstanceId;
  readonly pouredAmount?: number;
}

/**
 * Gancho de efecto invocado UNA vez al completar la tarea. Fase 6 lo deja
 * vacío/no-op; Fases 7/9/10 inyectan aquí la mutación real (desmontar el
 * compuesto, materializar la síntesis, instalar en el plano). Mantener el
 * efecto fuera del scheduler preserva la responsabilidad única: el scheduler
 * mide tiempo y resuelve dependencias, no conoce la semántica de cada tipo.
 */
export type TaskEffect = (task: CrewTask) => TaskEffectResult | void;
