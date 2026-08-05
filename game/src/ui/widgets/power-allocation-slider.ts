import Phaser from "phaser";
import { UI_FONT_FAMILY } from "../fonts.js";
import { ENERGY_LAYER_COLOR, LABEL_COLOR, POWER_BLOCKED_FLASH_COLOR } from "../../render/palette.js";
import { UI_POINTER_CURSOR_CSS } from "../custom-cursor.js";
import { AUDIO_KEYS } from "../../audio/audio-asset-registry.js";
import { pickSoundKey } from "../../audio/audio-utils.js";
import { t } from "../../i18n/i18n.js";

const TRACK_WIDTH = 90;
const TRACK_HEIGHT = 6;
const THUMB_RADIUS = 8;
const TRACK_COLOR = 0x3a4152;
const FILL_COLOR = 0x6fb4ff;
/**
 * Tramo inasignable por falta de presupuesto global. Debe distinguirse CLARO del
 * track vacío (principio 6): el valor anterior (`0x23262f`) era un gris casi
 * idéntico a `TRACK_COLOR` y en la práctica no se leía, así que el tope parecía
 * un slider roto. Se mantiene neutro y NO rojo a propósito: este tramo aparece
 * casi siempre (cualquier sección que no se lleve todo el presupuesto), y en
 * rojo permanente sería alarma falsa. El rojo se reserva para el destello del
 * rechazo, que sí es un evento puntual.
 */
const LOCKED_COLOR = 0x11131a;
/** Cadencia máxima de la señal de rechazo: `pointermove` dispara decenas de veces por segundo. */
const BLOCKED_FEEDBACK_THROTTLE_MS = 500;
const BLOCKED_LABEL_MS = 1000;
const THUMB_COLOR = 0xd8dce8;
const DISABLED_ALPHA = 0.5;

export interface PowerAllocationSliderOptions {
  readonly x: number;
  readonly y: number;
  /** Presupuesto TOTAL de la nave — define el rango del track (ancho constante en todas las secciones). */
  readonly maxUnits: number;
  /** Tope arrastrable = unidades de esta sección + restante sin asignar. Nunca mayor que `maxUnits`. */
  readonly capUnits: number;
  /** Lo PEDIDO por el jugador (lo que el slider controla). */
  readonly units: number;
  /** Lo realmente OTORGADO por el motor — menor que `units` ante déficit (ronda 4). */
  readonly grantedUnits: number;
  /** Gateado a modo `"planning"` (Fase 13b) — mismo criterio que `createWorkbenchButton`. */
  readonly enabled: boolean;
  readonly onChange: (units: number) => void;
}

export interface PowerAllocationSliderHandle {
  readonly container: Phaser.GameObjects.Container;
  /** Reajusta el tope arrastrable sin destruir el widget (el presupuesto libre cambió en otra sección). */
  setCap(capUnits: number): void;
  /** Reajusta lo otorgado sin destruir el widget (cambió el reparto tras un déficit). */
  setGranted(grantedUnits: number): void;
  destroy(): void;
}

/**
 * Slider entero por sección (Fase 13b, ronda 2 de playtest — reemplaza el
 * stepper +/- de `power-allocation-dial.ts`, sentido "incómodo como UX").
 * Molde: `kenney-slider.ts` (mismo estilo visual, track+fill+thumb a mano —
 * el pack Kenney no trae este componente), pero NO es reusable tal cual:
 * - Objeto de MUNDO (pan/zoom con el mapa), no HUD fijo — la posición de
 *   arrastre se resuelve con `scene.cameras.main.getWorldPoint(...)`, nunca
 *   `pointer.x` crudo (que asume coordenadas de pantalla).
 * - Entero, no continuo: arrastra en fracción 0..1 internamente, redondea a
 *   entero de `maxUnits`, y solo llama `onChange` cuando el entero cambia
 *   (evita spamear `setSectionPowerUnits` en cada pixel de arrastre).
 * - Limpieza explícita vía `destroy()`: a diferencia del slider de
 *   `options-scene.ts` (vive toda la escena), este se destruye/recrea muchas
 *   veces por sesión (`redrawEnergyControls`, cada toggle de capa/cambio de
 *   modo) — sin sacar sus propios listeners de `scene.input`, cada
 *   reconstrucción deja un handler huérfano apuntando a un container ya
 *   destruido.
 *
 * Ronda 3: el track abarca SIEMPRE `0..maxUnits` (el presupuesto total), para
 * que el mismo ancho signifique lo mismo en todas las secciones, pero el
 * arrastre se topa en `capUnits`. El tramo bloqueado se pinta aparte
 * (`LOCKED_COLOR`) para que se vea POR QUÉ el thumb no avanza, en vez de
 * parecer un slider roto. La etiqueta muestra además el % del total.
 */
export function renderPowerAllocationSlider(
  scene: Phaser.Scene,
  options: PowerAllocationSliderOptions,
): PowerAllocationSliderHandle {
  const { x, y, maxUnits, enabled } = options;
  // El PEDIDO no se clampea al presupuesto: si el jugador perdió fuentes, puede
  // tener repartido más de lo que la nave entrega, y taparlo era justamente el
  // bug (dos zonas que pidieron 3 y 7 mostraban ambas "2/2" con presupuesto 2).
  let units = Math.max(0, Math.round(options.units));
  // La escala abarca el pedido cuando este excede el presupuesto. Mientras
  // entra, `safeMax === maxUnits` y el widget se ve exactamente como antes.
  // Se fija al construir, NO se recalcula en el arrastre: cambiar la escala a
  // mitad de un drag movería el mapeo puntero→unidades y lo volvería inestable.
  // Los controles se reconstruyen al volver a pausa / togglear la capa.
  const safeMax = Math.max(1, maxUnits, units);
  let cap = Phaser.Math.Clamp(options.capUnits, 0, safeMax);
  let granted = Phaser.Math.Clamp(Math.round(options.grantedUnits), 0, units);

  const left = -TRACK_WIDTH / 2;
  const unitToX = (value: number): number => left + TRACK_WIDTH * (value / safeMax);
  const container = scene.add.container(x, y);

  // Con sobre-asignación el porcentaje daría valores como 350%, que confunden
  // más de lo que informan: ahí se muestran solo los números crudos ("7/2").
  const labelOf = (value: number): string =>
    value <= maxUnits
      ? `${value}/${maxUnits} · ${Math.round((value / Math.max(1, maxUnits)) * 100)}%`
      : `${value}/${maxUnits}`;

  const label = scene.add
    .text(0, -16, labelOf(units), {
      fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
      fontSize: "12px",
      color: LABEL_COLOR,
    })
    .setOrigin(0.5);
  const track = scene.add.rectangle(0, 0, TRACK_WIDTH, TRACK_HEIGHT, TRACK_COLOR).setOrigin(0.5);
  const locked = scene.add.rectangle(unitToX(cap), 0, TRACK_WIDTH, TRACK_HEIGHT, LOCKED_COLOR).setOrigin(0, 0.5);
  // Tramo PEDIDO PERO NO OTORGADO (déficit): ámbar, el mismo que ya usa la capa
  // "energia" del plano para déficit — no se inventa un color nuevo.
  const unmet = scene.add.rectangle(left, 0, 0, TRACK_HEIGHT, ENERGY_LAYER_COLOR.deficit).setOrigin(0, 0.5);
  const fill = scene.add.rectangle(left, 0, 0, TRACK_HEIGHT, FILL_COLOR).setOrigin(0, 0.5);
  const thumb = scene.add.circle(unitToX(units), 0, THUMB_RADIUS, THUMB_COLOR);
  container.add([label, track, locked, unmet, fill, thumb]);

  if (!enabled) {
    container.setAlpha(DISABLED_ALPHA);
  }

  let blockedLabelUntilMs = 0;
  let lastBlockedFeedbackMs = -Infinity;
  let labelRestoreEvent: Phaser.Time.TimerEvent | undefined;
  let blockedFlash: Phaser.GameObjects.Rectangle | undefined;

  const redraw = (): void => {
    granted = Math.min(granted, units);
    // Azul = otorgado; ámbar = lo pedido que la nave NO puede cubrir. Sin
    // déficit el tramo ámbar mide 0 y se ve exactamente como antes.
    fill.width = TRACK_WIDTH * (granted / safeMax);
    unmet.x = unitToX(granted);
    unmet.width = TRACK_WIDTH * ((units - granted) / safeMax);
    unmet.setVisible(units > granted);
    // Un `setCap`/`setGranted` externo puede caer a mitad del sacudón de
    // rechazo: sin matar el tween, el thumb quedaría desalineado al terminar.
    scene.tweens.killTweensOf(thumb);
    thumb.x = unitToX(units);
    locked.x = unitToX(cap);
    locked.width = TRACK_WIDTH * (1 - cap / safeMax);
    locked.setVisible(cap < safeMax);
    // Mientras se muestra "Sin energía libre" la etiqueta no se pisa.
    if (scene.time.now >= blockedLabelUntilMs) {
      label.setText(labelOf(units));
    }
  };
  redraw();

  /**
   * Señal de rechazo (Fase 13b, ronda 6): el tope funcionaba pero en silencio,
   * así que el slider parecía roto. Sacudón + destello rojo + sonido de error,
   * throttleado — `pointermove` dispara decenas de veces por segundo mientras
   * se empuja contra el tope.
   */
  const signalBlocked = (): void => {
    const now = scene.time.now;
    if (now - lastBlockedFeedbackMs < BLOCKED_FEEDBACK_THROTTLE_MS) return;
    lastBlockedFeedbackMs = now;

    // Sacudón horizontal del thumb (mismo molde que el retrato de tripulante
    // al recibir daño en `floorplan-scene.ts`).
    const restX = unitToX(units);
    scene.tweens.killTweensOf(thumb);
    scene.tweens.add({
      targets: thumb,
      x: restX + 3,
      duration: 45,
      yoyo: true,
      repeat: 2,
      ease: "Sine.easeInOut",
      onComplete: () => {
        thumb.x = unitToX(units);
      },
    });

    // Destello del tramo bloqueado.
    blockedFlash?.destroy();
    const flashWidth = TRACK_WIDTH * (1 - cap / safeMax);
    blockedFlash = scene.add
      .rectangle(unitToX(cap), 0, Math.max(4, flashWidth), TRACK_HEIGHT, POWER_BLOCKED_FLASH_COLOR)
      .setOrigin(0, 0.5);
    container.add(blockedFlash);
    scene.tweens.add({
      targets: blockedFlash,
      alpha: 0,
      duration: 320,
      onComplete: () => {
        blockedFlash?.destroy();
        blockedFlash = undefined;
      },
    });

    scene.sound.play(pickSoundKey(AUDIO_KEYS.uiDenied), { volume: 0.3 });

    // La etiqueta explica el porqué (no queda energía libre en la nave).
    label.setText(t("ui.floorplan.energia.no-free-power"));
    blockedLabelUntilMs = now + BLOCKED_LABEL_MS;
    labelRestoreEvent?.remove();
    labelRestoreEvent = scene.time.delayedCall(BLOCKED_LABEL_MS, () => {
      blockedLabelUntilMs = 0;
      labelRestoreEvent = undefined;
      label.setText(labelOf(units));
    });
  };

  const applyFromWorldX = (worldX: number): void => {
    const local = worldX - container.x - left;
    const fraction = Phaser.Math.Clamp(local / TRACK_WIDTH, 0, 1);
    // El objetivo SIN clampear detecta el intento de pasarse del tope; el
    // clampeado es el que se aplica. Bajar nunca está bloqueado.
    const rawTarget = Math.round(fraction * safeMax);
    const next = Phaser.Math.Clamp(rawTarget, 0, cap);
    if (rawTarget > cap) {
      signalBlocked();
    }
    if (next === units) return;
    units = next;
    // Optimista: arrastrar nunca puede generar déficit (el cap lo impide), así
    // que lo pedido se otorga entero. El valor autoritativo vuelve por
    // `setGranted` cuando el motor recalcula.
    granted = next;
    redraw();
    options.onChange(units);
  };

  const hitZone = scene.add
    .zone(0, 0, TRACK_WIDTH + THUMB_RADIUS * 2, THUMB_RADIUS * 2 + 8)
    .setOrigin(0.5)
    .setInteractive(enabled ? { cursor: UI_POINTER_CURSOR_CSS } : undefined);
  container.add(hitZone);

  let dragging = false;
  const worldXOf = (pointer: Phaser.Input.Pointer): number => scene.cameras.main.getWorldPoint(pointer.x, pointer.y).x;

  const onDown = (pointer: Phaser.Input.Pointer): void => {
    if (!enabled) return;
    dragging = true;
    applyFromWorldX(worldXOf(pointer));
  };
  const onMove = (pointer: Phaser.Input.Pointer): void => {
    if (dragging) applyFromWorldX(worldXOf(pointer));
  };
  const onUp = (): void => {
    dragging = false;
  };
  hitZone.on("pointerdown", onDown);
  scene.input.on("pointermove", onMove);
  scene.input.on("pointerup", onUp);

  return {
    container,
    setCap(capUnits: number): void {
      // Solo limita el ARRASTRE. No toca `units`: el pedido es dato autoritativo
      // del blueprint, y recortarlo acá volvería a taparlo (el bug de la ronda 5).
      cap = Phaser.Math.Clamp(capUnits, 0, safeMax);
      redraw();
    },
    setGranted(grantedUnits: number): void {
      granted = Phaser.Math.Clamp(Math.round(grantedUnits), 0, safeMax);
      redraw();
    },
    destroy(): void {
      // El widget se destruye y reconstruye seguido (`redrawEnergyControls`):
      // un timer o un tween huérfano tocaría objetos ya destruidos.
      labelRestoreEvent?.remove();
      labelRestoreEvent = undefined;
      scene.tweens.killTweensOf(thumb);
      if (blockedFlash) {
        scene.tweens.killTweensOf(blockedFlash);
        blockedFlash.destroy();
        blockedFlash = undefined;
      }
      hitZone.off("pointerdown", onDown);
      scene.input.off("pointermove", onMove);
      scene.input.off("pointerup", onUp);
      container.destroy();
    },
  };
}
