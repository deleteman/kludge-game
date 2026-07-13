/**
 * Tipos mínimos del formato JSON de Tiled Map Editor (GDD 15.1) — solo los
 * campos que el parser de plano físico consume. El parser valida desde
 * `unknown` y tolera capas/campos extra: cuando exista un pack de arte
 * (GDD 11.0, §17) los mapas podrán ganar tile layers visuales (suelo/paredes)
 * sin tocar el código de parseo, que solo lee object layers.
 */
export interface TiledProperty {
  readonly name: string;
  readonly type?: string;
  readonly value: unknown;
}

export interface TiledObject {
  readonly id: number;
  /** Posición en píxeles (convención de Tiled). */
  readonly x: number;
  readonly y: number;
  /** Ausente o 0 en objetos punto. */
  readonly width?: number;
  readonly height?: number;
  /** `true` en objetos punto (conductos, anclajes). */
  readonly point?: boolean;
  readonly properties?: readonly TiledProperty[];
}

export interface TiledLayer {
  /** `"objectgroup"` para las capas que consumimos; otras se ignoran. */
  readonly type: string;
  readonly name: string;
  readonly objects?: readonly TiledObject[];
}

export interface TiledMap {
  readonly orientation?: string;
  /** Tamaño del mapa en celdas. */
  readonly width: number;
  readonly height: number;
  /** Tamaño de celda en píxeles; debe coincidir con `GRID_CELL_SIZE_PX`. */
  readonly tilewidth: number;
  readonly tileheight: number;
  readonly properties?: readonly TiledProperty[];
  readonly layers: readonly TiledLayer[];
}
