/**
 * HUDScene — Heads-up display rendered by Phaser (parallel scene).
 *
 * Renders the minimap overlay on top of GameScene. Runs in parallel
 * so UI elements don't scroll with the camera.
 */

import Phaser from "phaser";

export class HUDScene extends Phaser.Scene {
  constructor() {
    super({ key: "HUDScene" });
  }

  create(): void {
    // Placeholder: HUD scene runs parallel to GameScene
    const { width } = this.cameras.main;

    this.add
      .text(width - 16, 16, "HUD", {
        fontSize: "12px",
        color: "#888888",
      })
      .setOrigin(1, 0);

    // TODO: Render minimap in bottom-right corner
    // TODO: Render small player dot on minimap
    // TODO: Show zone boundaries
  }
}
