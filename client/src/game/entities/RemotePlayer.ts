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

/** Smoothing time constant for position interpolation (ms). Lower = snappier. */
const SMOOTH_TIME = 100;

/** Name tag text size (world px). Large to stay crisp at ~0.2x zoom. */
const NAMETAG_FONT_SIZE = "60px";

/** Horizontal padding inside the name-tag background (world px). */
const NAMETAG_PAD_X = 40;

/** Vertical padding inside the name-tag background (world px). */
const NAMETAG_PAD_Y = 32;

/** Vertical offset of the name tag above the sprite (world px). */
const NAMETAG_OFFSET_Y = -28;

/** Tint colours for avatars that don't have their own spritesheet yet. */
const AVATAR_FALLBACK_TINTS: Record<string, number> = {
  avatar_03: 0xff8888,
  avatar_04: 0x88ff88,
  avatar_05: 0x8888ff,
  avatar_06: 0xffff88,
  avatar_07: 0xff88ff,
  avatar_08: 0x88ffff,
};

// ---------------------------------------------------------------------------
// RemotePlayer
// ---------------------------------------------------------------------------

export class RemotePlayer {
  id: string;
  name: string;
  sprite: Phaser.GameObjects.Sprite;
  private nameTag: Phaser.GameObjects.Text;
  private nameTagBg: Phaser.GameObjects.Sprite;

  // Interpolation targets (tile coordinates, may be fractional)
  targetX: number;
  targetY: number;

  constructor(
    scene: Phaser.Scene,
    id: string,
    name: string,
    avatar: string,
    x: number,
    y: number,
  ) {
    this.id = id;
    this.name = name;
    this.targetX = x;
    this.targetY = y;

    const px = x * 32 + 16;
    const py = y * 32 + 16;

    // Use the player's chosen avatar texture, fall back to avatar_02
    const textureKey = scene.textures.exists(avatar) ? avatar : "avatar_02";
    this.sprite = scene.add
      .sprite(px, py, textureKey, 0)
      .setOrigin(0.5, 0.75)
      .setScale(0.25)
      .setDepth(9)
      .setInteractive({ useHandCursor: true });

    // Apply tint for fallback avatars so they look visually distinct
    if (!scene.textures.exists(avatar)) {
      this.sprite.setTint(AVATAR_FALLBACK_TINTS[avatar] ?? 0xffffff);
    }

    // Click → view profile
    this.sprite.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      bridge.emit("player-clicked", {
        playerId: this.id,
        screenX: pointer.x,
        screenY: pointer.y,
      });
    });

    // Name tag (PNG bg behind, text on top — bg scales to fit text)
    const nameTagY = py + NAMETAG_OFFSET_Y;
    this.nameTag = scene.add.text(px, nameTagY, name, {
      fontSize: NAMETAG_FONT_SIZE, color: "#2b2b32", fontFamily: "monospace",
    }).setOrigin(0.5, 0.5).setDepth(20);

    const tex = scene.textures.get("ui-nametag");
    const texW = tex.getSourceImage().width;
    const texH = tex.getSourceImage().height;
    // Scale to fit BOTH text width and height — use max so bg fully covers text
    const scaleX = (this.nameTag.width + NAMETAG_PAD_X) / texW;
    const scaleY = (this.nameTag.height + NAMETAG_PAD_Y) / texH;
    const tagScale = Math.max(scaleX, scaleY, 0.08);
    this.nameTagBg = scene.add.sprite(px, nameTagY, "ui-nametag")
      .setOrigin(0.5, 0.5).setScale(tagScale).setDepth(11);
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
    const tagY = this.sprite.y + NAMETAG_OFFSET_Y;
    this.nameTagBg.setPosition(this.sprite.x, tagY);
    this.nameTag.setPosition(this.sprite.x, tagY);
  }

  // -----------------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------------

  destroy(): void {
    this.nameTag.destroy();
    this.nameTagBg.destroy();
    this.sprite.destroy();
  }
}
