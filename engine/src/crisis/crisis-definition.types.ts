import type { Brand } from "../shared/brand.types.js";
import type { GridPosition } from "../geometry/grid-position.types.js";
import type { ComponentId } from "../components/physical-component.types.js";
import type { PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { SignalNodeId } from "../signals/signal-node.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import type { ShipArchetype } from "../floorplan/floorplan.types.js";
import type { CrewDamageCause } from "../crew/crew-events.types.js";
import type { FunctionalProperty } from "../properties/functional.types.js";

export type CrisisDefinitionId = Brand<string, "CrisisDefinitionId">;

/**
 * Trigger del capítulo 1 ("Primer Aviso"): un actuador con `condition ===
 * "jammed"` que bloquea el acceso a una sección. `blockedSectionId` es
 * metadata descriptiva para el evento/UI (GDD no modela ninguna relación
 * formal "este actuador controla el acceso a esta sección" en el plano) — la
 * condición que sí se verifica es únicamente `condition` de la instancia.
 */
export interface JammedActuatorBlocksSectionTriggerSpec {
  readonly kind: "jammed-actuator-blocks-section";
  readonly instanceId: PlacedComponentInstanceId;
  readonly blockedSectionId: SectionId;
}

/**
 * Trigger del capítulo 2 ("Ecos en el Pasillo"): la crisis está activa mientras
 * los dos sensores de movimiento sembrados sigan presentes en el plano — mismo
 * patrón de "presencia de componente" que `jammed-actuator-blocks-section`. Que
 * el jugador desmonte un sensor no es la solución (la resolución es cablear bien
 * el combinador); el trigger deja de aplicar solo si ambos sensores desaparecen,
 * un caso límite fuera del flujo esperado.
 */
export interface MotionSensorsActiveTriggerSpec {
  readonly kind: "motion-sensors-active";
  readonly sensorInstanceIds: ReadonlyArray<PlacedComponentInstanceId>;
}

/** Unión de specs de trigger — extensible por capítulo futuro. */
export type CrisisTriggerSpec =
  | JammedActuatorBlocksSectionTriggerSpec
  | MotionSensorsActiveTriggerSpec;

/**
 * Resolución del capítulo 1: una instancia en `anchorPosition` (misma celda
 * que ocupaba el actuador atascado) con `condition === "ok"` y un
 * `componentDefinitionId` aceptable. Cubre tanto "reparar" (misma instancia,
 * solo cambia `condition`) como "sustituir" (desmontar + instalar una
 * instancia nueva en la misma posición) con la misma regla — la posición es
 * la identidad que importa, no el instanceId.
 */
export interface ReplacementInstalledConnectedResolutionSpec {
  readonly kind: "replacement-installed-connected";
  readonly anchorPosition: GridPosition;
  readonly acceptableComponentDefinitionIds: ReadonlyArray<ComponentId>;
  /** Clave i18n de la meta GENERAL para el checklist de objetivos (no el paso literal). Opcional. */
  readonly objectiveKey?: string;
}

/**
 * Resolución por TAG FUNCIONAL (generaliza `replacement-installed-connected`,
 * principio de diseño #1 de `CLAUDE.md`: "nunca hardcodear combinaciones
 * válidas... las combinaciones deben resolverse por propiedades/tags
 * compartidos"): verdadero cuando la definición instalada en `anchorPosition`,
 * con `condition === "ok"`, declara AL MENOS UNA propiedad funcional con
 * `tag === requiredTag` — sin importar de qué `ComponentId` se trate. Cubre
 * "reparar" y "sustituir" con la misma regla que `replacement-installed-connected`
 * (la posición es la identidad que importa), pero acepta cualquier pieza
 * presente o futura que cumpla la función, no solo una lista cerrada de ids.
 */
export interface FunctionalTagInstalledResolutionSpec {
  readonly kind: "functional-tag-installed";
  readonly anchorPosition: GridPosition;
  readonly requiredTag: FunctionalProperty["tag"];
  /** Clave i18n de la meta GENERAL para el checklist de objetivos (no el paso literal). Opcional. */
  readonly objectiveKey?: string;
}

/**
 * Resolución de señal (capítulo 1, 2º paso): verdadero cuando existe conexión
 * en el grafo de señales entre `fromNodeId` y `toNodeId` — el jugador cablea un
 * nodo emisor (sensor) a un nodo receptor (panel de la compuerta) con el modo
 * cableado. La conectividad se evalúa NO dirigida (ver `SignalNodesWiredRule`):
 * lo que importa para el tutorial es que ambos nodos queden unidos, no el
 * sentido del cable.
 */
export interface SignalNodesWiredResolutionSpec {
  readonly kind: "signal-nodes-wired";
  readonly fromNodeId: SignalNodeId;
  readonly toNodeId: SignalNodeId;
  /** Clave i18n de la meta GENERAL para el checklist de objetivos (no el paso literal). Opcional. */
  readonly objectiveKey?: string;
}

/**
 * Un escenario de la tabla de verdad que el combinador del jugador debe
 * satisfacer (capítulo 2): dado un conjunto de entradas de los sensores
 * (emisores), el nodo de salida debe producir `expected`. Varios casos juntos
 * fuerzan una lógica concreta (p.ej. AND) sin hardcodear "usá una compuerta
 * AND" — cualquier cableado que reproduzca la tabla resuelve (principio 1).
 */
export interface SignalOutputCase {
  readonly inputs: ReadonlyArray<{ readonly nodeId: SignalNodeId; readonly active: boolean }>;
  readonly expected: boolean;
}

/**
 * Resolución de señal por TABLA DE VERDAD (capítulo 2, "Ecos en el Pasillo"):
 * reutiliza `signals/signal-evaluator.ts` (Fase 2) para correr el grafo del
 * `Blueprint` y verificar que `outputNodeId` produce el valor esperado en CADA
 * caso de `cases`. Así el jugador tiene que cablear bien el combinador (que
 * ambos sensores confirmen movimiento real, filtrando ecos de un solo sensor),
 * no solo tocar un cable. Distinta de `signal-nodes-wired` (cap. 1), que solo
 * comprueba conectividad, no el VALOR lógico de la salida.
 */
export interface SignalOutputMatchesResolutionSpec {
  readonly kind: "signal-output-matches";
  readonly outputNodeId: SignalNodeId;
  readonly cases: ReadonlyArray<SignalOutputCase>;
  /** Clave i18n de la meta GENERAL para el checklist de objetivos. Opcional. */
  readonly objectiveKey?: string;
}

/** Unión de specs de resolución — extensible por capítulo futuro (todas deben cumplirse, AND). */
export type CrisisResolutionSpec =
  | ReplacementInstalledConnectedResolutionSpec
  | FunctionalTagInstalledResolutionSpec
  | SignalNodesWiredResolutionSpec
  | SignalOutputMatchesResolutionSpec;

/**
 * `softDeadlineSeconds` ausente = sin amenaza real (capítulo 1: "temporizador
 * suave, sin amenaza de vidas"). Cuando está presente y expira sin
 * resolución, `onExpire` decide el desenlace.
 */
export interface CrisisTimerConfig {
  readonly softDeadlineSeconds: number;
  readonly onExpire: "resolved-failure" | "resolved-partial";
}

export interface TimeLossConsequenceSpec {
  readonly kind: "time-loss";
  readonly severity: "minor" | "moderate" | "severe";
}

/** Severidad cualitativa de daño a tripulante — mapea a `HP_LOSS_FRACTION` (`crew/hp-resolution.ts`). */
export type CrewDamageSeveritySpec = "low" | "medium" | "high";

/**
 * Consecuencia con daño REAL a un tripulante (capítulo 2): si el timer expira a
 * `resolved-failure` con el combinador mal cableado, el sistema automatizado
 * hiere a un tripulante activo. `severity` mapea a `HP_LOSS_FRACTION`
 * (`crew/hp-resolution.ts`); `cause` fija la variante visual de la muerte/daño
 * (GDD 6.8) — `electrocution` para "descarga del sistema automatizado".
 *
 * `lethal` (default `true`): cuando es `false`, el daño hiere pero nunca mata
 * (se pisa el HP en un mínimo > 0) — usado en capítulos tempranos de la demo
 * donde el permadeath se reserva para más adelante.
 *
 * `evaluateCrisis` es puro y no conoce la tripulación: quien INTERPRETA esta
 * consecuencia (aplica el daño, emite el `CrewDomainEvent`) es `CrisisRuntime`
 * (`mission/crisis-runtime.ts`), que sí tiene acceso al estado de la misión.
 */
export interface CrewDamageConsequenceSpec {
  readonly kind: "crew-damage";
  readonly severity: CrewDamageSeveritySpec;
  readonly cause: CrewDamageCause;
  readonly lethal?: boolean;
}

/** Unión de specs de consecuencia — declarativa, interpretada fuera de este dominio. */
export type CrisisConsequenceSpec = TimeLossConsequenceSpec | CrewDamageConsequenceSpec;

/**
 * Sobrecarga scripteada por contenido (Fase 12a, `MissionOverloadRuntime`):
 * a diferencia de la cicatriz de RE (alimentada por corrosión real de la
 * atmósfera, `MissionStructuralRuntime`), no existe ninguna simulación de
 * carga eléctrica/de fluido en el motor — `load`/`capacityOverride` son datos
 * de guion, mismo criterio narrativo que `condition: "jammed"` sembrado en el
 * capítulo 1. `OverloadRule.evaluate` sigue siendo la única lógica que decide
 * si dispara: el guion solo aporta el sujeto, no el resultado.
 */
export interface ScriptedOverloadSubject {
  readonly instanceId: PlacedComponentInstanceId;
  readonly load: number;
  /** Capacidad efectiva en el momento del guion; si se omite, usa la capacidad de catálogo. */
  readonly capacityOverride?: number;
}

/**
 * Castigo progresivo por dilación (capítulo 2): mientras la crisis está activa y
 * el timer corre, a partir de `startFraction` del `softDeadlineSeconds` el
 * sistema automatizado electrocuta a un tripulante cada `intervalSeconds`.
 * Demorar CUESTA HP — hace que el temporizador visible importe. Declarativo;
 * lo interpreta `CrisisRuntime`, no el dominio puro `evaluateCrisis`. `lethal`
 * (default `true`) igual que en `CrewDamageConsequenceSpec`.
 */
export interface CrisisHazardSchedule {
  readonly kind: "periodic-crew-damage";
  /** Fracción del `softDeadlineSeconds` a partir de la cual empiezan las descargas (0..1). */
  readonly startFraction: number;
  readonly intervalSeconds: number;
  readonly severity: CrewDamageSeveritySpec;
  readonly cause: CrewDamageCause;
  readonly lethal?: boolean;
}

/**
 * Contenido declarativo de una crisis (GDD §15.3: "cada crisis se define como
 * una secuencia de fallos/triggers con sus condiciones, temporización y
 * dependencia de cicatrices"). Vive como datos importables — nunca literales
 * dentro de la lógica que los consume (`crisis-machine.ts`).
 */
export interface CrisisDefinition {
  readonly id: CrisisDefinitionId;
  readonly chapterOrder: number;
  readonly name: string;
  /**
   * Clave de traducción del resumen mostrado al jugador al entrar a la misión
   * (Fase 10d, GDD §4 paso 1: "crisis se dispara" ocurre ANTES de que
   * arranque la planificación). Opcional — un capítulo sin contenido de
   * briefing todavía autorado simplemente no muestra el popup, en vez de
   * forzar texto inventado (`docs/Primeras_8_crisis.md` marca la narrativa de
   * cada capítulo como pendiente de definir).
   */
  readonly briefingKey?: string;
  /** Arquetipo sobre el que se autoró el contenido concreto (ids de instancia/posición). */
  readonly archetypeHint?: ShipArchetype;
  /** Todos los triggers deben aplicar (AND) para pasar a `active`. */
  readonly triggers: ReadonlyArray<CrisisTriggerSpec>;
  /** Todas las resoluciones deben aplicar (AND) para pasar a `resolved-success`. */
  readonly resolutions: ReadonlyArray<CrisisResolutionSpec>;
  readonly timer?: CrisisTimerConfig;
  readonly consequence: CrisisConsequenceSpec;
  /** Castigo progresivo mientras el timer corre (capítulo 2). Opcional. */
  readonly hazard?: CrisisHazardSchedule;
  /** Conductos/reservorios que entran en sobrecarga por guion (Fase 12a). Opcional, default ninguno. */
  readonly scriptedOverloads?: ReadonlyArray<ScriptedOverloadSubject>;
}
