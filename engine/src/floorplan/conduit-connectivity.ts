import type { ConduitConnection, ConduitKind, ShipFloorplan } from "./floorplan.types.js";
import type { SectionId } from "../atmosphere/section.types.js";

/**
 * Conectividad de secciones POR TIPO DE CONDUCTO (Fase 11f — mecánica de
 * cableado restringido, decisión del operador): un recurso de tipo `kind`
 * solo cruza el límite entre dos secciones si hay un conducto de ESE tipo
 * uniéndolas — directamente o encadenando conductos por secciones
 * intermedias. Puramente sobre la geometría del plano (`ShipFloorplan`), sin
 * estado de misión: qué se puede conectar es una propiedad fija del
 * arquetipo, autorada en Tiled (capa `conductos`).
 *
 * Esto es lo que le da sentido funcional a los conductos `electrico`/`senal`
 * (antes solo capa visual): el cableado de señal cross-section requiere un
 * camino de conductos `senal`; afectar un conducto (romperlo, sellarlo) pasa
 * a habilitar/deshabilitar rutas — base para mecánicas futuras.
 */

function buildAdjacency(
  floorplan: ShipFloorplan,
  kind: ConduitKind,
): Map<SectionId, Array<{ readonly section: SectionId; readonly conduit: ConduitConnection }>> {
  const adjacency = new Map<
    SectionId,
    Array<{ readonly section: SectionId; readonly conduit: ConduitConnection }>
  >();
  const link = (from: SectionId, to: SectionId, conduit: ConduitConnection): void => {
    if (!adjacency.has(from)) adjacency.set(from, []);
    adjacency.get(from)!.push({ section: to, conduit });
  };
  for (const conduit of floorplan.conduits) {
    if (conduit.kind !== kind) continue;
    link(conduit.a, conduit.b, conduit);
    link(conduit.b, conduit.a, conduit);
  }
  return adjacency;
}

/**
 * ¿Se puede llegar de `a` a `b` cruzando solo conductos de tipo `kind`?
 * Misma sección → siempre `true` (no hay límite que cruzar). Sin ningún
 * conducto de ese tipo entre ellas → `false` (no se conectan en esa capa).
 */
export function sectionsConnectedByConduit(
  floorplan: ShipFloorplan,
  kind: ConduitKind,
  a: SectionId,
  b: SectionId,
): boolean {
  return a === b || findConduitRoute(floorplan, kind, a, b) !== undefined;
}

/**
 * Secuencia de conductos de tipo `kind` que conecta `a` con `b` (BFS, el
 * camino más corto en cantidad de conductos), o `undefined` si no hay ruta.
 * Devuelve `[]` cuando `a === b` (misma sección, cero conductos necesarios).
 * La consume tanto la restricción de cableado (solo necesita "¿hay ruta?")
 * como el render del cable en `/game` (necesita POR CUÁLES conductos pasa
 * para dibujar la línea a través de sus pasamuros).
 */
export function findConduitRoute(
  floorplan: ShipFloorplan,
  kind: ConduitKind,
  a: SectionId,
  b: SectionId,
): readonly ConduitConnection[] | undefined {
  if (a === b) return [];
  const adjacency = buildAdjacency(floorplan, kind);
  const cameFrom = new Map<SectionId, { readonly prev: SectionId; readonly conduit: ConduitConnection }>();
  const visited = new Set<SectionId>([a]);
  const queue: SectionId[] = [a];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === b) return reconstruct(cameFrom, a, b);
    for (const edge of adjacency.get(current) ?? []) {
      if (visited.has(edge.section)) continue;
      visited.add(edge.section);
      cameFrom.set(edge.section, { prev: current, conduit: edge.conduit });
      queue.push(edge.section);
    }
  }
  return undefined;
}

function reconstruct(
  cameFrom: Map<SectionId, { readonly prev: SectionId; readonly conduit: ConduitConnection }>,
  start: SectionId,
  goal: SectionId,
): readonly ConduitConnection[] {
  const conduits: ConduitConnection[] = [];
  let current = goal;
  while (current !== start) {
    const step = cameFrom.get(current);
    if (!step) break;
    conduits.push(step.conduit);
    current = step.prev;
  }
  conduits.reverse();
  return conduits;
}
