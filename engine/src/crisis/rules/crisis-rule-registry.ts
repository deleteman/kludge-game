import type { CrisisResolutionRule, CrisisTriggerRule } from "../crisis-rule.js";
import { JammedActuatorBlocksSectionRule } from "./jammed-actuator-blocks-section.js";
import { MotionSensorsActiveRule } from "./motion-sensors-active.js";
import { ReplacementInstalledConnectedRule } from "./replacement-installed-connected.js";
import { FunctionalTagInstalledRule } from "./functional-tag-installed.js";
import { SignalNodesWiredRule } from "./signal-nodes-wired.js";
import { SignalOutputMatchesRule } from "./signal-output-matches.js";

/**
 * Registro de reglas de crisis por `kind`, mismo patrón que
 * `createDefaultSignalRuleRegistry`. Reglas nuevas se añaden implementando
 * `CrisisTriggerRule`/`CrisisResolutionRule` y registrándolas aquí, sin tocar
 * `crisis-machine.ts`.
 */
export function createDefaultCrisisTriggerRegistry(): ReadonlyMap<string, CrisisTriggerRule> {
  const rules: CrisisTriggerRule[] = [
    new JammedActuatorBlocksSectionRule(),
    new MotionSensorsActiveRule(),
  ];
  return new Map(rules.map((rule) => [rule.kind, rule]));
}

export function createDefaultCrisisResolutionRegistry(): ReadonlyMap<string, CrisisResolutionRule> {
  const rules: CrisisResolutionRule[] = [
    new ReplacementInstalledConnectedRule(),
    new FunctionalTagInstalledRule(),
    new SignalNodesWiredRule(),
    new SignalOutputMatchesRule(),
  ];
  return new Map(rules.map((rule) => [rule.kind, rule]));
}
