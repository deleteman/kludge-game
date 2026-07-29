import type { Brand } from "../shared/brand.types.js";
import type { PlacedFootprint } from "../geometry/grid-position.types.js";
import type { ComponentId } from "../components/physical-component.types.js";
import type { ChemicalSubstanceId } from "../chemistry/chemical-substance.types.js";
import type { SignalGraph } from "../signals/signal-graph.types.js";
import type { StructuralResistanceLevel } from "../properties/material.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import type { SectionAtmosphereSnapshot } from "../atmosphere/atmosphere-snapshot.types.js";

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
   * Cicatriz de RE (Fase 11b): nivel de resistencia estructural degradado de
   * forma permanente por `StructuralIntegrity`, distinto del RE de catálogo
   * de `componentDefinitionId`. Ausente = sin degradar, se usa el RE de
   * catálogo. Nunca sube: solo `MissionStructuralRuntime` lo escribe, y solo
   * hacia un nivel peor.
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
  /** Cicatriz de energía (Fase 11b): secciones sin suministro, ver `MissionSignalRuntime`. */
  readonly unpoweredSectionIds: ReadonlyArray<SectionId>;
  /** Cicatriz de sobrecarga (Fase 12a): refs de conducto/reservorio en cortocircuito permanente, ver `MissionOverloadRuntime`. */
  readonly overloadedRefs: ReadonlyArray<PlacedComponentInstanceId>;
}
