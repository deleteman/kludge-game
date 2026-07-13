/**
 * Propiedades de material (GDD 5.2), capa física ortogonal a la funcional.
 * Escala simple (bajo/medio/alto), no numérica realista. Los niveles NO son
 * uniformes entre propiedades — se toman literalmente de la leyenda GDD 7.0.
 */

/** CE (conductividad eléctrica): único caso con 4 niveles, incluye "Ninguno". */
export type ConductivityLevel = "A" | "M" | "B" | "N";

/** CT (conductividad térmica): 3 niveles. */
export type ThermalConductivityLevel = "A" | "M" | "B";

/** RE (resistencia estructural): 3 niveles. */
export type StructuralResistanceLevel = "A" | "M" | "B";

/** ES (estado): sólido/líquido/gas. */
export type MatterState = "S" | "L" | "G";

/**
 * Bag con campos opcionales: el catálogo del GDD no anota las 5 propiedades
 * en cada componente (ej. GDD 7.2 "Cable de cobre" solo trae CE-A), así que
 * un objeto plano parcial es más fiel que forzar valores por defecto.
 */
export interface MaterialProperties {
  readonly CE?: ConductivityLevel;
  readonly CT?: ThermalConductivityLevel;
  /** MAG (ferromagnetismo): booleano explícito, GDD 7.0 lo expresa como Sí/No. */
  readonly MAG?: boolean;
  readonly RE?: StructuralResistanceLevel;
  readonly ES?: MatterState;
}
