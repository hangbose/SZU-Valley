/**
 * GameScene — Main gameplay scene.
 *
 * Renders the tile map, local player, remote players, NPCs, and handles
 * collision + camera follow. This scene runs continuously during gameplay.
 */

import Phaser from "phaser";
import { bridge } from "@/network/bridge";

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: "GameScene" });
  }

  create(): void {
    // --- Placeholder: black background + debug text ---
    const { width, height } = this.cameras.main;

    this.add
      .text(width / 2, height / 2, "SZU Valley\nGame Scene", {
        fontSize: "32px",
        color: "#4caf50",
        align: "center",
      })
      .setOrigin(0.5);

    // --- Placeholder grid (visual indicator that Phaser is running) ---
    const graphics = this.add.graphics();
    graphics.lineStyle(1, 0x333333, 0.3);
    for (let x = 0; x < width; x += 32) {
      graphics.lineBetween(x, 0, x, height);
    }
    for (let y = 0; y < height; y += 32) {
      graphics.lineBetween(0, y, width, y);
    }

    // --- Bridge: emit initial position ---
    bridge.emit("position-changed", { x: 0, y: 0, zoneName: "Campus" });
    bridge.emit("zone-changed", { zoneName: "Campus" });

    // TODO: Load tile map from BootScene cache
    // TODO: Spawn local player sprite
    // TODO: Set up collision with collision layer
    // TODO: Camera follow local player
    // TODO: Wire keyboard input → player movement
  }

  update(_time: number, _delta: number): void {
    // TODO: Per-frame updates — player movement, interpolation, proximity checks
  }
}
