/**
 * LocalPlayer — The human player's sprite + movement controller.
 *
 * Creates a placeholder sprite (coloured rectangle) until D delivers real
 * character spritesheets. Wires the KeyboardController for movement input,
 * applies Arcade-physics velocity, emits position updates via the bridge,
 * and tracks the current cardinal direction for future animation support.
 */

import Phaser from "phaser";
import { bridge } from "@/network/bridge";
import { KeyboardController } from "@/game/input/KeyboardController";
import type { Direction } from "@/game/input/KeyboardController";

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** Movement speed in pixels per second. 160 ≈ 5 tiles/s. */
const SPEED = 160;

/** How often to emit `position-changed` via the bridge (ms). */
const POSITION_EMIT_INTERVAL = 100;

/** Distance threshold for considering a walk target "reached" (px). */
const WALK_ARRIVE_THRESHOLD = 6;

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
// LocalPlayer
// ---------------------------------------------------------------------------

export class LocalPlayer {
  sprite!: Phaser.Physics.Arcade.Sprite;
  private controller: KeyboardController;
  private scene: Phaser.Scene;
  private lastEmitTime = 0;
  direction: Direction = "down";

  /** Tap-to-move target (tile coords). null when idle. */
  private targetTileX: number | null = null;
  private targetTileY: number | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.controller = new KeyboardController(scene);
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  /**
   * Create the sprite at the given spawn position using the selected avatar.
   *
   * @param tileX   Spawn tile X (map coords).
   * @param tileY   Spawn tile Y (map coords).
   * @param avatar  Avatar texture key (avatar_01 … avatar_08).
   */
  spawn(tileX: number, tileY: number, avatar: string): void {
    const px = tileX * 32 + 16;
    const py = tileY * 32 + 16;

    // Fall back to avatar_01 if the selected texture doesn't exist
    const textureKey = this.scene.textures.exists(avatar) ? avatar : "avatar_01";

    this.sprite = this.scene.physics.add.sprite(px, py, textureKey, 0);

    // Apply tint for fallback avatars so they look visually distinct
    if (!this.scene.textures.exists(avatar)) {
      this.sprite.setTint(AVATAR_FALLBACK_TINTS[avatar] ?? 0xffffff);
    }
    this.sprite.setOrigin(0.5, 0.75); // feet at tile center
    this.sprite.setScale(0.25);
    this.sprite.setDepth(10);
    this.sprite.setCollideWorldBounds(true);

    // Setup 4-direction walk animations for this texture
    this.createAnimations(textureKey);
  }

  /**
   * Create walk animations for the given texture.
   * Assumes a spritesheet where rows 0-3 are walk directions (down/left/right/up).
   */
  private createAnimations(textureKey: string): void {
    const tex = this.scene.textures.get(textureKey);
    const source = tex.getSourceImage();
    // Infer grid from the first frame, or assume 32×32 as fallback
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const frameWidth = (tex.frames as any).__BASE?.width ?? 32;
    const cols = Math.max(1, Math.floor(source.width / frameWidth));

    const directions = ["down", "left", "right", "up"] as const;
    for (let row = 0; row < 4; row++) {
      const frames = Array.from({ length: cols }, (_, col) => row * cols + col);
      const animKey = `player-walk-${directions[row]}-${textureKey}`;
      // Skip if animation already exists (e.g. from another player)
      if (this.scene.anims.exists(animKey)) continue;
      this.scene.anims.create({
        key: animKey,
        frames: this.scene.anims.generateFrameNumbers(textureKey, { frames }),
        frameRate: 12,
        repeat: -1,
      });
    }
  }

  /**
   * Set a walk-to target (tile coordinates). The player will move toward
   * this position each frame until arriving or until keyboard input takes over.
   * Used by tap-to-move.
   */
  walkTo(tileX: number, tileY: number): void {
    this.targetTileX = tileX;
    this.targetTileY = tileY;
  }

  /** Whether the player is currently walking toward a tap-to-move target. */
  get isWalkingToTarget(): boolean {
    return this.targetTileX !== null;
  }

  // -----------------------------------------------------------------------
  // Per-frame update
  // -----------------------------------------------------------------------

  /**
   * Called every frame from GameScene.update(). Reads keyboard input,
   * applies velocity, updates tint for "direction", and emits position.
   */
  update(_time: number, _delta: number): void {
    if (!this.sprite?.body) return;

    const input = this.controller.getInput();

    if (input.moving) {
      // Keyboard takes priority — cancel any tap-to-move target
      this.targetTileX = null;
      this.targetTileY = null;

      this.sprite.setVelocity(
        input.dx * SPEED,
        input.dy * SPEED,
      );
      this.direction = input.direction;
      this.sprite.play(`player-walk-${this.direction}-${this.sprite.texture.key}`, true);
    } else if (this.targetTileX !== null) {
      // Tap-to-move: walk toward target tile centre
      this.moveTowardTarget();
    } else {
      this.sprite.setVelocity(0, 0);
      this.sprite.stop(); // idle frame
    }

    // Emit tile position at a throttled rate
    this.emitPosition();
  }

  // -----------------------------------------------------------------------
  // Tap-to-move
  // -----------------------------------------------------------------------

  private moveTowardTarget(): void {
    const targetPx = this.targetTileX! * 32 + 16;
    const targetPy = this.targetTileY! * 32 + 16;
    const dx = targetPx - this.sprite.x;
    const dy = targetPy - this.sprite.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < WALK_ARRIVE_THRESHOLD) {
      // Arrived
      this.sprite.setVelocity(0, 0);
      this.sprite.stop();
      this.targetTileX = null;
      this.targetTileY = null;
      return;
    }

    // Normalize and apply velocity
    const vx = (dx / dist) * SPEED;
    const vy = (dy / dist) * SPEED;
    this.sprite.setVelocity(vx, vy);

    // Set direction and play walk animation
    if (Math.abs(dy) >= Math.abs(dx)) {
      this.direction = dy < 0 ? "up" : "down";
    } else {
      this.direction = dx < 0 ? "left" : "right";
    }
    this.sprite.play(`player-walk-${this.direction}-${this.sprite.texture.key}`, true);
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  /** Current tile coordinate (read-only). */
  get tileX(): number {
    return Math.floor(this.sprite.x / 32);
  }

  get tileY(): number {
    return Math.floor(this.sprite.y / 32);
  }

  private emitPosition(): void {
    const now = this.scene.time.now;
    if (now - this.lastEmitTime < POSITION_EMIT_INTERVAL) return;
    this.lastEmitTime = now;

    bridge.emit("position-changed", {
      x: this.tileX,
      y: this.tileY,
      zoneName: "Campus",
    });
  }
}
