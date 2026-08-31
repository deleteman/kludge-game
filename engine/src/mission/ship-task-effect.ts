import type {
  Blueprint,
  PlacedComponentInstance,
  PlacedComponentInstanceId,
} from "../blueprint/blueprint.types.js";
import type { ComponentId, PhysicalComponentDefinition } from "../components/physical-component.types.js";
import type { CrewActor, CrewActorId } from "../crew/crew-actor.types.js";
import type { CrewSpecialty } from "../crew/crew-specialty.types.js";
import type { CrewTier } from "../crew/crew-tier.types.js";
import type { StructuralResistanceLevel } from "../properties/material.types.js";
import type { RandomSource } from "../simulation/random-source.js";
import { DEFAULT_WEAR, worsenWear } from "../wear/wear.types.js";
import { effectiveResistance } from "../wear/effective-resistance.js";
import { wearAfterDismantle } from "../wear/dismantle-wear.js";
import type { EntityRegistry } from "../composition/entity-registry.js";
import { isCompositeEntity } from "../composition/composable-entity.types.js";
import type { CrewTask, InstallTaskPayload, TaskEffect, TaskEffectResult } from "../tasks/task.types.js";
import { deriveSignalNodes } from "../workbench/derive-signal-nodes.js";
import { assertSignalWiringReachable, mergeInstalledSignalGraph, wireExternalPort } from "../workbench/port-wiring.js";
import type { ShipFloorplan } from "../floorplan/floorplan.types.js";
import { sectionContainingCell } from "../floorplan/floorplan.types.js";
import type { SectionAtmosphere, SectionId } from "../atmosphere/section.types.js";
import type { DismantleHazardContext } from "../salvage/dismantle-hazard-rules.js";
import type { DismantleHazardHandlerDeps } from "../salvage/dismantle-hazard-handler.js";
import {
  applyDismantleHazardDamage,
  handleDismantleHazards,
} from "../salvage/dismantle-hazard-handler.js";
import type { MutableShipState } from "./mutable-ship-state.js";
import type { ValveRuntime } from "../valves/valve-runtime.js";
import type { MissionDoorRuntime } from "./mission-door-runtime.js";
import { consumeStock, creditStock } from "../inventory/inventory-ledger.js";
import type { MutableAtomicStock } from "../inventory/mutable-atomic-stock.js";
import { creditElementList } from "../inventory/element-ledger.js";
import { deriveInitialReservoirContents } from "../reservoir/initial-reservoir-contents.js";
import { FACTORY_RESERVOIR_CONTENTS } from "../reservoir/factory-reservoir-contents.js";
import type { MutableElementStock } from "../inventory/mutable-element-stock.js";
import { contentOf, drawFrom, freeCapacity, pourInto } from "../reservoir/reservoir-ledger.js";
import { instanceReservoirCapacity } from "../reservoir/reservoir-query.js";
import { assertFluidTransferReachable } from "../reservoir/fluid-transfer-reachability.js";
import { elementsFromAmount } from "../reservoir/substance-composition.js";
import type { SubstanceCompositionContext } from "../reservoir/substance-composition.js";
import type { TransientGasInjection } from "./section-gas-injection.js";

type ComponentRegistry = EntityRegistry<ComponentId, PhysicalComponentDefinition>;

export class InsufficientStockError extends Error {}

/**
 * `TaskEffect` real (Fase 10b): la mutación física que Fase 6 dejó como hook
 * vacío. Solo maneja `dismantle`/`install`/`connect` — los tipos que el
 * capítulo 1 ejercita (`tasks/task.types.ts::TaskPayload`); una tarea sin
 * payload (`go-to`, o un tipo aún sin payload definido) es un no-op aquí,
 * consistente con que el scheduler ya resuelve la ubicación lógica de
 * `go-to` internamente (`task-scheduler.ts::completeTask`).
 */
/**
 * Dependencias opcionales de 13c. Van juntas porque las tres sirven al mismo
 * cálculo (¿con qué desgaste vuelve la pieza al stock?) y porque sin ellas el
 * efecto se comporta EXACTAMENTE como antes de 13c — sin degradar nada. Eso
 * mantiene compilando los tests unitarios que ejercitan desmontaje sin actor.
 */
/**
 * Dependencias opcionales de 13d (riesgo sistémico al desmontar). Igual que
 * `DismantleWearDeps`: sin ellas el efecto se comporta EXACTAMENTE como antes
 * de 13d — ningún hazard, ningún daño. Solo la misión real las cablea.
 */
export interface SalvageHazardDeps {
  /**
   * ¿La sección tiene unidades OTORGADAS por el reparto de 13b? (fix de
   * playtest ronda 1: antes se inyectaba `isInstancePowered`, que significa
   * "su demanda está satisfecha" y daba `true` para cualquier pieza sin
   * `powerDraw` incluso con la sección a 0 — ver `instance-energized.ts`).
   * `/game` inyecta el complemento de `sectionHasNoPowerGranted`, el MISMO
   * dato que pinta el efecto visual de zona oscura.
   */
  readonly sectionHasGrantedPower?: (sectionId: SectionId) => boolean;
  /** Atmósfera VIVA de la sección donde está la pieza (`MissionAtmosphereRuntime`). */
  readonly atmosphereOf?: (sectionId: SectionId) => SectionAtmosphere | undefined;
  /** Tiempo simulado del tick en que se completa la tarea, para los eventos de dominio. */
  readonly elapsedSecondsOf?: () => number;
  readonly handler?: DismantleHazardHandlerDeps;
}

/**
 * Dependencias opcionales de 13e (destino real de sustancias). Mismo criterio
 * que `SalvageHazardDeps`: sin ellas, las tres tareas nuevas son un no-op y
 * nada del comportamiento anterior cambia. Solo la misión real las cablea.
 */
export interface SubstanceFlowDeps {
  /** Inventario vivo de elementos, al que acredita "Extraer elementos". */
  readonly elementStock?: MutableElementStock;
  /** Buffer de inyección atmosférica, al que escribe "Aplicar sustancia". */
  readonly gasInjection?: TransientGasInjection;
  /**
   * Catálogo químico + procedencia + analizadas, para resolver la composición.
   * Es una FUNCIÓN y no un objeto porque se consulta en cada ejecución de
   * tarea: una sustancia analizada a mitad de misión tiene que contar, y una
   * foto tomada al construir el runtime no lo reflejaría.
   */
  readonly composition?: () => SubstanceCompositionContext;
}

export interface DismantleWearDeps {
  /** Azar inyectado; sin él el desmontaje nunca degrada (ver `wear/dismantle-wear.ts`). */
  readonly random?: RandomSource;
  /**
   * Resuelve el actor de la tarea. Hasta 13c el `TaskEffect` recibía la
   * `CrewTask` (con su `actorId`) pero no tenía forma de llegar al tripulante,
   * así que no podía leer su tier/especialidad — es lo único que faltaba para
   * aplicar la tabla de GDD §6.5.
   */
  readonly actorOf?: (actorId: CrewActorId) => CrewActor | undefined;
}

/**
 * Dependencias opcionales de 13h (puertas y compartimentación). Mismo criterio
 * que `SalvageHazardDeps` y `SubstanceFlowDeps`: sin ellas las tres tareas
 * nuevas son un no-op y nada del comportamiento anterior cambia.
 *
 * Se inyectan los runtimes y no el `Blueprint` porque la apertura de una
 * válvula y el estado de una puerta son estado VIVO de misión, no dato del
 * blueprint: al blueprint solo bajan al guardar (`toSnapshots`). Escribirlos
 * vía `shipState.set()` crearía una segunda fuente de verdad que se
 * desincronizaría con el runtime a mitad de tick.
 */
export interface CompartmentDeps {
  readonly valves?: ValveRuntime;
  readonly doors?: MissionDoorRuntime;
  readonly elapsedSecondsOf?: () => number;
}

export function createShipTaskEffect(
  shipState: MutableShipState,
  componentRegistry: ComponentRegistry,
  atomicStock: MutableAtomicStock,
  // Opcional para no romper los tests unitarios que ejercitan `connect` con
  // nodos sintéticos sin geometría: cuando el llamador real (misión) lo pasa,
  // el `connect` valida la regla de conductos `senal` (Fase 11f); sin él, se
  // comporta como antes. El preview del controller de `/game` es el gate de UX
  // que evita encolar un cable inalcanzable, así que en juego real nunca llega
  // acá un `connect` que viole la regla — esto es defensa en profundidad.
  floorplan?: ShipFloorplan,
  wearDeps: DismantleWearDeps = {},
  salvageDeps: SalvageHazardDeps = {},
  substanceDeps: SubstanceFlowDeps = {},
  compartmentDeps: CompartmentDeps = {},
): TaskEffect {
  return (task: CrewTask): TaskEffectResult | void => {
    const payload = task.payload;
    if (!payload) {
      return;
    }
    if (payload.kind !== task.type) {
      throw new Error(
        `Task ${task.id}: type "${task.type}" does not match payload kind "${payload.kind}"`,
      );
    }

    switch (payload.kind) {
      case "dismantle": {
        const instance = shipState
          .get()
          .placedComponents.find((entry) => entry.instanceId === payload.instanceId);
        const definition = componentRegistry.get(instance?.componentDefinitionId as ComponentId);
        // Desgaste con el que la pieza vuelve al stock (13c): tirada por tier
        // del especialista contra la RE efectiva que la pieza tiene AHORA. La
        // consecuencia de canibalizar deja de ser gratis — desmontar y volver
        // a instalar ya no devuelve una pieza de fábrica (Pilar 2).
        const rolledWear = instance
          ? wearAfterDismantle(
              {
                current: instance.wear,
                ...resolveActorTraits(task.actorId, wearDeps.actorOf),
                ...degradableResistance(instance, definition),
              },
              wearDeps.random,
            )
          : DEFAULT_WEAR;
        // Riesgo sistémico (13d): el mundo hay que leerlo con la pieza TODAVÍA
        // puesta — después de `dismantleInstance` nada estaría energizado ni
        // tendría contenido, y todo desmontaje parecería seguro.
        const hazard = instance
          ? handleDismantleHazards(
              dismantleHazardContext(shipState.get(), instance, floorplan, salvageDeps, componentRegistry),
              salvageDeps.handler ?? {},
            )
          : undefined;
        if (hazard?.events.length) {
          applyDismantleHazardDamage(
            task.actorId,
            hazard.events,
            salvageDeps.elapsedSecondsOf?.() ?? 0,
            salvageDeps.handler ?? {},
          );
          // El derrame llega a la ATMÓSFERA de la sección (13e, fix de playtest
          // ronda 2). Hasta acá `dismantle-spill` emitía su evento y pintaba un
          // charco, pero la sustancia moría con la instancia: el derrame era
          // cosmético y desmontar un tanque lleno de tóxico no contaminaba
          // nada. Se reusa la decisión de la regla (`substanceId`/`amount` del
          // evento) en vez de volver a inspeccionar `reservoirContents`.
          for (const event of hazard.events) {
            if (event.kind === "dismantle-spill" && event.sectionId) {
              substanceDeps.gasInjection?.inject(event.sectionId, event.substanceId, event.amount);
            }
          }
        }
        // Tercera consecuencia de un desmontaje inseguro (13d): la pieza sale
        // un escalón peor de lo que la tirada de GDD §6.5 ya decidió. Arrancar
        // algo vivo maltrata la pieza, no solo a quien la arranca.
        const recoveredWear = hazard?.extraWearStep ? worsenWear(rolledWear) : rolledWear;
        // ¿Este desmontaje concreto empeoró la pieza? (fix de playtest ronda 1)
        const degraded = instance ? recoveredWear !== instance.wear : false;

        if (definition && isCompositeEntity(definition)) {
          let nextStock = atomicStock.get();
          for (const ingredient of definition.recipe.ingredients) {
            // El desgaste del compuesto se propaga a TODAS sus piezas: si el
            // ensamblaje se maltrató al abrirlo, lo que sale de él también.
            nextStock = creditStock(nextStock, ingredient.ref, ingredient.quantity, recoveredWear);
          }
          atomicStock.set(nextStock);
          shipState.set(dismantleInstance(shipState.get(), payload.instanceId));
          return {
            obtained: definition.recipe.ingredients.map((ingredient) => ({
              componentId: ingredient.ref,
              quantity: ingredient.quantity,
              wear: recoveredWear,
              degraded,
            })),
          };
        }
        shipState.set(dismantleInstance(shipState.get(), payload.instanceId));
        // Pieza ATÓMICA (12c.7, obs #4): se recupera al stock como su propia
        // pieza — igual que un compuesto recupera sus ingredientes. Antes se
        // destruía sin acreditar, así que el desmontaje no daba coleccionable ni
        // notificación.
        if (definition && instance) {
          atomicStock.set(
            creditStock(atomicStock.get(), instance.componentDefinitionId, 1, recoveredWear),
          );
          return {
            obtained: [
              { componentId: instance.componentDefinitionId, quantity: 1, wear: recoveredWear, degraded },
            ],
          };
        }
        return;
      }
      case "install": {
        const definition = componentRegistry.get(payload.componentDefinitionId);
        const wear = payload.wear ?? DEFAULT_WEAR;
        if (definition && !isCompositeEntity(definition)) {
          const consumed = consumeStock(atomicStock.get(), payload.componentDefinitionId, 1, wear);
          if (!consumed) {
            throw new InsufficientStockError(
              `No hay stock de "${payload.componentDefinitionId}" (${wear}) para instalar (task ${task.id})`,
            );
          }
          atomicStock.set(consumed);
        } else if (definition && isCompositeEntity(definition) && payload.consumeRecipe) {
          // Ronda 7: instalar un compuesto de catálogo directo desde
          // "Inventario" (ej. un segundo reservorio) consume su receta, a
          // diferencia de una creación personalizada (siempre gratis acá —
          // ver el docblock de `consumeRecipe`). Mismo criterio estricto que
          // el camino atómico: bucket `nuevo` sin fallback silencioso.
          let stock = atomicStock.get();
          for (const ingredient of definition.recipe.ingredients) {
            const consumed = consumeStock(stock, ingredient.ref, ingredient.quantity, DEFAULT_WEAR);
            if (!consumed) {
              throw new InsufficientStockError(
                `No hay stock de "${ingredient.ref}" (nuevo) para instalar "${payload.componentDefinitionId}" (task ${task.id})`,
              );
            }
            stock = consumed;
          }
          atomicStock.set(stock);
        }
        shipState.set(installInstance(shipState.get(), payload, componentRegistry));
        return;
      }
      case "connect":
        if (floorplan) {
          assertSignalWiringReachable(floorplan, shipState.get().signalGraph, payload.fromNodeId, payload.toNodeId);
        }
        shipState.set(
          wireExternalPort(shipState.get(), payload.edgeId, payload.fromNodeId, payload.toNodeId, payload.toPort),
        );
        return;
      case "analyze-substance":
        // Tarea de "revelar", no de mutar: no toca `shipState`/`atomicStock`.
        return { analyzedSubstanceId: payload.substanceId };
      case "cut-power": {
        // Asegurado eléctrico (13d): quitar la entrada de asignación equivale a
        // 0 unidades — mismo criterio que `MissionRuntime.setSectionPowerUnits`,
        // para no tener dos representaciones de "esta sección no pide energía".
        const ship = shipState.get();
        shipState.set({
          ...ship,
          powerState: {
            ...ship.powerState,
            sectionAllocations: ship.powerState.sectionAllocations.filter(
              (entry) => entry.sectionId !== payload.sectionId,
            ),
          },
        });
        return;
      }
      case "discharge-source": {
        // Asegurado de una FUENTE (13d, fix de playtest ronda 1): cortar la
        // sección no vacía una batería, su carga es propia. Descargarla la
        // vuelve segura, y el precio es real — deja de aportar al presupuesto
        // de la nave (`totalPowerBudget`) para siempre (principio 5).
        const ship = shipState.get();
        if (ship.powerState.dischargedSourceIds.includes(payload.instanceId)) {
          return;
        }
        shipState.set({
          ...ship,
          powerState: {
            ...ship.powerState,
            dischargedSourceIds: [...ship.powerState.dischargedSourceIds, payload.instanceId],
          },
        });
        return;
      }
      case "purge-reservoir": {
        // Purga CONTROLADA (13d): vaciar el reservorio para poder desmontarlo
        // sin derrame. Hasta 13e el contenido se venteaba a la nada por falta
        // de destino (deuda #9, ya cerrada); ahora se vuelca sobre la sección
        // por la MISMA vía que `apply-substance` — no duplicar la inyección,
        // es el mismo fenómeno con otra intención. Sigue sin volver al
        // inventario: purgar es tirar la carga, no cosecharla (para eso está
        // `extract-elements`).
        const ship = shipState.get();
        const content = contentOf(ship.reservoirContents, payload.instanceId);
        if (!content) {
          return;
        }
        const drawn = drawFrom(ship.reservoirContents, payload.instanceId, content.amount);
        shipState.set({ ...ship, reservoirContents: drawn.contents });
        if (drawn.drawn === 0 || !drawn.substanceId) {
          return;
        }
        if (payload.sectionId) {
          substanceDeps.gasInjection?.inject(payload.sectionId, drawn.substanceId, drawn.drawn);
        }
        return { pouredSubstanceId: drawn.substanceId, pouredAmount: drawn.drawn };
      }
      case "transfer-substance": {
        // Trasvase entre reservorios (13e). La restricción de alcance se valida
        // acá además de en el preview de `/game`, por la misma razón que
        // `connect` valida el cableado: defensa en profundidad, no doble UX.
        const ship = shipState.get();
        if (floorplan) {
          assertFluidTransferReachable(
            ship,
            floorplan,
            payload.fromInstanceId,
            payload.toInstanceId,
          );
        }
        // Defensa en profundidad (mismo criterio que la validación de alcance
        // de arriba): el preview de `/game` ya excluye un destino sin lugar de
        // `transferTargetsFor`, pero el estado pudo cambiar entre armar el
        // panel y ejecutar la tarea (otro trasvase/síntesis llenó el destino
        // mientras tanto). Sin este chequeo, `drawFrom` vaciaba el origen
        // ANTES de saber si el destino podía recibir algo, y con capacidad 0
        // se perdía el 100% del contenido como "desborde" — un fallo de
        // guard, no la consecuencia de desborde PARCIAL que sí es deliberada
        // (ver el test de "no da abasto" más abajo, que sigue intacto).
        const capacity = reservoirCapacityOf(ship, payload.toInstanceId, componentRegistry);
        if (freeCapacity(ship.reservoirContents, payload.toInstanceId, capacity) <= 0) {
          return;
        }
        const drawn = drawFrom(ship.reservoirContents, payload.fromInstanceId, payload.amount);
        if (drawn.drawn === 0 || !drawn.substanceId) {
          return;
        }
        const poured = pourInto(
          drawn.contents,
          payload.toInstanceId,
          drawn.substanceId,
          drawn.drawn,
          capacity,
        );
        shipState.set({ ...ship, reservoirContents: poured.contents });
        // Ronda 7: el éxito también se reporta (antes solo se exponía el
        // desborde) — sin esto, un trasvase 100% exitoso no disparaba
        // ninguna notificación ni efecto visual en `/game`, y la sustancia
        // "desaparecía" a los ojos del jugador aunque se hubiera movido bien.
        return {
          ...(poured.poured > 0
            ? { pouredSubstanceId: drawn.substanceId, pouredAmount: poured.poured }
            : {}),
          ...(poured.overflow > 0 ? { overflowAmount: poured.overflow } : {}),
        };
      }
      case "apply-substance": {
        // Verter sobre la ATMÓSFERA de una sección (13e). Primer escritor real
        // de un `ChemicalSubstanceId` en `atmosphere.gases`: hasta ahora todo
        // el camino lector (contaminantes, corrosión, hazards) existía sin
        // nadie que escribiera.
        const ship = shipState.get();
        const drawn = drawFrom(ship.reservoirContents, payload.fromInstanceId, payload.amount);
        if (drawn.drawn === 0 || !drawn.substanceId) {
          return;
        }
        shipState.set({ ...ship, reservoirContents: drawn.contents });
        substanceDeps.gasInjection?.inject(payload.sectionId, drawn.substanceId, drawn.drawn);
        return { pouredSubstanceId: drawn.substanceId, pouredAmount: drawn.drawn };
      }
      case "extract-elements": {
        // Descomposición en elementos (13e, GDD 5.4.1). `elementsFromAmount`
        // lanza si la sustancia no está analizada o si no se conoce su
        // composición — el gate de UX vive en `/game`, esto es el respaldo.
        const ship = shipState.get();
        const content = contentOf(ship.reservoirContents, payload.instanceId);
        if (!content || !substanceDeps.composition || !substanceDeps.elementStock) {
          return;
        }
        const obtainedElements = elementsFromAmount(
          content.substanceId,
          Math.min(payload.amount, content.amount),
          substanceDeps.composition(),
        );
        if (obtainedElements.length === 0) {
          return;
        }
        // Solo se consume lo que realmente se descompuso en unidades enteras.
        const consumedUnits = Math.min(Math.floor(payload.amount), content.amount);
        const drawn = drawFrom(ship.reservoirContents, payload.instanceId, consumedUnits);
        shipState.set({ ...ship, reservoirContents: drawn.contents });
        substanceDeps.elementStock.set(
          creditElementList(substanceDeps.elementStock.get(), obtainedElements),
        );
        return { obtainedElements };
      }
      case "set-valve":
        // Aislamiento deliberado (13h, GDD §5.5). Escribe en el runtime de
        // válvulas, que es de donde `SectionApertureSource` lee cada tick: la
        // sala deja de intercambiar aire por ese ducto desde el tick siguiente,
        // sin ningún paso intermedio.
        compartmentDeps.valves?.setAperture(payload.conduitId, payload.targetAperture);
        return;
      case "force-door":
        // Abrir a mano una puerta sin motor. El override queda puesto: la hoja
        // se quedó físicamente en esa posición, así que devolverle la energía
        // no la cierra sola.
        compartmentDeps.doors?.forceOpen(payload.doorId, compartmentDeps.elapsedSecondsOf?.() ?? 0);
        return;
      case "repair-door":
        compartmentDeps.doors?.repair(payload.doorId, compartmentDeps.elapsedSecondsOf?.() ?? 0);
        return;
    }
  };
}

/**
 * Capacidad de sustancia de un reservorio destino. Sin registry o sin
 * propiedad `RES` cae a `Infinity`: no inventar un tope arbitrario que haría
 * desaparecer material en silencio — el desborde tiene que ser una decisión
 * del catálogo, no del código.
 */
function reservoirCapacityOf(
  ship: Blueprint,
  instanceId: PlacedComponentInstanceId,
  componentRegistry: ComponentRegistry,
): number {
  const instance = ship.placedComponents.find((entry) => entry.instanceId === instanceId);
  if (!instance) {
    return Number.POSITIVE_INFINITY;
  }
  return instanceReservoirCapacity(instance, componentRegistry) ?? Number.POSITIVE_INFINITY;
}

/**
 * Arma el contexto de riesgo (13d) leyendo el mundo vivo alrededor de la pieza.
 * Exportado como helper propio para que `/game` pueda reusarlo tal cual al
 * pintar el badge de riesgo ANTES de encolar — misma evaluación, no dos
 * criterios que se desincronizan.
 */
export function dismantleHazardContext(
  ship: Blueprint,
  instance: PlacedComponentInstance,
  floorplan: ShipFloorplan | undefined,
  deps: SalvageHazardDeps,
  componentRegistry?: ComponentRegistry,
): DismantleHazardContext {
  const sectionId = floorplan
    ? sectionContainingCell(floorplan, instance.placement.position)?.id
    : undefined;
  return {
    instance,
    sectionId,
    definition: componentRegistry?.get(instance.componentDefinitionId),
    sectionHasGrantedPower: sectionId ? (deps.sectionHasGrantedPower?.(sectionId) ?? false) : false,
    sourceDischarged: ship.powerState.dischargedSourceIds.includes(instance.instanceId),
    reservoirContents: ship.reservoirContents.filter(
      (entry) => entry.componentInstanceId === instance.instanceId,
    ),
    atmosphere: sectionId ? deps.atmosphereOf?.(sectionId) : undefined,
    elapsedSeconds: deps.elapsedSecondsOf?.() ?? 0,
  };
}

/**
 * Tier/especialidad del actor que ejecuta la tarea. Sin `actorOf` (llamadores
 * previos a 13c y tests sintéticos) cae al peor caso conocido: novato sin
 * afinidad. Da igual en la práctica, porque sin `random` no se llega a tirar.
 */
function resolveActorTraits(
  actorId: CrewActorId,
  actorOf?: (actorId: CrewActorId) => CrewActor | undefined,
): { readonly tier: CrewTier; readonly specialty: CrewSpecialty } {
  const actor = actorOf?.(actorId);
  // Sin actor conocido no hay afinidad de Ingeniero: se asume una especialidad
  // cualquiera distinta de `ingeniero` para no regalar el bonus de GDD §6.6.
  return { tier: actor?.tier ?? "novato", specialty: actor?.specialty ?? "seguridad" };
}

/**
 * RE efectiva de la pieza como argumento de la tirada, solo si es un nivel
 * degradable (A/M/B). Una pieza ya en `"fallo"` no aporta penalización extra:
 * `atomicRecoveryFraction` solo distingue "B o no B" (GDD §6.5).
 */
function degradableResistance(
  instance: PlacedComponentInstance,
  definition: PhysicalComponentDefinition | undefined,
): { readonly effectiveResistance?: StructuralResistanceLevel } {
  const resistance = effectiveResistance(
    definition?.data.material?.RE,
    instance.wear,
    instance.structuralResistanceOverride,
  );
  return resistance && resistance !== "fallo" ? { effectiveResistance: resistance } : {};
}

/**
 * Desmonta una instancia y limpia todo lo que la referenciaba (nodos de
 * señal propios, edges que colgaban de esos nodos, contenido de reservorio)
 * — sin esto, el `Blueprint` resultante queda con referencias colgantes que
 * `assertBlueprintIntegrity` rechazaría en el primer guardado.
 */
function dismantleInstance(ship: Blueprint, instanceId: PlacedComponentInstanceId): Blueprint {
  const removedNodeIds = new Set(
    ship.signalGraph.nodes.filter((node) => node.ownerRef === instanceId).map((node) => node.id),
  );
  return {
    ...ship,
    placedComponents: ship.placedComponents.filter((entry) => entry.instanceId !== instanceId),
    reservoirContents: ship.reservoirContents.filter(
      (entry) => entry.componentInstanceId !== instanceId,
    ),
    signalGraph: {
      nodes: ship.signalGraph.nodes.filter((node) => node.ownerRef !== instanceId),
      edges: ship.signalGraph.edges.filter(
        (edge) => !removedNodeIds.has(edge.from) && !removedNodeIds.has(edge.to),
      ),
    },
  };
}

/**
 * Instala una instancia nueva con `condition: "ok"`. Materializa sus nodos de
 * señal derivándolos de las propiedades funcionales de la definición (11c.0,
 * `deriveSignalNodes`) — sin esto, una pieza instalada en runtime quedaba sin
 * nodos en `signalGraph` y era invisible para el modo cableado (que busca
 * nodos por posición). NO cablea puertos externos: crear los nodos ≠
 * conectarlos ("instalar no conecta automáticamente", GDD 10.1 párrafo 7); el
 * jugador los cablea después con una tarea `connect`.
 *
 * La validación de espacio/forma de sección es de la UI al planificar la tarea
 * (Fase 10d), no de este efecto: para cuando la tarea se completa, la
 * colocación ya fue aceptada por el jugador.
 */
function installInstance(
  ship: Blueprint,
  payload: InstallTaskPayload,
  registry: ComponentRegistry,
): Blueprint {
  const withComponent: Blueprint = {
    ...ship,
    placedComponents: [
      ...ship.placedComponents,
      {
        instanceId: payload.instanceId,
        componentDefinitionId: payload.componentDefinitionId,
        placement: payload.placement,
        condition: "ok",
        // La pieza entra con el desgaste del bucket que se consumió (13c):
        // antes se hardcodeaba `"ok"`/sin historia, que era exactamente el
        // punto donde el ciclo canibalizar→reinstalar se volvía gratuito.
        wear: payload.wear ?? DEFAULT_WEAR,
      },
    ],
  };

  // Subfase 14a-2: un reservorio recién instalado nace CON su sustancia de
  // fábrica, igual que los sembrados al crear la campaña.
  //
  // `deriveInitialReservoirContents` solo se llamaba al crear la campaña y al
  // cambiar de capítulo, así que un tanque que el jugador fabricaba e instalaba
  // quedaba vacío para siempre: la acción "Verter en la sección" ni siquiera
  // aparecía, porque exige contenido. Es la misma clase de corte que la ronda 1
  // de 14a-1 — la pieza simulada que no se podía conseguir — un paso más
  // adelante en la cadena: acá SÍ se conseguía, y no servía para nada.
  const withContents: Blueprint = {
    ...withComponent,
    reservoirContents: [
      ...withComponent.reservoirContents,
      ...deriveInitialReservoirContents(
        [withComponent.placedComponents[withComponent.placedComponents.length - 1]!],
        FACTORY_RESERVOIR_CONTENTS,
      ),
    ],
  };

  const definition = registry.get(payload.componentDefinitionId);
  const derivedNodes = deriveSignalNodes(
    definition?.data.functional,
    payload.instanceId,
    payload.placement,
  );
  if (derivedNodes.length === 0) {
    return withContents;
  }

  return mergeInstalledSignalGraph(withContents, { nodes: derivedNodes, edges: [] });
}
