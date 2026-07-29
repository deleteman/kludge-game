import buttonLargeUrl from "../../assets/sprites/ui/ui-components/Grey/Default/button_square_header_large_rectangle.png?url";
import buttonLargeSquareUrl from "../../assets/sprites/ui/ui-components/Grey/Default/button_square_header_large_square.png?url";
import panelRectangleUrl from "../../assets/sprites/ui/ui-components/Extra/Default/panel_rectangle.png?url";
import barRoundSmallUrl from "../../assets/sprites/ui/ui-components/Blue/Default/bar_round_small.png?url";
import menuBackgroundUrl from "../../assets/sprites/ui/fondo-menu.png?url";
import titleLogoUrl from "../../assets/sprites/ui/title-logo.png?url";
import iconWorkbenchUrl from "../../assets/sprites/ui/ui-components/BUTTON-ICONS/construction-table.png?url";
import iconChemistryUrl from "../../assets/sprites/ui/ui-components/BUTTON-ICONS/mixer.png?url";

/**
 * Pack Kenney "UI Space Expansion" ya colocado por el operador en
 * `game/assets/sprites/ui/ui-components/`. Mismo patrón que
 * `tile-layer-registry.ts`/`particle-texture-registry.ts`: tabla `key → URL`
 * precargada una sola vez, esta vez compartida entre todas las escenas de
 * menú (`preloadUiAssets`, llamado desde el `preload()` de cada una).
 *
 * NO hay checkbox/scrollbar/slider en las 740 imágenes del pack (confirmado
 * por búsqueda exhaustiva) — `kenney-list.ts` usa el `scrollBar` shape-based
 * nativo de rexUI (sin textura) en vez de bloquear la feature.
 */
export const UI_TEXTURE_KEYS = {
  buttonLarge: "ui-button-large",
  buttonLargeSquare: "ui-button-large-square",
  panelRectangle: "ui-panel-rectangle",
  barSmall: "ui-bar-small",
  menuBackground: "ui-menu-background",
  titleLogo: "ui-title-logo",
  iconWorkbench: "ui-icon-workbench",
  iconChemistry: "ui-icon-chemistry",
} as const;

export const UI_TEXTURE_URLS: Readonly<Record<string, string>> = {
  [UI_TEXTURE_KEYS.buttonLarge]: buttonLargeUrl,
  [UI_TEXTURE_KEYS.buttonLargeSquare]: buttonLargeSquareUrl,
  [UI_TEXTURE_KEYS.panelRectangle]: panelRectangleUrl,
  [UI_TEXTURE_KEYS.barSmall]: barRoundSmallUrl,
  [UI_TEXTURE_KEYS.menuBackground]: menuBackgroundUrl,
  [UI_TEXTURE_KEYS.titleLogo]: titleLogoUrl,
  [UI_TEXTURE_KEYS.iconWorkbench]: iconWorkbenchUrl,
  [UI_TEXTURE_KEYS.iconChemistry]: iconChemistryUrl,
};

export function preloadUiAssets(scene: Phaser.Scene): void {
  for (const [key, url] of Object.entries(UI_TEXTURE_URLS)) {
    scene.load.image(key, url);
  }
}
