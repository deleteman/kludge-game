import type { CrisisEvalContext, CrisisResolutionRule } from "../crisis-rule.js";
import type { CrisisResolutionSpec, SignalOutputMatchesResolutionSpec } from "../crisis-definition.types.js";
import { SignalEvaluator } from "../../signals/signal-evaluator.js";
import type { SignalNodeId } from "../../signals/signal-node.types.js";
import type { PlacedComponentInstanceId } from "../../blueprint/blueprint.types.js";

/**
 * Resolución del capítulo 2 por TABLA DE VERDAD: corre el grafo de señales del
 * `Blueprint` vivo con `SignalEvaluator` (Fase 2, reutilizado tal cual) para
 * CADA caso de la spec y comprueba que `outputNodeId` produce el valor
 * esperado. Todos los casos deben cumplirse (AND) — así solo el cableado que
 * reproduce la lógica pedida (p.ej. AND de ambos sensores) resuelve, sin
 * hardcodear qué componente/gate se usa (principio 1: emergencia por topología).
 *
 * Semántica de circuito síncrono (un hop por tick): se tickea `nodes.length`
 * veces con las mismas entradas para dejar propagar la señal hasta la salida y
 * estabilizarla. El combinador del capítulo 2 es combinacional (gate AND/OR/
 * NOT), que ignora el tiempo, así que `elapsedSeconds` constante es suficiente;
 * un capítulo con osciladores/delays necesitaría avanzar el reloj, se resuelve
 * cuando exista ese caso.
 */
export class SignalOutputMatchesRule implements CrisisResolutionRule {
  readonly kind = "signal-output-matches" as const;

  isResolved(spec: CrisisResolutionSpec, ctx: CrisisEvalContext): boolean {
    const typedSpec = spec as SignalOutputMatchesResolutionSpec;
    const graph = ctx.ship.signalGraph;
    if (!graph.nodes.some((node) => node.id === typedSpec.outputNodeId)) {
      return false;
    }

    const evaluator = new SignalEvaluator<PlacedComponentInstanceId>(graph);
    const propagationTicks = Math.max(1, graph.nodes.length);

    return typedSpec.cases.every((testCase) => {
      const state = evaluator.createState();
      const inputs = new Map<SignalNodeId, boolean>(
        testCase.inputs.map((input) => [input.nodeId, input.active]),
      );
      for (let i = 0; i < propagationTicks; i += 1) {
        evaluator.tick(state, inputs, { dtSeconds: 0, elapsedSeconds: 0 });
      }
      const output = state.get(typedSpec.outputNodeId)?.output ?? false;
      return output === testCase.expected;
    });
  }
}
