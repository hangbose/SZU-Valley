/**
 * RemotePlayer — Another player's sprite on the map.
 *
 * Created when `player.appeared` is received, destroyed on `player.left`.
 * Position is smoothly interpolated between `player.moved` updates.
 */

import Phaser from "phaser";

export class RemotePlayer {
  id: string;
  sprite: Phaser.GameObjects.Sprite;

  // Interpolation targets
  targetX: number;
  targetY: number;

  constructor(scene: Phaser.Scene, id: string, name: string, _avatar: string, x: number, y: number) {
    this.id = id;
    this.targetX = x;
    this.targetY = y;

    // TODO: Create sprite from spritesheet (use avatar key)
    // Placeholder: a colored rectangle
    const graphics = scene.add.graphics();
    graphics.fillStyle(0xff6600, 1);
    graphics.fillRect(x * 32 - 8, y * 32 - 16, 16, 32);

    // Name tag
    const nameTag = scene.add.text(x * 32, y * 32 - 24, name, {
      fontSize: "10px",
      color: "#ffffff",
      backgroundColor: "#00000088",
      padding: { x: 2, y: 1 },
    });
    nameTag.setOrigin(0.5, 1);

    // Cast to sprite for type compatibility — placeholder uses a simple rect
    // Replace with real sprite when spritesheets are available.
    this.sprite = scene.add.sprite(x * 32, y * 32, "__DEFAULT") as Phaser.GameObjects.Sprite;
    this.sprite.setOrigin(0.5, 0.5);
    this.sprite.setVisible(false); // hidden until real art is loaded
  }

  /** Receive a new position target from `player.moved`. */
  setTarget(x: number, y: number): void {
    this.targetX = x;
    this.targetY = y;
  }

  /** Called every frame. Lerps toward target for smooth movement. */
  update(_delta: number): void {
    // TODO: Smooth lerp sprite position toward (targetX, targetY)
    // TODO: Update animation based on direction + moving state
  }

  /** Clean up sprite and name tag. */
  destroy(): void {
    this.sprite.destroy();
  }
}
