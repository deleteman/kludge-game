import Phaser from "phaser";
import { effectiveFootprintExtent, GRID_CELL_SIZE_PX, occupiedCells } from "engine";
import type {
  Blueprint,
  ComponentId,
  CreationPart,
  GridPosition,
  PhysicalComponentDefinition,
  PlacedComponentInstanceId,
  ShipFloorplan,
  SignalEdge,
  SignalEdgeId,
} from "engine";

import { RENDER_DEPTH } from "./render-depths.js";
import {
  componentTextureKey,
  ensureComponentPlaceholderTexture,
  hasComponentSprite,
} from "./component-sprite-registry.js";
import { computeSignalWireRoute } from "./conduit-path.js";
import { resolveComponentVisual } from "./component-state-visuals.js";
import type { WalkableGrid } from "./walkable-grid.js";
import {
  BURNED_WIRE_ALPHA,
  BURNED_WIRE_COLOR,
  LABEL_COLOR,
  LED_INACTIVE_TINT,
  SECTION_FILL_COLORS,
  SIGNAL_NODE_COLORS,
  WALL_COLOR,
  wireLoadColor,
} from "./palette.js";

/** `componentDefinitionId` del catálogo atómico (Subfase 11h) — únicos consumidos por este renderer. */
export const LED_INDICATOR_COMPONENT_ID = "indicador-led" as ComponentId;
export const LCD_DISPLAY_COMPONENT_ID = "pantalla-lcd" as ComponentId;

/** Resultado del overlay de misión: `container` con todo, y `signalGraphics` (nodos + cables) aparte para poder atenuarlo con la capa `señales` del HUD (Fase 11f.3). */
export interface MissionOverlayRender {
  readonly container: Phaser.GameObjects.Container;
  readonly signalGraphics: Phaser.GameObjects.Graphics;
  /**
   * Sprites de Indicador LED por instancia (Subfase 11h), objetos propios
   * (no bakeados en el `graphics` compartido del placeholder) para poder
   * retintarlos cada tick sin redibujar todo el overlay — ver
   * `FloorplanScene.updateLedIndicators`.
   */
  readonly ledIndicatorsByInstanceId: ReadonlyMap<PlacedComponentInstanceId, Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle>;
  /**
   * Texto de Pantalla LCD por instancia (Subfase 11h), actualizado con
   * throttle (250-500ms) desde `FloorplanScene.updateLcdDisplays`, no cada
   * frame — ver doc fuente §2.
   */
  readonly lcdDisplaysByInstanceId: ReadonlyMap<PlacedComponentInstanceId, Phaser.GameObjects.Text>;
  /**
   * Sprites reales por instancia (13e ronda 8, fix #2 de playtest: resaltar la
   * pieza misma en el modo de trasvase, no un círculo suelto). Un array porque
   * una creación con `layout` puede pintar varias partes, cada una con su
   * propio sprite.
   *
   * Desde la Subfase 13g (deuda #38) incluye TAMBIÉN a las piezas sin arte: su
   * placeholder dejó de ser un relleno del `Graphics` batcheado y pasó a ser un
   * `Image` por celda sobre una textura blanca. Antes esas piezas no eran
   * objetos, así que no podían recibir ni el tinte por estado ni el sombreado
   * por luz — su estado solo se leía en el tooltip y el panel.
   */
  readonly componentSpritesByInstanceId: ReadonlyMap<PlacedComponentInstanceId, ReadonlyArray<Phaser.GameObjects.Image>>;
}

const CELL = GRID_CELL_SIZE_PX;

/**
 * Capa dinámica ESTÁTICA de una misión en curso (Fase 10d): componentes
 * colocados (teñidos por `condition`) y grafo de señales real del
 * `Blueprint` — todo lo que `floorplan-renderer.ts` (puramente estático,
 * Fase 5/8) no conoce. Hermano de `workbench-renderer.ts`: mismo grid/celda,
 * mismo criterio de solape, pero sobre el `Blueprint` vivo de la partida en
 * vez de la mesa de creación.
 *
 * Los tokens de tripulación NO viven acá: necesitan identidad de objeto
 * persistente entre redibujados para poder animar el salto (`hop-movement.ts`,
 * Fase 8) al completarse un `go-to` — los gestiona `FloorplanScene`
 * directamente. Esta capa sí se destruye/reconstruye por completo en cada
 * cambio (mismo patrón `redraw()` que el resto del proyecto), porque no
 * necesita animarse: cambia solo en eventos discretos (tarea completada).
 */
export function renderMissionOverlay(
  scene: Phaser.Scene,
  blueprint: Blueprint,
  // Fase 11f: con el plano + grilla, un cable de señal que cruza secciones se
  // dibuja RUTEADO por los conductos `senal` (mismo `findConduitRoute` que la
  // regla que lo habilita), no en línea recta. Sin ellos (llamador que no los
  // pasa), cae a la recta de siempre.
  floorplan?: ShipFloorplan,
  walkableGrid?: WalkableGrid,
  // Deuda #8 (Fase 12c.5): resuelve la definición de un componente por id, para
  // que una creación (`creation-XXXX`, sin sprite propio) se dibuje con los
  // sprites reales de sus partes según su `layout`. Sin él, cae al placeholder.
  resolveDefinition?: (id: ComponentId) => PhysicalComponentDefinition | undefined,
  /**
   * Subfase 14a-4: estado vivo de cada cable, para pintarlo por lo que le pasa.
   * `edgeLoadRatio` viene del MISMO cálculo que decide el corte
   * (`MissionOverloadRuntime.edgeStatus`, vía `MissionRuntime.edgeLoadRatio`),
   * no de una copia — es lo que evita que la UI diga "seguro" mientras el motor
   * corta. Ausentes (llamador que no los pasa): todos los cables verdes, el
   * comportamiento previo a 14a-4.
   */
  wireState?: {
    readonly edgeLoadRatio?: (edge: SignalEdge) => number | undefined;
    readonly burnedEdgeIds?: ReadonlySet<SignalEdgeId>;
  },
): MissionOverlayRender {
  const container = scene.add.container(0, 0).setDepth(RENDER_DEPTH.objects);
  const graphics = scene.add.graphics();
  container.add(graphics);
  const ledIndicatorsByInstanceId = new Map<
    PlacedComponentInstanceId,
    Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle
  >();
  const lcdDisplaysByInstanceId = new Map<PlacedComponentInstanceId, Phaser.GameObjects.Text>();
  const componentSpritesByInstanceId = new Map<PlacedComponentInstanceId, ReadonlyArray<Phaser.GameObjects.Image>>();

  blueprint.placedComponents.forEach((instance, index) => {
    // La prioridad `condition > wear` vivía escrita a mano acá (Fase 13c) y se
    // mudó a `resolveComponentVisual` en la ronda 3 de playtest de 13h: es la
    // ÚNICA fuente de "de qué color va esta pieza". Sin eso, el estado derivado
    // que la escena pinta por frame y el tinte que este renderer pone al crear
    // el sprite se habrían pisado según quién escribió último.
    //
    // Acá se resuelve sin los estados vivos (el renderer no los conoce): el
    // `updateComponentStateTints` de la escena completa la resolución en el
    // mismo frame, sobre la misma tabla.
    const tint = resolveComponentVisual(instance).tint;
    const { width, height } = effectiveFootprintExtent(instance.placement);
    const originX = instance.placement.position.x * CELL;
    const originY = instance.placement.position.y * CELL;

    // Indicador LED (Subfase 11h): objeto PROPIO (no el `graphics` batcheado
    // de abajo) para poder retintarlo cada tick según estado de señal sin
    // redibujar todo el overlay — arranca apagado, `updateLedIndicators` lo
    // actualiza en cuanto corre el primer tick de señales.
    if (instance.componentDefinitionId === LED_INDICATOR_COMPONENT_ID) {
      const led = hasComponentSprite(scene, instance.componentDefinitionId)
        ? scene.add
            .image(originX, originY, componentTextureKey(instance.componentDefinitionId))
            .setOrigin(0, 0)
            .setDisplaySize(width * CELL, height * CELL)
        : scene.add.rectangle(originX, originY, width * CELL, height * CELL, LED_INACTIVE_TINT).setOrigin(0, 0);
      led.setDepth(RENDER_DEPTH.objects);
      container.add(led);
      ledIndicatorsByInstanceId.set(instance.instanceId, led);
      graphics.lineStyle(2, tint ?? WALL_COLOR, 1);
      graphics.strokeRect(originX, originY, width * CELL, height * CELL);
      return;
    }

    // Pantalla LCD (Subfase 11h): mismo placeholder/sprite que el resto, más
    // un `Text` propio superpuesto con el valor real — actualizado con
    // throttle desde `updateLcdDisplays`, no acá (todavía no hay tick vivo).
    if (instance.componentDefinitionId === LCD_DISPLAY_COMPONENT_ID) {
      if (hasComponentSprite(scene, instance.componentDefinitionId)) {
        const sprite = scene.add
          .image(originX, originY, componentTextureKey(instance.componentDefinitionId))
          .setOrigin(0, 0)
          .setDisplaySize(width * CELL, height * CELL)
          .setDepth(RENDER_DEPTH.objects);
        if (tint !== undefined) sprite.setTint(tint);
        container.add(sprite);
        componentSpritesByInstanceId.set(instance.instanceId, [sprite]);
      } else {
        // Mismo placeholder tinteable que el resto (deuda #38): la LCD también
        // declara consumo desde 13g, así que también puede quedarse a oscuras.
        const color = tint ?? SECTION_FILL_COLORS[index % SECTION_FILL_COLORS.length]!;
        const placeholder = scene.add
          .image(originX, originY, ensureComponentPlaceholderTexture(scene))
          .setOrigin(0, 0)
          .setDisplaySize(width * CELL, height * CELL)
          .setAlpha(0.85)
          .setTint(color)
          .setDepth(RENDER_DEPTH.objects);
        container.add(placeholder);
        componentSpritesByInstanceId.set(instance.instanceId, [placeholder]);
      }
      graphics.lineStyle(2, tint ?? WALL_COLOR, 1);
      graphics.strokeRect(originX, originY, width * CELL, height * CELL);
      const text = scene.add
        .text(originX + width * CELL / 2, originY + height * CELL / 2, "…", {
          fontSize: "10px",
          color: LABEL_COLOR,
        })
        .setOrigin(0.5, 0.5)
        .setDepth(RENDER_DEPTH.objects + 1);
      container.add(text);
      lcdDisplaysByInstanceId.set(instance.instanceId, text);
      return;
    }

    // Sprite real si existe (tinte por `condition`, principio 6 de CLAUDE.md);
    // si no, una creación con `layout` se dibuja como los sprites de sus partes
    // (deuda #8, Fase 12c.5); si tampoco, el rectángulo de color placeholder.
    const definition = resolveDefinition?.(instance.componentDefinitionId);
    const layout = definition?.level === "composite" ? definition.data.layout : undefined;
    if (hasComponentSprite(scene, instance.componentDefinitionId)) {
      const sprite = scene.add
        .image(originX, originY, componentTextureKey(instance.componentDefinitionId))
        .setOrigin(0, 0)
        .setDisplaySize(width * CELL, height * CELL)
        .setDepth(RENDER_DEPTH.objects);
      if (tint !== undefined) sprite.setTint(tint);
      container.add(sprite);
      componentSpritesByInstanceId.set(instance.instanceId, [sprite]);
    } else if (layout && layout.length > 0) {
      const parts = drawCreationLayout(scene, container, graphics, originX, originY, layout, tint, index);
      if (parts.length > 0) componentSpritesByInstanceId.set(instance.instanceId, parts);
    } else {
      // Deuda #38 (13g): el placeholder deja de ser un relleno del `Graphics`
      // batcheado y pasa a ser un objeto POR INSTANCIA. Antes no era tinteable
      // ni sombreable —no existía como objeto—, así que una pieza sin arte no
      // podía mostrar su estado en el plano, solo en el tooltip y el panel. Y
      // 13g es justo lo que deja sin energía a chips, sensores y mesas, que son
      // en su mayoría piezas sin arte todavía.
      const color = tint ?? SECTION_FILL_COLORS[index % SECTION_FILL_COLORS.length]!;
      const texture = ensureComponentPlaceholderTexture(scene);
      const parts = occupiedCells(instance.placement).map((cell) =>
        scene.add
          .image(cell.x * CELL, cell.y * CELL, texture)
          .setOrigin(0, 0)
          .setDisplaySize(CELL, CELL)
          .setAlpha(0.85)
          .setTint(color)
          .setDepth(RENDER_DEPTH.objects),
      );
      for (const part of parts) container.add(part);
      if (parts.length > 0) componentSpritesByInstanceId.set(instance.instanceId, parts);
    }

    graphics.lineStyle(2, tint ?? WALL_COLOR, 1);
    graphics.strokeRect(originX, originY, width * CELL, height * CELL);
    // El nombre del componente ya no se dibuja fijo sobre la pieza (playtest #14):
    // se muestra como tooltip al pasar el mouse (`FloorplanScene.updateTooltip`).
  });

  // El grafo de señal (nodos + cables) va en su PROPIO `Graphics` (Fase 11f.3):
  // es el contenido de la capa `señales` del HUD, así que la escena lo atenúa
  // junto con `conduitLayers.senal` al desactivar esa capa — sin tocar los
  // componentes físicos, que quedan en `graphics` (siempre visibles).
  const signalGraphics = scene.add.graphics();
  container.add(signalGraphics);

  drawSignalLayer(signalGraphics, blueprint, floorplan, walkableGrid, wireState);

  return { container, signalGraphics, ledIndicatorsByInstanceId, lcdDisplaysByInstanceId, componentSpritesByInstanceId };
}

/**
 * Dibuja una creación con `layout` (deuda #8, Fase 12c.5) como los sprites
 * reales de sus partes, cada una en su offset dentro del footprint. Una parte
 * sin sprite cae a un rectángulo placeholder (no bloquea al resto). El sprite
 * se centra en la extensión efectiva de la parte y se rota por `part.rotation`,
 * así que la imagen base (sin rotar) queda alineada con su celda ocupada.
 */
function drawCreationLayout(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  graphics: Phaser.GameObjects.Graphics,
  originX: number,
  originY: number,
  layout: ReadonlyArray<CreationPart>,
  tint: number | undefined,
  index: number,
): ReadonlyArray<Phaser.GameObjects.Image> {
  const sprites: Phaser.GameObjects.Image[] = [];
  layout.forEach((part, partIndex) => {
    const ext = effectiveFootprintExtent({ position: { x: 0, y: 0 }, footprint: part.footprint, rotation: part.rotation });
    const partX = originX + part.offset.x * CELL;
    const partY = originY + part.offset.y * CELL;
    if (hasComponentSprite(scene, part.ref)) {
      const sprite = scene.add
        .image(partX + (ext.width * CELL) / 2, partY + (ext.height * CELL) / 2, componentTextureKey(part.ref))
        .setOrigin(0.5)
        // La imagen base (sin rotar) mide footprint.width×height; al rotarla su
        // caja visible coincide con la extensión efectiva ya calculada arriba.
        .setDisplaySize(part.footprint.width * CELL, part.footprint.height * CELL)
        .setAngle(part.rotation)
        .setDepth(RENDER_DEPTH.objects);
      if (tint !== undefined) sprite.setTint(tint);
      container.add(sprite);
      sprites.push(sprite);
    } else {
      const color = tint ?? SECTION_FILL_COLORS[(index + partIndex) % SECTION_FILL_COLORS.length]!;
      graphics.fillStyle(color, 0.85);
      graphics.fillRect(partX, partY, ext.width * CELL, ext.height * CELL);
    }
  });
  return sprites;
}

/** Dibuja un cable de señal ruteado por conductos (Fase 11f) — recta si no hay plano/grilla o si es intra-sección. */
function drawSignalEdge(
  graphics: Phaser.GameObjects.Graphics,
  from: GridPosition,
  to: GridPosition,
  floorplan: ShipFloorplan | undefined,
  walkableGrid: WalkableGrid | undefined,
): void {
  const center = (n: number): number => n * CELL + CELL / 2;
  if (!floorplan) {
    graphics.lineBetween(center(from.x), center(from.y), center(to.x), center(to.y));
    return;
  }
  // `computeSignalWireRoute` devuelve PÍXELES (Fase 11f.2), con el marcador del
  // conducto como vértice exacto — se dibuja directo, sin re-centrar.
  const route = computeSignalWireRoute(floorplan, walkableGrid, from, to);
  if (route.length < 2) {
    graphics.lineBetween(center(from.x), center(from.y), center(to.x), center(to.y));
    return;
  }
  graphics.beginPath();
  graphics.moveTo(route[0]!.x, route[0]!.y);
  for (const point of route.slice(1)) graphics.lineTo(point.x, point.y);
  graphics.strokePath();
}

/**
 * Dibuja la capa de señal completa (cables + nodos) sobre un `Graphics` ya
 * existente (Subfase 14a-4).
 *
 * Extraída de `renderMissionOverlay` para poder REPINTARLA sola. Desde 14a-4 el
 * color de un cable depende de su carga contra su capacidad efectiva, y esa
 * capacidad baja cuando la sala se calienta o se enfría — sin que el jugador
 * toque nada y sin que cambie la topología. Si el color solo se recalculara al
 * reconstruir el overlay entero, un cable a punto de reventar se seguiría viendo
 * verde: la UI mintiendo sobre el estado del motor, que es el error recurrente
 * de este proyecto. Repintar solo `Graphics` es barato; reconstruir el overlay
 * (sprites, textos, luces) no lo sería.
 */
export function drawSignalLayer(
  signalGraphics: Phaser.GameObjects.Graphics,
  blueprint: Blueprint,
  floorplan: ShipFloorplan | undefined,
  walkableGrid: WalkableGrid | undefined,
  wireState?: {
    readonly edgeLoadRatio?: (edge: SignalEdge) => number | undefined;
    readonly burnedEdgeIds?: ReadonlySet<SignalEdgeId>;
  },
): void {
  signalGraphics.clear();
  const edgeLoadRatio = wireState?.edgeLoadRatio;
  const burnedEdgeIds = wireState?.burnedEdgeIds;
  // Nodos y aristas se dibujan en el CENTRO de la celda (`+ CELL/2`), no en la
  // esquina, para que el punto quede sobre el sprite del componente y el cable
  // conecte de centro a centro (playtest #15). El hit-test del cableado usa la
  // celda (`Math.floor(worldPoint/CELL)`), así que centrar es solo visual.
  const center = (n: number): number => n * CELL + CELL / 2;
  const nodeById = new Map(blueprint.signalGraph.nodes.map((node) => [node.id, node]));
  // Cable en el color de la capa `senal` (Fase 11f.3) — unifica cable/conducto/capa.
  // Subfase 14a-4: el color deja de ser fijo. Un cable tiene carga y capacidad,
  // y tiene que AVISAR antes de reventar; uno quemado se ve carbonizado y no se
  // confunde con uno sano. El `lineStyle` pasa a fijarse por arista.
  for (const edge of blueprint.signalGraph.edges) {
    const from = nodeById.get(edge.from);
    const to = nodeById.get(edge.to);
    if (!from || !to) continue;
    const burned = burnedEdgeIds?.has(edge.id) ?? false;
    if (burned) {
      // Más fino y apagado: dejó de ser un conducto, es una cicatriz.
      signalGraphics.lineStyle(1, BURNED_WIRE_COLOR, BURNED_WIRE_ALPHA);
    } else {
      signalGraphics.lineStyle(2, wireLoadColor(edgeLoadRatio?.(edge)), 0.85);
    }
    drawSignalEdge(signalGraphics, from.position, to.position, floorplan, walkableGrid);
  }
  for (const node of blueprint.signalGraph.nodes) {
    signalGraphics.fillStyle(SIGNAL_NODE_COLORS[node.role], 1);
    signalGraphics.fillCircle(center(node.position.x), center(node.position.y), 7);
  }
}
