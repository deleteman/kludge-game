/**
 * Estado agregado a nivel de nave (Subfase 11g). Hasta esta fase, atmósfera
 * (`atmosphere/`), integridad estructural (`failure/structural-failure.ts`) y
 * energía (`Blueprint.unpoweredSectionIds`) solo existían por sección/por
 * componente — este tipo es el primer resumen global, consumido por el HUD
 * permanente de `/game`.
 */
export type ShipStatusLevel = "nominal" | "warning" | "critical";

export interface ShipStatusIndicator {
  readonly level: ShipStatusLevel;
  /** [0,1], 1 = mejor estado posible. Insumo del `level` vía `fractionToLevel`. */
  readonly fraction: number;
}

export interface ShipStatusSnapshot {
  readonly atmosphere: ShipStatusIndicator;
  readonly lifeSupport: ShipStatusIndicator;
  readonly hullIntegrity: ShipStatusIndicator;
  readonly energy: ShipStatusIndicator;
}
