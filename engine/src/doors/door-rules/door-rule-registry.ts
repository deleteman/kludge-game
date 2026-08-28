import type { DoorGovernanceRule } from "../door-governance.js";
import { DestroyedDoorRule } from "./destroyed-rule.js";
import { MagneticLockRule } from "./magnetic-lock-rule.js";
import { DamageJamRule } from "./damage-jam-rule.js";
import { UnpoweredDoorRule } from "./unpowered-rule.js";
import { SignalDoorRule } from "./signal-rule.js";
import { TaskOverrideDoorRule } from "./task-override-rule.js";
import { AutoProximityRule } from "./auto-proximity-rule.js";

/**
 * Registro ORDENADO de reglas de gobierno de puertas (Subfase 13h).
 *
 * A diferencia del registro de reglas de señal —un mapa por `kind`, donde el
 * behavior elige su Strategy— acá el orden ES la semántica: la prioridad
 * "trabada > sin energía > señal > tarea > auto" del diseño de la subfase vive
 * en este array y en ningún otro lado.
 *
 * Añadir un motivo nuevo por el que una puerta deja de obedecer = implementar
 * `DoorGovernanceRule` y meterla en la posición que le toque. `AutoProximityRule`
 * debe quedar SIEMPRE última: es la única que aplica incondicionalmente y la
 * que garantiza que la resolución nunca se quede sin respuesta.
 */
export function createDefaultDoorRuleRegistry(): readonly DoorGovernanceRule[] {
  return [
    new DestroyedDoorRule(),
    new MagneticLockRule(),
    new DamageJamRule(),
    new UnpoweredDoorRule(),
    new SignalDoorRule(),
    new TaskOverrideDoorRule(),
    new AutoProximityRule(),
  ];
}
