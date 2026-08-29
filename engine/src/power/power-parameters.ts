import type { ComponentId } from "../components/physical-component.types.js";

/**
 * Demanda eléctrica declarada por pieza (Subfase 13g). Data-driven (CLAUDE.md):
 * `build-component-catalog.ts` inyecta estos números en `data.powerDraw` al
 * construir el catálogo, así que ni los specs de catálogo ni la lógica de
 * reparto contienen un literal de consumo. Mismo criterio que
 * `SALVAGE_HAZARD_PARAMETERS` / `KINETIC_IMPACT_PARAMETERS`.
 *
 * Por qué DECLARADA por pieza y no derivada de las propiedades (decisión del
 * ciclo de preguntas de 13g): es lo que permite que una pieza se quede sin
 * energía aunque su sección tenga algo — exactamente para lo que existe el
 * triaje de prioridad por instancia de 13b. Una demanda derivada de tags haría
 * que todas las piezas de la misma clase fueran indistinguibles en el triaje.
 *
 * Criterio de partida (los números finos son balanceo, Fase 23 — lo que cierra
 * 13g es que EXISTAN y se respeten):
 * - **1** — piezas de pura señal: `EM` y/o `REC` sin `ACT` (sensores, chips,
 *   indicadores, consolas, radios).
 * - **2** — piezas con `ACT` que hacen trabajo físico moderado (`power < 80`).
 * - **3** — mesas (`FAB`) y equipamiento pesado (`ACT` con `power >= 80`).
 *
 * Qué NO consume, y por qué (ausente de la tabla = 0):
 * - `COND(E)` (cable, bobina, resistencia, fibra óptica): CONDUCEN energía, no
 *   la consumen. Darles demanda cobraría dos veces el mismo cable.
 * - `RES(E)` (célula fotovoltaica, batería, reactor): son la OFERTA. Coherente
 *   con `isElectricSource`, que las exime también del riesgo de canibalización.
 * - Piezas puramente estructurales (`EST`), tubos y reservorios de L/G: no
 *   participan del sistema eléctrico (criterio de `isElectricallyLive`).
 */
export const POWER_DRAW_BY_COMPONENT: Readonly<Record<string, number>> = {
  // ── Atómicos ──────────────────────────────────────────────────────────────
  "chip-circuito-generico": 1,
  "indicador-led": 1,
  "pantalla-lcd": 1,
  fotorreceptor: 1,
  "sensor-presion": 1,
  "emisor-laser-baja-potencia": 2,
  "valvula-simple": 2,
  "motor-pequeno": 2,

  // ── Señal pura (EM/REC sin ACT) ───────────────────────────────────────────
  "sensor-movimiento-laser": 1,
  "sensor-termico-precision": 1,
  "sensor-presion-gas": 1,
  "servidor-analisis": 1,
  "escaner-espectro": 1,
  "microscopio-electronico": 1,
  "telescopio-largo-alcance": 1,
  "radio-largo-alcance": 1,
  "sistema-navegacion-estelar": 1,
  "sistema-comunicacion-cifrada": 1,
  "consola-mando-central": 1,
  "radar-largo-alcance": 1,
  "sistema-diagnostico": 1,
  "sensor-biometrico-tripulante": 1,
  "comunicador-emergencia-medica": 1,
  "camara-aislamiento-biologico": 1,
  "kit-medico-basico": 1,

  // ── Actuadores (ACT con power < 80) ───────────────────────────────────────
  "brazo-robotico-laboratorio": 2,
  "dron-reconocimiento": 2,
  "impresora-3d-piezas": 2,
  centrifuga: 2,
  "sistema-purificacion-aire": 2,
  "sistema-reciclaje-agua-aire": 2,
  "impresora-piezas-repuesto": 2,
  "sistema-hibernacion": 2,
  "sellador-emergencia-casco": 2,
  "invernadero-hidroponico": 2,
  "herramientas-reparacion-externa": 2,
  "garra-de-abordaje": 2,
  "laser-quirurgico": 2,
  "camilla-automatizada": 2,
  "esterilizador-uv": 2,
  "banco-sangre-fluidos": 2,
  "brazo-robotico-quirurgico": 2,
  "ventilador-mecanico": 2,
  "farmacia-automatizada": 2,
  "generador-oxigeno-precision": 2,
  "sistema-refrigeracion-muestras": 2,
  /**
   * La puerta (13h) fue el PRIMER consumidor real del proyecto y su 2 venía
   * escrito a mano en el `ACT` de `guerra.ts`. Conserva el mismo número al
   * migrar acá, para que la subfase no cambie el balance de puertas de paso.
   */
  "compuerta-blindada": 2,

  // ── Equipamiento pesado (ACT con power >= 80) y mesas (FAB) ───────────────
  "canon-laser": 3,
  "generador-escudo": 3,
  "torreta-automatizada": 3,
  "motor-propulsion-combate": 3,
  "motor-crucero-eficiente": 3,
  /**
   * Las dos mesas, no solo la química (decisión del operador en 13g). `FAB` no
   * es `ACT` —no hace trabajo físico sobre el mundo, GDD §5.1— pero sí requiere
   * alimentación para operar, que es justo lo que `powerDraw` como dato de
   * componente (y no como campo de `ACT`) hace expresable.
   */
  "banco-de-trabajo": 3,
  "estacion-quimica": 3,
};

/** Demanda declarada de una pieza del catálogo, o 0 si no declara consumo. */
export function declaredPowerDraw(componentId: ComponentId): number {
  return POWER_DRAW_BY_COMPONENT[componentId] ?? 0;
}
