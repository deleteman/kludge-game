import type { SectionId } from "./section.types.js";

/**
 * Conexión de ventilación entre dos secciones (GDD 5.5, modelo híbrido). La
 * apertura de la válvula (`valveAperture`, 0..1) modula la difusión: 1 = 100%
 * abierta (equilibrado a ~10%/s, Espec. §4), 0 = cerrada/puerta sellada (sin
 * difusión, secciones aisladas). Cerrar la válvula es la herramienta de
 * "aislamiento deliberado" del GDD 5.5 (contener una fuga, drenar O2).
 */
export interface VentilationConnection {
  readonly a: SectionId;
  readonly b: SectionId;
  /** Apertura de válvula en [0, 1]. */
  readonly valveAperture: number;
}
