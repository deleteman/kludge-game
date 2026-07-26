/**
 * Unidad de grid compartida entre el plano principal y la mesa de creación
 * (GDD 10.1). Estos tipos son agnósticos del tamaño en píxeles, solo cuentan
 * celdas; la conversión celda↔píxel vive en `GRID_CELL_SIZE_PX`.
 */
export interface GridPosition {
  readonly x: number;
  readonly y: number;
}

export type Rotation = 0 | 90 | 180 | 270;

/**
 * Tamaño físico en celdas de grid (GDD 7.2). Solo las piezas atómicas tienen
 * footprint fijo de catálogo; el footprint de un compuesto/ensamblaje se
 * calcula dinámicamente en la mesa de creación (GDD 10.1) como el rectángulo
 * mínimo que contiene sus piezas — ver `workbench/footprint-calculator.ts`
 * (Fase 7), que consume estos tipos sin modificarlos.
 */
export interface Footprint {
  readonly width: number;
  readonly height: number;
}

export interface PlacedFootprint {
  readonly position: GridPosition;
  readonly footprint: Footprint;
  readonly rotation: Rotation;
}

/**
 * Tamaño en píxeles de una celda de grid. Cierra el pendiente del GDD §17
 * (decisión del operador, Fase 5, 2026-07-13): 32×32 px, compartido entre
 * plano principal, mesa de creación y los mapas de Tiled (`floorplan/maps/`,
 * cuyo `tilewidth`/`tileheight` debe coincidir con este valor).
 */
export const GRID_CELL_SIZE_PX = 32;
