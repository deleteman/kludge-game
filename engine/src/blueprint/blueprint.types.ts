import type { Brand } from "../shared/brand.types.js";
import type { PlacedFootprint } from "../geometry/grid-position.types.js";
import type { ComponentId } from "../components/physical-component.types.js";
import type { ChemicalSubstanceId } from "../chemistry/chemical-substance.types.js";
import type { SignalGraph } from "../signals/signal-graph.types.js";
import type { StructuralResistanceLevel } from "../properties/material.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import type { SectionAtmosphereSnapshot } from "../atmosphere/atmosphere-snapshot.types.js";
import type { SectionIntegritySnapshot } from "../integrity/section-integrity.types.js";
import type { PowerState } from "../power/power.types.js";
import type { ComponentWear } from "../wear/wear.types.js";

/**
 * Blueprint schema — PRIMER INTENTO, PROVISIONAL (GDD sección 17: "formato
 * exacto del archivo de blueprint (schema JSON)... pendiente"). Diseñado
 * ahora por decisión explícita del operador (Fase 1), revisado contra:
 *  - Fase 5 (plano físico real / adyacencia de secciones exportada de Tiled),
 *  - Fase 7 (`workbench/`): `PlacedFootprint` tal cual alcanza sin cambios —
 *    la rotación al instalar solo afecta el rectángulo exterior (decisión
 *    confirmada con el operador); el footprint real de un compuesto vive en
 *    `CompositeComponentData.footprint` (`components/physical-component.types.ts`),
 *    no en este schema. Sin bump de `schemaVersion` por Fase 7.
 * No asumir compatibilidad binaria entre valores distintos de schemaVersion.
 *
 * Fase 6: el placeholder `crewTaskDependencies` se eliminó de este schema. Las
 * colas de tareas y sus dependencias son ESTADO DE SESIÓN RUNTIME (dominio
 * `tasks/`, autorado por el jugador durante la crisis), no estado estático de
 * la nave — mezclarlos era el error que el placeholder marcaba PROVISIONAL.
 * Serializar una partida en curso (con colas a medias) es un tema de save-system
 * para Fase 11, con su propio formato, no parte del blueprint de la nave.
 *
 * Fase 10a: `schemaVersion` 2→3 — se añade `PlacedComponentInstance.condition`
 * (GDD no lo modelaba: no existía ningún concepto de "componente
 * dañado/atascado"). Campo genérico y reutilizable por decisión explícita del
 * operador, no estado oculto local a una crisis — el capítulo 1 de campaña
 * ("Primer Aviso", `crisis/campaign/chapter-01-primer-aviso.ts`) es el primer
 * consumidor, pero cualquier crisis futura con un componente roto/atascado
 * reutiliza este mismo campo sin volver a tocar el schema.
 *
 * Fase 11b: `schemaVersion` 3→4 — sistema de guardado dinámico y cicatrices
 * persistentes (`nuevo-orden.md`, Subfase 11b). Se añaden tres campos, los
 * tres opcionales/con default para que un save v3 cargue sin migración
 * formal (mismo criterio que `condition` en el bump anterior):
 *  - `Blueprint.sectionAtmospheres`: snapshot serializable (`Map` → array de
 *    pares) de la composición de gases/temperatura/presión por sección al
 *    cerrar la misión — antes de esta fase ninguna atmósfera viva existía en
 *    una misión real (`MissionAtmosphereRuntime`, Fase 11b).
 *  - `Blueprint.unpoweredSectionIds`: cicatriz de "sección sin suministro
 *    energético" — fuerza `output = false` en los nodos de señal de esa
 *    sección (`MissionSignalRuntime`), sin importar cableado/reservorio.
 *  - `PlacedComponentInstance.structuralResistanceOverride`: cicatriz de RE
 *    reducido de forma permanente sobre una instancia puntual, resultado de
 *    `StructuralIntegrity` (`failure/structural-failure.ts`) cableada en vivo
 *    por primera vez (`MissionStructuralRuntime`, Fase 11b) — antes existía
 *    la clase pero ningún llamador de producción.
 *
 * Fase 12a: `schemaVersion` 4→5 — se añade `Blueprint.overloadedRefs`, cicatriz
 * persistente de "conductor/reservorio en cortocircuito" (`OverloadRule`,
 * `failure/overload-rule.ts`), cableada en vivo por primera vez
 * (`MissionOverloadRuntime`, `mission/mission-overload-runtime.ts`) — misma
 * situación que tenía `StructuralIntegrity` antes de 11b: la regla existía y
 * estaba testeada (caso de validación 2) pero sin ningún llamador de
 * producción. A diferencia de la cicatriz de RE (alimentada por corrosión
 * real de la atmósfera), no existe ninguna simulación de carga eléctrica en
 * el motor — `load`/`capacity` son datos scripteados por la crisis
 * (`CrisisDefinition.scriptedOverloads`), mismo criterio narrativo que
 * `condition: "jammed"` sembrado en el capítulo 1.
 *
 * Fase 13b: `schemaVersion` 5→6 — se añade `Blueprint.powerState` (dominio
 * `power/`, presupuesto de energía estilo FTL en unidades discretas). Con
 * esto, `unpoweredSectionIds` deja de ser la cicatriz autoritativa en sí
 * misma y pasa a ser un campo DERIVADO: `MissionPowerRuntime` lo recalcula y
 * reescribe cada tick como la unión de `powerState.permanentlyDisconnectedSectionIds`
 * (cicatriz real, ej. sacrificio del Cap.5) y las secciones con déficit de
 * asignación viva en la sesión actual. Se mantiene un único campo público
 * (decisión explícita del operador) para no duplicar la superficie que ya
 * consumen `MissionSignalRuntime`/UI — la distinción entre cicatriz
 * permanente y triaje táctico de sesión vive puertas adentro, en
 * `powerState.permanentlyDisconnectedSectionIds`, para que un apagón elegido
 * por el jugador en una misión no se filtre como cicatriz definitiva del
 * guardado de campaña.
 *
 * Fase 13c: `schemaVersion` 6→7 — se añade `PlacedComponentInstance.wear`
 * (dominio `wear/`, degradación funcional estilo Duskers). Con esto
 * `structuralResistanceOverride` queda DEPRECADO: pasa a ser un campo de solo
 * lectura para migrar saves ≤ v6, y la resistencia efectiva se deriva de
 * `RE de catálogo + wear` en un único lugar (`wear/effective-resistance.ts`).
 * El motivo del reemplazo es que la corrosión escribía RE directamente y el
 * desgaste iba a modificar la RE efectiva: mantener ambos habría contado el
 * mismo daño dos veces sobre la misma pieza. Un solo eje, mapeado 1:1, así que
 * el ritmo de degradación por corrosión de la Espec. §1 no cambió.
 *
 * Subfase 13d (fix de playtest ronda 1): `schemaVersion` 7→8 — se añade
 * `PowerState.dischargedSourceIds`. Es el único estado del riesgo de
 * canibalización que se persiste: el resto se deriva del mundo (si la sección
 * tiene energía, si el reservorio tiene contenido), pero la carga de una
 * batería no tiene ninguna representación de la que derivarla. Una fuente
 * descargada deja de aportar al presupuesto de energía y deja de ser peligrosa
 * de desmontar; no se recarga (principio 5).
 *
 * Subfase 13f: `schemaVersion` 8→9 — se añade `Blueprint.sectionIntegrity`, la
 * vida de casco por sección. Reemplaza el modelo de 11g, donde la integridad
 * se DERIVABA del `RE` de las piezas instaladas (una manguera contaba como
 * casco); ahora las secciones tienen vida propia, dañada por impacto,
 * explosión, corrosión y descompresión. Una sección colapsada queda brechada
 * para siempre: sellarla detiene la fuga, no le devuelve la vida.
 */
export interface BlueprintMetadata {
  readonly schemaVersion: number;
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  /** ENGINE_VERSION al momento de autoría, para diagnosticar incompatibilidades futuras. */
  readonly engineVersion: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type PlacedComponentInstanceId = Brand<string, "PlacedComponentInstanceId">;

/**
 * `"ok"`: funcional con normalidad. `"jammed"`: instalado pero no responde
 * (ej. actuador atascado, capítulo 1) — requiere intervención de tripulación
 * para volver a `"ok"`, no se repara solo. `"destroyed"`: inutilizable, solo
 * desmontable (recuperación atómica reducida, GDD 6.5).
 */
export type ComponentCondition = "ok" | "jammed" | "destroyed";

export interface PlacedComponentInstance {
  readonly instanceId: PlacedComponentInstanceId;
  /** Referencia al catálogo de definiciones (Fase 4) — no se embebe la definición completa. */
  readonly componentDefinitionId: ComponentId;
  readonly placement: PlacedFootprint;
  readonly condition: ComponentCondition;
  /**
   * Desgaste acumulado (Fase 13c, dominio `wear/`). Eje ORTOGONAL a
   * `condition`: esta pieza responde con normalidad, pero es más frágil —
   * menos RE efectiva y menos capacidad ante sobrecarga. Escrito por la
   * canibalización (`ship-task-effect.ts`) y por la exposición corrosiva
   * (`MissionStructuralRuntime`). Nunca mejora (principio 5 de CLAUDE.md).
   */
  readonly wear: ComponentWear;
  /**
   * @deprecated Desde la Fase 13c. Cicatriz de RE de la Fase 11b: nivel de
   * resistencia estructural degradado de forma permanente por
   * `StructuralIntegrity`. Ningún runtime lo escribe ya — la resistencia
   * efectiva se deriva de `RE de catálogo + wear`
   * (`wear/effective-resistance.ts`). Se conserva SOLO por retrocompatibilidad
   * de saves ≤ v6: `effectiveResistance()` lo recibe como tercer argumento y
   * se queda con el PEOR de los dos ejes, así una cicatriz vieja no se pierde.
   * No leerlo directamente desde código nuevo.
   */
  readonly structuralResistanceOverride?: StructuralResistanceLevel;
}

export interface ReservoirContent {
  /** Debe apuntar a una instancia cuya definición declare la propiedad funcional RES. */
  readonly componentInstanceId: PlacedComponentInstanceId;
  readonly substanceId: ChemicalSubstanceId;
  readonly amount: number;
}

export interface Blueprint {
  readonly metadata: BlueprintMetadata;
  readonly placedComponents: ReadonlyArray<PlacedComponentInstance>;
  readonly reservoirContents: ReadonlyArray<ReservoirContent>;
  readonly signalGraph: SignalGraph<PlacedComponentInstanceId>;
  /** Atmósfera viva por sección al momento de guardar (Fase 11b). */
  readonly sectionAtmospheres: ReadonlyArray<SectionAtmosphereSnapshot>;
  /**
   * Vida de casco por sección (Subfase 13f), incluida la cicatriz de una
   * sección colapsada. Mismo molde que `sectionAtmospheres`. Es el callback de
   * cicatriz estructural que `docs/Primeras_8_crisis.md` pide para los Cap. 3,
   * 6, 7 y 8 ("la sección afectada queda con RE reducida, cicatriz que
   * reaparece en el capítulo 7").
   */
  readonly sectionIntegrity: ReadonlyArray<SectionIntegritySnapshot>;
  /**
   * Secciones sin suministro eléctrico, ver `MissionSignalRuntime`. Desde la
   * Fase 13b es un campo DERIVADO: `MissionPowerRuntime` lo recalcula cada
   * tick como `powerState.permanentlyDisconnectedSectionIds` ∪ secciones con
   * déficit de asignación viva — no escribir este campo directamente fuera
   * de ese runtime (para cicatrices permanentes, escribir
   * `powerState.permanentlyDisconnectedSectionIds`).
   */
  readonly unpoweredSectionIds: ReadonlyArray<SectionId>;
  /** Cicatriz de sobrecarga (Fase 12a): refs de conducto/reservorio en cortocircuito permanente, ver `MissionOverloadRuntime`. */
  readonly overloadedRefs: ReadonlyArray<PlacedComponentInstanceId>;
  /** Presupuesto de energía y prioridades del jugador (Fase 13b), ver `power/power.types.ts`. */
  readonly powerState: PowerState;
}
