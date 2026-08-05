import type { EntityRegistry } from "../composition/entity-registry.js";
import type { ComponentId, PhysicalComponentDefinition } from "../components/physical-component.types.js";
import type { ProjectileBody } from "../kinetics/projectile.types.js";
import type { ProjectileSimulation } from "../kinetics/projectile-simulation.js";
import type { Tickable } from "../tasks/core-loop-mode.js";
import { effectiveResistance } from "../wear/effective-resistance.js";
import { isLooseFerromagneticCandidate } from "./mission-projectile-world.js";
import type { MutableShipState } from "./mutable-ship-state.js";

/**
 * El efecto emergente central de ASA 3 (Fase 11a.3, decisión del operador):
 * "cargar un proyectil" no es un verbo nuevo de jugador — es lo que le pasa a
 * cualquier pieza ferromagnética SUELTA (`isLooseFerromagneticCandidate`,
 * `mission-projectile-world.ts`) instalada con el flujo normal
 * (`queueInstall`) en cuanto deja de ser una entrada fija del `Blueprint` y
 * empieza a ser un `ProjectileState` vivo. Sin `TaskType` nuevo, sin UI
 * propia: la física ya existente (`kinetics/`) decide, no una acción
 * explícita del jugador (GDD principio 1, identidad por propiedades).
 *
 * `Tickable` más del core loop, registrado ENTRE `MissionSignalRuntime` y
 * `ProjectileSimulation` (mismo criterio de orden que 11a.0: una pieza recién
 * promovida ya puede ser acelerada en el mismo tick si ya hay campo activo).
 *
 * Una vez promovida, la pieza NUNCA vuelve a `placedComponents` (principio 5
 * CLAUDE.md: ninguna acción se revierte gratis) — incluso en reposo tras un
 * impacto, se queda viviendo en `ProjectileSimulation`.
 */
export class LooseFerromagneticPromoter implements Tickable {
  /**
   * `ProjectileBody.ref` (`placedComponentInstanceId`) → `componentDefinitionId`
   * de catálogo (Fase 12f, deuda #5). `ProjectileBody`/`kinetics/` se
   * mantienen puros a propósito (sin concepto de catálogo) — este mapa vive
   * acá, en la capa que ya conoce blueprint + catálogo, para que el renderer
   * (`projectile-renderer.ts`) pueda resolver el sprite real de la pieza en
   * vez de caer siempre al placeholder.
   */
  private readonly definitionByRef = new Map<string, ComponentId>();

  constructor(
    private readonly shipState: MutableShipState,
    private readonly projectiles: ProjectileSimulation,
    private readonly registry: EntityRegistry<ComponentId, PhysicalComponentDefinition>,
  ) {}

  tick(): void {
    this.promote();
  }

  /** `componentDefinitionId` de catálogo de la pieza que se promovió con `ref` como `instanceId`, si la hubo. */
  definitionIdForRef(ref: string): ComponentId | undefined {
    return this.definitionByRef.get(ref);
  }

  /**
   * Pasada síncrona, además del tick: `MissionRuntime` la corre una vez en su
   * constructor (mismo patrón que `CrisisRuntime.tick({dtSeconds:0.001,...})`)
   * para promover piezas sueltas que ya vinieran en el `Blueprint` inicial de
   * la nave/capítulo, sin esperar al primer tick de ejecución.
   */
  promote(): void {
    const blueprint = this.shipState.get();
    const alreadyTracked = new Set(this.projectiles.all.map((state) => state.ref));

    const remaining = blueprint.placedComponents.filter((placed) => {
      if (placed.condition !== "ok" || alreadyTracked.has(placed.instanceId)) {
        return true;
      }
      const definition = this.registry.get(placed.componentDefinitionId);
      if (!definition || !isLooseFerromagneticCandidate(definition.data)) {
        return true;
      }
      // Fase 13c: la masa virtual del impacto usa la RE EFECTIVA — una pieza
      // canibalizada golpea (y se rompe) como lo que es, no como la de
      // catálogo. `"fallo"` no es un nivel válido de `ProjectileBody.re`, así
      // que se colapsa al más débil que el dominio kinetics entiende.
      const effective = effectiveResistance(
        definition.data.material?.RE,
        placed.wear,
        placed.structuralResistanceOverride,
      );
      const body: ProjectileBody = {
        ref: placed.instanceId,
        footprint: placed.placement.footprint,
        re: effective === null ? undefined : effective === "fallo" ? "B" : effective,
      };
      this.definitionByRef.set(placed.instanceId, placed.componentDefinitionId);
      this.projectiles.register(body, placed.placement.position);
      return false;
    });

    if (remaining.length !== blueprint.placedComponents.length) {
      this.shipState.set({ ...blueprint, placedComponents: remaining });
    }
  }
}
