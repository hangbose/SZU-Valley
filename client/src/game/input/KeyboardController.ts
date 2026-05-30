/**
 * KeyboardController — Polls keyboard state for movement input.
 *
 * Supports both arrow keys and WASD. Exposes a normalized direction vector
 * and a moving flag for the LocalPlayer to consume each frame.
 */

import Phaser from "phaser";

export type Direction = "up" | "down" | "left" | "right";

export interface MovementInput {
  /** Normalized direction vector. Length is 0 (idle) or ~1 (moving). */
  dx: number;
  dy: number;
  /** Cardinal direction for sprite animation. */
  direction: Direction;
  /** Whether any movement key is held. */
  moving: boolean;
}

export class KeyboardController {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };

  constructor(scene: Phaser.Scene) {
    if (!scene.input.keyboard) {
      throw new Error("Keyboard input not available");
    }
    this.cursors = scene.input.keyboard.createCursorKeys();
    this.wasd = {
      W: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
  }

  /** Poll current input state. Call once per frame. */
  getInput(): MovementInput {
    const left = this.cursors.left.isDown || this.wasd.A.isDown;
    const right = this.cursors.right.isDown || this.wasd.D.isDown;
    const up = this.cursors.up.isDown || this.wasd.W.isDown;
    const down = this.cursors.down.isDown || this.wasd.S.isDown;

    // Normalize diagonals
    let dx = 0;
    let dy = 0;
    if (left) dx -= 1;
    if (right) dx += 1;
    if (up) dy -= 1;
    if (down) dy += 1;

    const moving = dx !== 0 || dy !== 0;

    // Diagonal normalization (prevents faster diagonal movement)
    if (dx !== 0 && dy !== 0) {
      const inv = 1 / Math.SQRT2;
      dx *= inv;
      dy *= inv;
    }

    // Determine cardinal direction (for sprite animation)
    let direction: Direction = "down";
    if (moving) {
      if (Math.abs(dy) >= Math.abs(dx)) {
        direction = dy < 0 ? "up" : "down";
      } else {
        direction = dx < 0 ? "left" : "right";
      }
    }

    return { dx, dy, direction, moving };
  }
}
