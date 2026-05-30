/**
 * LocalPlayer — The human player's sprite + movement controller.
 *
 * Owns the sprite, animation state (idle/walk × 4 directions),
 * keyboard input, and position emission via bridge.
 */

import Phaser from "phaser";

export class LocalPlayer {
  sprite: Phaser.GameObjects.Sprite | null = null;
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    void this.scene; // used when sprite/physics are set up
  }

  /** Create the sprite at the given spawn position. */
  spawn(_x: number, _y: number, _avatar: string): void {
    // TODO: Create sprite from spritesheet
    // TODO: Set up 4-direction idle + walk animations
    // TODO: Enable Arcade physics body
    // TODO: Set collision with world bounds and collision layer
  }

  /** Called every frame from GameScene.update(). */
  update(_delta: number): void {
    // TODO: Read keyboard input, compute velocity
    // TODO: Update animation (idle ↔ walk, direction)
    // TODO: Emit position-changed via bridge
  }
}
