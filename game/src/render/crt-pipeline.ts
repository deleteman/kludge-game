import Phaser from "phaser";

/**
 * Fase 12c.4: filtro CRT sutil (barrido de scanlines + leve aberración
 * cromática) para el "brillo de fósforo retro" sobre la cámara del HUD. Es un
 * `PostFXPipeline` de WebGL — NO existe en el renderer Canvas, así que el
 * llamador debe aplicarlo solo bajo WebGL (ver `registerCrtPipeline`).
 *
 * El shader PRESERVA el alpha del sampler central: la `hudCamera` renderiza los
 * objetos de HUD sobre fondo transparente, así que multiplicar el color por las
 * scanlines sin tocar el alpha mantiene invisibles las zonas vacías (no oscurece
 * toda la pantalla). Intensidades bajas a propósito (elección "sutil por defecto").
 */
const FRAG_SHADER = `
precision mediump float;
uniform sampler2D uMainSampler;
varying vec2 outTexCoord;

void main(void) {
  vec2 uv = outTexCoord;

  // Aberración cromática leve: desplaza R y B en sentidos opuestos en X.
  float ca = 0.0016;
  float r = texture2D(uMainSampler, vec2(uv.x + ca, uv.y)).r;
  float g = texture2D(uMainSampler, uv).g;
  float b = texture2D(uMainSampler, vec2(uv.x - ca, uv.y)).b;
  float a = texture2D(uMainSampler, uv).a;

  // Scanlines suaves.
  float scan = 0.965 + 0.035 * sin(uv.y * 720.0);

  gl_FragColor = vec4(vec3(r, g, b) * scan, a);
}
`;

export class CrtPostFxPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  constructor(game: Phaser.Game) {
    super({ game, fragShader: FRAG_SHADER });
  }
}

export const CRT_PIPELINE_KEY = "CrtPostFx";

/**
 * Registra el pipeline en el renderer (idempotente) y lo aplica a la cámara
 * dada. No hace nada bajo el renderer Canvas — el HUD queda sin el filtro, sin
 * romper. Devuelve `true` si se aplicó.
 */
export function registerCrtPipeline(scene: Phaser.Scene, camera: Phaser.Cameras.Scene2D.Camera): boolean {
  const renderer = scene.renderer;
  if (!(renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer)) return false;
  const pipelines = renderer.pipelines;
  if (!pipelines.getPostPipeline(CRT_PIPELINE_KEY)) {
    pipelines.addPostPipeline(CRT_PIPELINE_KEY, CrtPostFxPipeline);
  }
  camera.setPostPipeline(CRT_PIPELINE_KEY);
  return true;
}
