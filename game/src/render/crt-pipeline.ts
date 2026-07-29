import Phaser from "phaser";

/**
 * Filtro CRT en DOS capas (feedback 12c + roadmap Duskers), parametrizado por
 * uniforms en vez de constantes hardcodeadas:
 *
 *  - Capa "Clean CRT" (siempre activa, sutil), escalada por `uCrtIntensity`
 *    (0..1, tope del slider de accesibilidad): scanlines suaves (≤15%),
 *    aberración cromática base leve, curvatura (barrel) mínima (≤2%) y un glow
 *    de fósforo barato en los bordes brillantes. A `uCrtIntensity = 0` el shader
 *    es passthrough puro (protección fotosensibilidad + dirección de arte off).
 *
 *  - Capa "System Failure" (por eventos de crisis / soporte vital crítico),
 *    escalada por `uFailure` (0..1): sube la aberración cromática y añade un
 *    parpadeo (flicker) de baja frecuencia (~1.9 Hz, por debajo del umbral WCAG
 *    de 3 destellos/seg). La ESCENA calcula `uFailure` ya multiplicado por el
 *    control de flicker de accesibilidad, así que a flicker 0 esta capa queda
 *    apagada aunque la estética CRT siga encendida.
 *
 * Es un `PostFXPipeline` de WebGL — NO existe bajo Canvas, así que el llamador
 * debe aplicarlo solo bajo WebGL (ver `registerCrtPipeline`). Phaser instancia
 * un pipeline POR CÁMARA (`camera.setPostPipeline` → `camera.getPostPipeline`),
 * así que cada instancia lleva su propio `viewportSize`; las scanlines y el
 * barrel se calculan en coordenadas GLOBALES de ventana vía `gl_FragCoord` +
 * `uResolution`, de modo que son coherentes entre la cámara de mundo (viewport
 * recortado bajo el header) y la del HUD (canvas completo) sin costura visible.
 *
 * El shader PRESERVA el alpha del sampler central: la `hudCamera` renderiza los
 * objetos de HUD sobre fondo transparente, así que las zonas vacías siguen
 * invisibles (no se oscurece toda la pantalla).
 */
const FRAG_SHADER = `
precision mediump float;
uniform sampler2D uMainSampler;
uniform vec2 uResolution;      // tamaño de la ventana en px (barrel/scanlines globales)
uniform vec2 uViewportSize;    // tamaño del viewport de ESTA cámara en px
uniform float uCrtIntensity;   // 0..1 estética (slider accesibilidad)
uniform float uFailure;        // 0..1 capa System Failure (ya escalada por flicker setting)
uniform float uTime;           // segundos (para el flicker)
varying vec2 outTexCoord;

const float PI = 3.14159265;

void main(void) {
  // --- Barrel distortion (≤2%), radial alrededor del centro GLOBAL de ventana.
  // gl_FragCoord es coordenada de ventana → coherente entre ambas cámaras. El
  // desplazamiento se calcula en píxeles globales y se convierte a texcoord
  // LOCAL de esta cámara dividiendo por su propio viewport.
  vec2 center = uResolution * 0.5;
  vec2 fromCenter = gl_FragCoord.xy - center;
  float r2 = dot(fromCenter, fromCenter) / max(dot(center, center), 1.0);
  float barrel = 0.02 * uCrtIntensity;
  vec2 pushPixels = fromCenter * (barrel * r2);
  vec2 uv = outTexCoord + pushPixels / max(uViewportSize, vec2(1.0));

  // --- Aberración cromática: base leve (clean) + fuerte (failure).
  float ca = 0.0016 * uCrtIntensity + 0.006 * uFailure;
  float r = texture2D(uMainSampler, vec2(uv.x + ca, uv.y)).r;
  float g = texture2D(uMainSampler, uv).g;
  float b = texture2D(uMainSampler, vec2(uv.x - ca, uv.y)).b;
  vec4 center4 = texture2D(uMainSampler, uv);
  float a = center4.a;
  vec3 color = vec3(r, g, b);

  // --- Glow de fósforo barato: 4 taps diagonales, aditivo sobre lo brillante.
  // Multiplicado por el alpha para no "encender" zonas vacías del HUD.
  float glowAmt = 0.35 * uCrtIntensity;
  if (glowAmt > 0.001) {
    vec2 o = vec2(1.4) / max(uViewportSize, vec2(1.0));
    vec3 blur =
      texture2D(uMainSampler, uv + vec2(o.x, o.y)).rgb +
      texture2D(uMainSampler, uv + vec2(-o.x, o.y)).rgb +
      texture2D(uMainSampler, uv + vec2(o.x, -o.y)).rgb +
      texture2D(uMainSampler, uv + vec2(-o.x, -o.y)).rgb;
    blur *= 0.25;
    float bright = max(max(blur.r, blur.g), blur.b);
    color += blur * glowAmt * smoothstep(0.5, 1.0, bright) * a;
  }

  // --- Scanlines suaves (≤15%), por-píxel global (gl_FragCoord.y).
  float scanDepth = 0.15 * uCrtIntensity;
  float scan = 1.0 - scanDepth * 0.5 * (1.0 + sin(gl_FragCoord.y * PI));

  // --- Flicker de baja frecuencia (capa failure). ~1.9 Hz (< umbral WCAG).
  float flicker = 1.0 - uFailure * 0.35 * (0.5 + 0.5 * sin(uTime * 12.0));

  gl_FragColor = vec4(color * scan * flicker, a);
}
`;

export class CrtPostFxPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  /** Intensidad estética (0..1). La escena la sincroniza con el slider de accesibilidad. */
  public crtIntensity = 0.7;
  /** Rampa de la capa System Failure (0..1), ya escalada por el control de flicker. */
  public failure = 0;
  /** Reloj en segundos para el flicker. */
  public time = 0;
  /** Tamaño de ventana en px (barrel/scanlines globales). */
  public resolution: [number, number] = [1280, 720];
  /** Tamaño del viewport de la cámara dueña de esta instancia, en px. */
  public viewportSize: [number, number] = [1280, 720];

  constructor(game: Phaser.Game) {
    super({ game, fragShader: FRAG_SHADER });
  }

  onPreRender(): void {
    this.set1f("uCrtIntensity", this.crtIntensity);
    this.set1f("uFailure", this.failure);
    this.set1f("uTime", this.time);
    this.set2f("uResolution", this.resolution[0], this.resolution[1]);
    this.set2f("uViewportSize", this.viewportSize[0], this.viewportSize[1]);
  }
}

export const CRT_PIPELINE_KEY = "CrtPostFx";

/**
 * Registra el pipeline en el renderer (idempotente) y lo aplica a la cámara
 * dada, sembrando su `resolution`/`viewportSize` desde la cámara. No hace nada
 * bajo el renderer Canvas — devuelve `null`. Devuelve la instancia del pipeline
 * (una por cámara) para que la escena le fije `failure`/`time`/`crtIntensity`
 * cada frame.
 */
export function registerCrtPipeline(
  scene: Phaser.Scene,
  camera: Phaser.Cameras.Scene2D.Camera,
): CrtPostFxPipeline | null {
  const renderer = scene.renderer;
  if (!(renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer)) return null;
  const pipelines = renderer.pipelines;
  if (!pipelines.getPostPipeline(CRT_PIPELINE_KEY)) {
    pipelines.addPostPipeline(CRT_PIPELINE_KEY, CrtPostFxPipeline);
  }
  camera.setPostPipeline(CRT_PIPELINE_KEY);
  const instance = camera.getPostPipeline(CRT_PIPELINE_KEY) as CrtPostFxPipeline | CrtPostFxPipeline[];
  const pipeline = Array.isArray(instance) ? instance[0] : instance;
  if (!pipeline) return null;
  pipeline.resolution = [scene.scale.width, scene.scale.height];
  pipeline.viewportSize = [camera.width || scene.scale.width, camera.height || scene.scale.height];
  return pipeline;
}
