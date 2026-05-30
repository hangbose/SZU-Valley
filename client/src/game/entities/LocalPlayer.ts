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

/** Placeholder sprite size (pixels). Fits within one 32×32 tile. */
const SPRITE_W = 16;
const SPRITE_H = 20;

/** How often to emit `position-changed` via the bridge (ms). */
const POSITION_EMIT_INTERVAL = 100;

/** Distance threshold for considering a walk target "reached" (px). */
const WALK_ARRIVE_THRESHOLD = 6;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Direction → tint colour for the placeholder rectangle. */
const DIRECTION_TINTS: Record<Direction, number> = {
  down: 0xe53935, // red
  up: 0x43a047, // green
  left: 0x1e88e5, // blue
  right: 0xfb8c00, // orange
};

let textureGenerated = false;

function ensurePlaceholderTexture(scene: Phaser.Scene): void {
  if (textureGenerated) return;

  const gfx = scene.add.graphics();
  gfx.fillStyle(0xffffff, 1);
  gfx.fillRect(0, 0, SPRITE_W, SPRITE_H);
  // Small "eyes" so the direction is visible even without animation
  gfx.fillStyle(0x000000, 0.6);
  gfx.fillRect(SPRITE_W - 6, 4, 3, 3);
  gfx.fillRect(SPRITE_W - 6, SPRITE_H - 10, 3, 3);
  gfx.generateTexture("__player_placeholder", SPRITE_W, SPRITE_H);
  gfx.destroy();

  textureGenerated = true;
}

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
   * Create the placeholder sprite at the given spawn position.
   *
   * @param tileX  Spawn tile X (map coords).
   * @param tileY  Spawn tile Y (map coords).
   * @param _avatar  Avatar key (unused until D delivers spritesheets).
   */
  spawn(tileX: number, tileY: number, _avatar: string): void {
    ensurePlaceholderTexture(this.scene);

    const px = tileX * 32 + 16;
    const py = tileY * 32 + 16;

    this.sprite = this.scene.physics.add.sprite(px, py, "__player_placeholder");
    this.sprite.setOrigin(0.5, 0.5);
    this.sprite.setTint(DIRECTION_TINTS.down);

    // Physics body slightly smaller than the sprite for forgiving collisions
    this.sprite.body!.setSize(SPRITE_W - 4, SPRITE_H - 6);
    this.sprite.body!.setOffset(2, 4);

    // Render above ground, below overhead objects
    this.sprite.setDepth(10);

    // Bounce off world bounds (set by GameScene to map size)
    this.sprite.setCollideWorldBounds(true);

    // Emit initial position so HUD shows zone immediately
    this.emitPosition();

    void _avatar;
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
      this.sprite.setTint(DIRECTION_TINTS[this.direction]);
    } else if (this.targetTileX !== null) {
      // Tap-to-move: walk toward target tile centre
      this.moveTowardTarget();
    } else {
      this.sprite.setVelocity(0, 0);
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
      this.targetTileX = null;
      this.targetTileY = null;
      return;
    }

    // Normalize and apply velocity
    const vx = (dx / dist) * SPEED;
    const vy = (dy / dist) * SPEED;
    this.sprite.setVelocity(vx, vy);

    // Set direction for tint
    if (Math.abs(dy) >= Math.abs(dx)) {
      this.direction = dy < 0 ? "up" : "down";
    } else {
      this.direction = dx < 0 ? "left" : "right";
    }
    this.sprite.setTint(DIRECTION_TINTS[this.direction]);
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
