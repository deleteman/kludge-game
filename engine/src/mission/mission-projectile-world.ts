import type { Footprint, GridPosition } from "../geometry/grid-position.types.js";
import type { CellBlockedQuery } from "../geometry/line-of-sight.js";
import { occupiedCells } from "../workbench/workbench-state.types.js";
import type { ActiveCoil, CellOccupant, ProjectileWorld } from "../kinetics/projectile.types.js";
import type { CurrentLevel } from "../kinetics/current-level.types.js";
import type { EntityRegistry } from "../composition/entity-registry.js";
import type {
  ComponentId,
  PhysicalComponentDefinition,
} from "../components/physical-component.types.js";
import type { FunctionalProperties } from "../properties/functional.types.js";
import type { MaterialProperties } from "../properties/material.types.js";
import type {
  Blueprint,
  PlacedComponentInstance,
  PlacedComponentInstanceId,
} from "../blueprint/blueprint.types.js";
import type { SignalNodeId } from "../signals/signal-node.types.js";
import { upstreamNodes } from "../signals/graph-traversal.js";
import type { MutableShipState } from "./mutable-ship-state.js";
import type { SignalOutputReader } from "./mission-signal-runtime.js";
import type { MutableCrewState } from "./mutable-crew-state.js";
import type { MutableEnemyState } from "./mutable-enemy-state.js";

/**
 * Núcleo ferromagnético + conducción eléctrica (GDD principio 1: identidad
 * por propiedades, no por id de catálogo) — el mismo criterio con el que el
 * caso 9 arma un electroimán. Extraído como función pura (Fase 11a.3) para que
 * `LooseFerromagneticPromoter` pueda usar exactamente el mismo criterio sin
 * duplicarlo.
 */
export function isElectromagnetDefinition(data: {
  readonly material?: MaterialProperties;
  readonly functional?: FunctionalProperties;
}): boolean {
  const conductsElectricity =
    data.functional?.some((property) => property.tag === "COND" && property.resourceType === "E") ??
    false;
  return data.material?.MAG === true && conductsElectricity;
}

/**
 * Ferromagnético SUELTO (Fase 11a.3, ASA 3): tiene núcleo ferromagnético pero
 * NO es él mismo un electroimán activo — la negación exacta de
 * `isElectromagnetDefinition`. Es la pieza que `LooseFerromagneticPromoter`
 * promueve a proyectil (`iman-permanente`, `pieza-hierro` del catálogo): un
 * imán o un trozo de hierro sueltos, no la bobina que los acelera.
 */
export function isLooseFerromagneticCandidate(data: {
  readonly material?: MaterialProperties;
  readonly functional?: FunctionalProperties;
}): boolean {
  return data.material?.MAG === true && !isElectromagnetDefinition(data);
}

/**
 * Umbrales de `dischargeRate` del reservorio eléctrico que alimenta una bobina
 * para clasificar su corriente en la escala B/M/A del documento §1. Sin tabla
 * en ningún documento — valores de referencia ajustables, mismo criterio que
 * `MAGNETIC_FIELD_PARAMETERS`. Hoy los dos reservorios E del catálogo declaran
 * `dischargeRate: 5`, así que ambos dan "M": la variedad es un tema de
 * contenido (catálogo), no de esta regla.
 */
export const ELECTRIC_CURRENT_PARAMETERS = {
  dischargeRateForMedium: 5,
  dischargeRateForHigh: 15,
} as const;

/**
 * Adaptador del puerto `ProjectileWorld` (`kinetics/`) sobre una misión real:
 * traduce el `Blueprint` vivo y el estado de señales vivo a las dos preguntas
 * que el simulador hace — qué ocupa una celda y qué bobinas pulsan ahora.
 *
 * Vive en `mission/` y no en `kinetics/` a propósito: `kinetics/` no debe
 * importar `blueprint/` ni `signals/` (por eso el puerto existe). Vive en
 * `/engine` y no en `/game` porque no necesita nada de Phaser y así se testea.
 *
 * ALCANCE: resuelve colisiones contra componentes colocados primero, y contra
 * tripulación/enemigos con celda conocida si no hay componente en esa celda
 * (Fase 11d.2, fix de PENDIENTES_OBSERVACIONES.md — antes de esta fase el
 * motor no modelaba una celda por tripulante). `crew`/`enemies` son opcionales:
 * el caso 17 (`RailWorld` sintético) sigue sin pasarlos y solo resuelve contra
 * el riel.
 *
 * Subfase 13f — PAREDES Y BORDES (hueco #2 de su relevamiento, deuda #21):
 * hasta ahora el motor no tenía ningún concepto de pared (viven en el tilemap
 * de Tiled, en `/game`) y un proyectil que no golpeaba nada salía del plano y
 * seguía avanzando para siempre; lo único que lo frenaba era el drag de ASA 2.
 * Se resuelve con el mismo patrón de inyección que 13a usó para la línea de
 * visión: el llamador pasa un `CellBlockedQuery` y `/engine` sigue sin saber
 * que Tiled existe. `MissionRuntime` ya tiene ese query inyectado desde el
 * tilemap (`setMotionBlockedQuery`), así que se REUSA — un solo punto de
 * inyección, no dos verdades sobre qué celdas están bloqueadas.
 */
export interface MissionProjectileWorldOptions {
  readonly crew?: MutableCrewState;
  readonly enemies?: MutableEnemyState;
  /** Paredes del tilemap. Sin él, ninguna celda es pared (comportamiento previo a 13f). */
  readonly blocked?: CellBlockedQuery;
  /** Tamaño del plano en celdas; fuera de él, el proyectil choca contra el casco exterior. */
  readonly gridSize?: Footprint;
}

/** Ref sintético de una pared: no hay entidad de dominio detrás, solo la celda golpeada. */
export function wallRefAt(cell: GridPosition): string {
  return `wall:${cell.x},${cell.y}`;
}

export class MissionProjectileWorld implements ProjectileWorld {
  private readonly crew?: MutableCrewState;
  private readonly enemies?: MutableEnemyState;
  private readonly blocked?: CellBlockedQuery;
  private readonly gridSize?: Footprint;

  constructor(
    private readonly shipState: MutableShipState,
    private readonly signals: SignalOutputReader,
    private readonly registry: EntityRegistry<ComponentId, PhysicalComponentDefinition>,
    options: MissionProjectileWorldOptions = {},
  ) {
    this.crew = options.crew;
    this.enemies = options.enemies;
    this.blocked = options.blocked;
    this.gridSize = options.gridSize;
  }

  occupantAt(cell: GridPosition): CellOccupant | null {
    const hit = this.shipState
      .get()
      .placedComponents.find((placed) =>
        occupiedCells(placed.placement).some((c) => c.x === cell.x && c.y === cell.y),
      );
    if (hit) {
      return { ref: hit.instanceId, kind: "component" };
    }
    const crewHit = this.crew?.all().find((actor) => actor.currentCell && sameCell(actor.currentCell, cell));
    if (crewHit) {
      return { ref: crewHit.id, kind: "crew" };
    }
    const enemyHit = this.enemies?.all().find((enemy) => sameCell(enemy.cell, cell));
    if (enemyHit) {
      return { ref: enemyHit.id, kind: "enemy" };
    }
    return this.isWall(cell) ? { ref: wallRefAt(cell), kind: "wall" } : null;
  }

  /**
   * Pared del tilemap, o borde del plano. El borde cuenta como pared y no como
   * "nada": salirse del mapa es chocar contra el casco exterior, que es
   * justamente lo que abre una brecha al vacío.
   */
  private isWall(cell: GridPosition): boolean {
    if (this.gridSize && (cell.x < 0 || cell.y < 0 || cell.x >= this.gridSize.width || cell.y >= this.gridSize.height)) {
      return true;
    }
    return this.blocked?.isBlocked(cell) ?? false;
  }

  /**
   * Una bobina no se identifica por su id de catálogo (principio 1: emergencia
   * sobre recetas) sino por las propiedades que el caso 9 ya usa para armar un
   * electroimán: núcleo ferromagnético (`MAG`) + conducción eléctrica (`COND`
   * de recurso "E") + corriente. Aquí la corriente entra además como condición
   * de existencia: sin reservorio eléctrico aguas arriba no hay campo, por
   * mucho hierro y cobre que haya.
   */
  activeCoils(): ReadonlyArray<ActiveCoil> {
    const blueprint = this.shipState.get();
    const coils: ActiveCoil[] = [];
    for (const placed of blueprint.placedComponents) {
      if (placed.condition !== "ok" || !this.isElectromagnet(placed)) {
        continue;
      }
      const node = energizedNodeOf(blueprint, placed.instanceId, (id) => this.signals.outputOf(id));
      if (!node) {
        continue;
      }
      const current = this.currentFeeding(blueprint, node);
      if (!current) {
        continue;
      }
      coils.push({ ref: placed.instanceId, position: placed.placement.position, current });
    }
    return coils;
  }

  private isElectromagnet(placed: PlacedComponentInstance): boolean {
    const definition = this.registry.get(placed.componentDefinitionId);
    return definition !== undefined && isElectromagnetDefinition(definition.data);
  }

  /**
   * Corriente que llega a la bobina: la del reservorio eléctrico MÁS FUERTE
   * aguas arriba en el grafo. Es lo que convierte la elección de fuente en una
   * decisión del jugador (conectar una batería mejor sube la corriente) en vez
   * de un número fijo por pieza.
   *
   * Nota: `current-level.types.ts` decía que la corriente "se declara
   * explícitamente en la bobina activa, no se deriva" — se derogó en Fase 11a
   * (decisión del operador) porque no existía ningún campo donde declararla y
   * fijarla por pieza habría impedido que el jugador la variara, que es la
   * palanca central del caso 17.
   */
  private currentFeeding(blueprint: Blueprint, coilNode: SignalNodeId): CurrentLevel | null {
    let best: number | null = null;
    for (const nodeId of upstreamNodes(blueprint, coilNode)) {
      const owner = blueprint.signalGraph.nodes.find((node) => node.id === nodeId)?.ownerRef;
      const placed = blueprint.placedComponents.find((p) => p.instanceId === owner);
      const definition = placed && this.registry.get(placed.componentDefinitionId);
      const supply = definition?.data.functional?.find(
        (property) => property.tag === "RES" && property.resourceType === "E",
      );
      if (supply && supply.tag === "RES") {
        best = Math.max(best ?? 0, supply.dischargeRate);
      }
    }
    return best === null ? null : currentLevelFor(best);
  }
}

function sameCell(a: GridPosition, b: GridPosition): boolean {
  return a.x === b.x && a.y === b.y;
}

function currentLevelFor(dischargeRate: number): CurrentLevel {
  if (dischargeRate >= ELECTRIC_CURRENT_PARAMETERS.dischargeRateForHigh) {
    return "A";
  }
  return dischargeRate >= ELECTRIC_CURRENT_PARAMETERS.dischargeRateForMedium ? "M" : "B";
}

/** Nodo de esa instancia cuya salida está activa ahora — la bobina energizada. */
function energizedNodeOf(
  blueprint: Blueprint,
  instanceId: PlacedComponentInstanceId,
  outputOf: (nodeId: SignalNodeId) => boolean,
): SignalNodeId | null {
  const node = blueprint.signalGraph.nodes.find(
    (candidate) => candidate.ownerRef === instanceId && outputOf(candidate.id),
  );
  return node?.id ?? null;
}

