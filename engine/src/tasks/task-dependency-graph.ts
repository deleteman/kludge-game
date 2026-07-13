import type { CrewTask, CrewTaskId } from "./task.types.js";

/**
 * Chequeos de integridad del grafo de dependencias entre tareas (GDD §4: "el
 * motor debe rechazar dependencias circulares … (A espera a B, B espera a A)").
 * Funciones puras que devuelven issues tipados — el llamador (scheduler) decide
 * si lanzar; mismo patrón que `signals/signal-graph-integrity.ts`.
 *
 * NO valida semántica de negocio (que la dependencia "tenga sentido"), solo la
 * consistencia estructural del grafo: sin auto-dependencia, sin referencias a
 * tareas inexistentes, sin ciclos.
 */
export interface TaskDependencyIssue {
  readonly kind: "self-dependency" | "missing-dependency" | "circular-dependency";
  readonly detail: string;
}

/**
 * Valida la incorporación de `candidate` al conjunto de tareas ya existentes
 * (`existingById`, que NO debe incluir todavía al candidato). Devuelve todos
 * los problemas encontrados; array vacío = grafo válido tras añadir el candidato.
 */
export function validateTaskDependencies(
  candidate: CrewTask,
  existingById: ReadonlyMap<CrewTaskId, CrewTask>,
): TaskDependencyIssue[] {
  const issues: TaskDependencyIssue[] = [];

  for (const depId of candidate.dependsOn) {
    if (depId === candidate.id) {
      issues.push({
        kind: "self-dependency",
        detail: `Task ${candidate.id} depends on itself`,
      });
    } else if (!existingById.has(depId)) {
      issues.push({
        kind: "missing-dependency",
        detail: `Task ${candidate.id} depends on unknown task ${depId}`,
      });
    }
  }

  // Solo tiene sentido buscar ciclos si todas las referencias resuelven; si hay
  // dangling, el grafo aún no está completo y el ciclo se reportaría con ruido.
  if (issues.length === 0) {
    const combined = new Map(existingById);
    combined.set(candidate.id, candidate);
    if (graphHasCycle(combined)) {
      issues.push({
        kind: "circular-dependency",
        detail: `Adding task ${candidate.id} would create a circular dependency`,
      });
    }
  }

  return issues;
}

/**
 * ¿El grafo (tarea → cada una de sus dependencias) contiene un ciclo? DFS con
 * colores blanco/gris/negro. Reutilizado tanto al encolar como al vincular una
 * dependencia nueva entre dos tareas ya existentes (GDD §4.3, "vincular").
 */
export function graphHasCycle(tasksById: ReadonlyMap<CrewTaskId, CrewTask>): boolean {
  const WHITE = 0;
  const GREY = 1;
  const BLACK = 2;
  const color = new Map<CrewTaskId, number>();

  const visit = (id: CrewTaskId): boolean => {
    color.set(id, GREY);
    for (const dep of tasksById.get(id)?.dependsOn ?? []) {
      const depColor = color.get(dep) ?? WHITE;
      if (depColor === GREY) {
        return true; // arista de retorno → ciclo
      }
      if (depColor === WHITE && visit(dep)) {
        return true;
      }
    }
    color.set(id, BLACK);
    return false;
  };

  for (const id of tasksById.keys()) {
    if ((color.get(id) ?? WHITE) === WHITE && visit(id)) {
      return true;
    }
  }
  return false;
}
