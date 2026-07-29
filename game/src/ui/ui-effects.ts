import type Phaser from "phaser";

/**
 * Fase 12c.1: helper de "juice" de UI. Configuraciones de tween estándar
 * (aparición/cierre/reacción al click/sacudida/destello) reutilizables por
 * cualquier widget, para no reimplementar el mismo tween en cada callsite —
 * la idea ya vivía dispersa en `obtained-toast.ts::fireObtainedToast` y en
 * `flashCrewCard`/`flashCrewToken` (`floorplan-scene.ts`), aquí extraída a
 * funciones nombradas.
 *
 * IMPORTANTE (pedido explícito de 12c): `shake`/`flash` agitan un CONTENEDOR de
 * UI de forma INDEPENDIENTE al mapa — no usan `cameras.main.shake` (eso movería
 * todo el plano), sino tweens sobre el propio objeto.
 *
 * Todos operan sobre cualquier `GameObject` con transform (Container, Image,
 * Text, Label de rexUI...). Antes de arrancar un tween que compite por la misma
 * propiedad (scale en hover, x en shake) se matan los tweens previos del target
 * para que no se acumulen.
 */

type Transformable = Phaser.GameObjects.GameObject & {
  x: number;
  y: number;
  scale: number;
  scaleX: number;
  scaleY: number;
  alpha: number;
  setScale(x: number, y?: number): unknown;
};

/** Aparición: crece desde 0.8 y aparece con alpha, con un leve rebote. */
export function popIn(
  scene: Phaser.Scene,
  target: Transformable,
  opts: { readonly duration?: number; readonly fromScale?: number } = {},
): Phaser.Tweens.Tween {
  const from = opts.fromScale ?? 0.8;
  target.setScale(from);
  target.alpha = 0;
  return scene.tweens.add({
    targets: target,
    scale: 1,
    alpha: 1,
    duration: opts.duration ?? 180,
    ease: "Back.easeOut",
  });
}

/** Cierre: desliza hacia un offset y se desvanece; opcionalmente destruye al terminar. */
export function slideOut(
  scene: Phaser.Scene,
  target: Transformable,
  opts: { readonly dx?: number; readonly dy?: number; readonly duration?: number; readonly destroy?: boolean } = {},
): Phaser.Tweens.Tween {
  return scene.tweens.add({
    targets: target,
    x: target.x + (opts.dx ?? 0),
    y: target.y + (opts.dy ?? 24),
    alpha: 0,
    duration: opts.duration ?? 200,
    ease: "Quad.easeIn",
    onComplete: () => {
      if (opts.destroy) target.destroy();
    },
  });
}

/** Pulso rápido de escala al hacer click (yoyo, vuelve a su escala base). */
export function clickReaction(
  scene: Phaser.Scene,
  target: Transformable,
  opts: { readonly scale?: number; readonly duration?: number } = {},
): Phaser.Tweens.Tween {
  scene.tweens.killTweensOf(target);
  const base = target.scale || 1;
  return scene.tweens.add({
    targets: target,
    scale: base * (opts.scale ?? 0.92),
    duration: opts.duration ?? 70,
    yoyo: true,
    ease: "Quad.easeOut",
    onComplete: () => target.setScale(base),
  });
}

/**
 * Sacudida horizontal de un contenedor de UI (error/colisión), independiente
 * del shake de cámara del mapa. Restaura la x original al terminar.
 */
export function shake(
  scene: Phaser.Scene,
  target: Transformable,
  opts: { readonly amplitude?: number; readonly duration?: number } = {},
): Phaser.Tweens.Tween {
  scene.tweens.killTweensOf(target);
  const baseX = target.x;
  const amp = opts.amplitude ?? 6;
  return scene.tweens.add({
    targets: target,
    x: baseX + amp,
    duration: (opts.duration ?? 240) / 8,
    yoyo: true,
    repeat: 3,
    ease: "Sine.easeInOut",
    onComplete: () => {
      target.x = baseX;
    },
  });
}

/**
 * Destello de un contenedor: un rectángulo del tamaño del objeto que aparece y
 * se desvanece encima (no altera el tint del propio objeto, así funciona sobre
 * Containers de rexUI que no exponen `setTint`). El overlay se autodestruye.
 */
export function flash(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  opts: { readonly color?: number; readonly alpha?: number; readonly duration?: number; readonly depth?: number } = {},
): Phaser.GameObjects.Rectangle {
  const rect = scene.add
    .rectangle(x, y, width, height, opts.color ?? 0xffffff, opts.alpha ?? 0.5)
    .setOrigin(0.5, 0.5);
  if (opts.depth !== undefined) rect.setDepth(opts.depth);
  scene.tweens.add({
    targets: rect,
    alpha: 0,
    duration: opts.duration ?? 260,
    ease: "Quad.easeOut",
    onComplete: () => rect.destroy(),
  });
  return rect;
}

/**
 * Engancha feedback visual de hover/click a un objeto interactivo (botón):
 * crece sutil al pasar el ratón, vuelve al salir, y late al click. Es el
 * complemento visual del sonido de hover que `createKenneyButton` ya reproduce.
 * Debe llamarse sobre un objeto YA `setInteractive(...)`.
 */
export function attachHoverJuice(
  scene: Phaser.Scene,
  target: Transformable,
  opts: { readonly hoverScale?: number } = {},
): void {
  const base = target.scale || 1;
  const hover = base * (opts.hoverScale ?? 1.04);
  target.on("pointerover", () => {
    scene.tweens.killTweensOf(target);
    scene.tweens.add({ targets: target, scale: hover, duration: 90, ease: "Quad.easeOut" });
  });
  target.on("pointerout", () => {
    scene.tweens.killTweensOf(target);
    scene.tweens.add({ targets: target, scale: base, duration: 120, ease: "Quad.easeOut" });
  });
  target.on("pointerdown", () => clickReaction(scene, target, { scale: 0.94 }));
}
