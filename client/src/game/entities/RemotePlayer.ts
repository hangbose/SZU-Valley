/**
 * RemotePlayer — Another player's sprite on the map.
 *
 * Created when `player.appeared` is received, destroyed on `player.left`.
 * Position is smoothly interpolated between `player.moved` updates using
 * exponential smoothing (frame-rate independent).
 *
 * Uses a tinted placeholder texture (same shape as LocalPlayer, orange tint)
 * until D delivers real avatar spritesheets.
 */

import Phaser from "phaser";
import { bridge } from "@/network/bridge";

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** Size of the placeholder sprite (matches LocalPlayer). */
const SPRITE_W = 16;
const SPRITE_H = 20;

/** Smoothing time constant for position interpolation (ms). Lower = snappier. */
const SMOOTH_TIME = 100;

// ---------------------------------------------------------------------------
// Placeholder texture (generated once, reused for all remote players)
// ---------------------------------------------------------------------------

let textureGenerated = false;

function ensureTexture(scene: Phaser.Scene): void {
  if (textureGenerated) return;

  const gfx = scene.add.graphics();
  // Body — orange to distinguish from local player
  gfx.fillStyle(0xff8c00, 1);
  gfx.fillRect(0, 0, SPRITE_W, SPRITE_H);
  // Eyes
  gfx.fillStyle(0x000000, 0.6);
  gfx.fillRect(SPRITE_W - 6, 4, 3, 3);
  gfx.fillRect(SPRITE_W - 6, SPRITE_H - 10, 3, 3);

  gfx.generateTexture("__remote_placeholder", SPRITE_W, SPRITE_H);
  gfx.destroy();
  textureGenerated = true;
}

// ---------------------------------------------------------------------------
// RemotePlayer
// ---------------------------------------------------------------------------

export class RemotePlayer {
  id: string;
  name: string;
  sprite: Phaser.GameObjects.Sprite;
  private nameTag: Phaser.GameObjects.Text;

  // Interpolation targets (tile coordinates, may be fractional)
  targetX: number;
  targetY: number;

  constructor(
    scene: Phaser.Scene,
    id: string,
    name: string,
    _avatar: string,
    x: number,
    y: number,
  ) {
    this.id = id;
    this.name = name;
    this.targetX = x;
    this.targetY = y;

    ensureTexture(scene);

    const px = x * 32 + 16;
    const py = y * 32 + 16;

    // Sprite
    this.sprite = scene.add
      .sprite(px, py, "__remote_placeholder")
      .setOrigin(0.5, 0.5)
      .setDepth(9)
      .setInteractive({ useHandCursor: true });

    // Click → view profile
    this.sprite.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      bridge.emit("player-clicked", {
        playerId: this.id,
        screenX: pointer.x,
        screenY: pointer.y,
      });
    });

    // Name tag
    this.nameTag = scene.add
      .text(px, py - 18, name, {
        fontSize: "10px",
        color: "#ffaa44",
        backgroundColor: "#00000088",
        padding: { x: 2, y: 1 },
      })
      .setOrigin(0.5, 1)
      .setDepth(12);
  }

  // -----------------------------------------------------------------------
  // Server update
  // -----------------------------------------------------------------------

  /** Receive a new position target from `player.moved` (tile coords). */
  setTarget(x: number, y: number): void {
    this.targetX = x;
    this.targetY = y;
  }

  // -----------------------------------------------------------------------
  // Per-frame interpolation
  // -----------------------------------------------------------------------

  /**
   * Called every frame. Smoothly interpolates sprite position toward the
   * server-authoritative target using exponential smoothing.
   */
  update(_time: number, delta: number): void {
    const factor = 1 - Math.exp(-delta / SMOOTH_TIME);

    const currentX = this.sprite.x;
    const currentY = this.sprite.y;
    const desiredX = this.targetX * 32 + 16;
    const desiredY = this.targetY * 32 + 16;

    this.sprite.x = currentX + (desiredX - currentX) * factor;
    this.sprite.y = currentY + (desiredY - currentY) * factor;

    // Name tag follows sprite
    this.nameTag.setPosition(this.sprite.x, this.sprite.y - 18);
  }

  // -----------------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------------

  destroy(): void {
    this.nameTag.destroy();
    this.sprite.destroy();
  }
}
