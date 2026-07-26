/** Único lugar (junto con `scene-flow-manager.ts`) que conoce los `key` string de escena de Phaser. */
export const SCENE_KEYS = {
  title: "title",
  credits: "credits",
  archetypeSelect: "archetype-select",
  crewSelect: "crew-select",
  floorplan: "floorplan",
  pauseMenu: "pause-menu",
  crisisResult: "crisis-result",
  options: "options",
  creativeHub: "creative-hub",
  creativeWorkbench: "creative-workbench",
  particleGallery: "particle-gallery",
} as const;
