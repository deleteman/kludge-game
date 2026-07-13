import type { SignalBehavior } from "../signal-behavior.types.js";
import type { SignalRule } from "../signal-rule.js";
import { GateRule } from "./gate-rule.js";
import { LatchRule } from "./latch-rule.js";
import { OscillatorRule } from "./oscillator-rule.js";
import { DelayRule } from "./delay-rule.js";
import { PassthroughRule } from "./passthrough-rule.js";

/**
 * Registro de reglas de señal por `kind` de behavior. El evaluador resuelve
 * qué Strategy aplicar consultando aquí — añadir un comportamiento nuevo es
 * implementar `SignalRule` y registrarlo en este mapa, sin tocar el evaluador.
 */
export function createDefaultSignalRuleRegistry(): ReadonlyMap<SignalBehavior["kind"], SignalRule> {
  const rules: SignalRule[] = [
    new GateRule(),
    new LatchRule(),
    new OscillatorRule(),
    new DelayRule(),
    new PassthroughRule(),
  ];
  return new Map(rules.map((rule) => [rule.kind, rule]));
}
