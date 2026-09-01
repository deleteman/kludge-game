import Phaser from "phaser";

import type { PositionedSignalNode } from "../../render/signal-node-layout.js";
import { RENDER_DEPTH } from "../../render/render-depths.js";
import { hexToCss, SIGNAL_NODE_COLORS } from "../../render/palette.js";

/**
 * Menú circular para elegir entre nodos de señal superpuestos (14a-4, ronda 2
 * de playtest).
 *
 * **Por qué existe.** Desde que un `ACT` expone entrada y salida (ronda 1), toda
 * puerta de 1 celda tiene dos nodos a 16 px en una celda de 32, con radios de
 * click de 10: las zonas se solapan. `signalNodeAtPoint` elegía el más cercano
 * —determinista, pero mudo—, y el operador lo reportó como "hacerle click a uno
 * de ellos y no al otro es muy difícil".
 *
 * Afinar la tolerancia solo habría cambiado a quién le tocaba fallar. La
 * decisión del operador fue **dejar de adivinar**: con ambigüedad real se
 * pregunta. Aparece SOLO cuando hay más de un candidato, así que el gesto normal
 * de cablear —un LED, un sensor— no gana ningún paso.
 *
 * Vive en coordenadas de MUNDO y no de pantalla: cuelga de la pieza que se
 * clickeó, y si el jugador panea el mapa tiene que irse con ella.
 */

/** Radio del anillo de opciones alrededor del punto clickeado, en píxeles. */
const MENU_RADIUS_PX = 34;
const OPTION_RADIUS_PX = 13;

export interface SignalNodeMenuLabels {
  /** Nombre del rol de un nodo: "entrada", "salida"… */
  readonly roleLabel: (node: PositionedSignalNode) => string;
}

export interface SignalNodeMenuCallbacks {
  readonly onPick: (node: PositionedSignalNode) => void;
  /** Click fuera del menú: se cierra sin elegir. */
  readonly onCancel: () => void;
}

/**
 * Construye el menú. Devuelve el contenedor para que el llamador lo destruya —
 * la escena es la dueña del ciclo de vida, igual que con el resto de los
 * widgets contextuales.
 */
export function createSignalNodeMenu(
  scene: Phaser.Scene,
  candidates: ReadonlyArray<PositionedSignalNode>,
  labels: SignalNodeMenuLabels,
  callbacks: SignalNodeMenuCallbacks,
): Phaser.GameObjects.Container {
  // El menú se ancla en el CENTRO de la celda compartida y no en el píxel del
  // click: si se anclara al click, dos aperturas seguidas sobre la misma pieza
  // pondrían las opciones en lugares distintos y el jugador no podría
  // aprenderse el gesto.
  const anchorX = candidates.reduce((sum, node) => sum + node.x, 0) / candidates.length;
  const anchorY = candidates.reduce((sum, node) => sum + node.y, 0) / candidates.length;

  const container = scene.add.container(anchorX, anchorY).setDepth(RENDER_DEPTH.problemMarker);

  // Fondo que traga el click de afuera. Cubre el mundo entero para que cerrar
  // el menú no dispare además la acción de la celda que hay debajo.
  const dismiss = scene.add
    .rectangle(0, 0, 1e5, 1e5, 0x000000, 0.001)
    .setInteractive({ useHandCursor: false })
    .on("pointerdown", () => callbacks.onCancel());
  container.add(dismiss);

  candidates.forEach((node, index) => {
    // Reparto regular arrancando ARRIBA: con dos opciones —el caso normal desde
    // 14a-4— quedan una arriba y otra abajo, sin taparse con la etiqueta.
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / candidates.length;
    const x = Math.cos(angle) * MENU_RADIUS_PX;
    const y = Math.sin(angle) * MENU_RADIUS_PX;

    const dot = scene.add
      .circle(x, y, OPTION_RADIUS_PX, SIGNAL_NODE_COLORS[node.role])
      .setStrokeStyle(2, 0xffffff, 0.9)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
        // Sin esto el mismo click llega al fondo de descarte y el menú se
        // cierra sin elegir.
        event.stopPropagation();
        callbacks.onPick(node);
      })
      .on("pointerover", () => dot.setScale(1.15))
      .on("pointerout", () => dot.setScale(1));

    const label = scene.add
      .text(x, y + OPTION_RADIUS_PX + 2, labels.roleLabel(node), {
        fontFamily: "sans-serif",
        fontSize: "11px",
        color: hexToCss(SIGNAL_NODE_COLORS[node.role]),
        stroke: "#0a0d14",
        strokeThickness: 3,
      })
      .setOrigin(0.5, 0);

    container.add([dot, label]);
  });

  return container;
}
