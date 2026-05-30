/**
 * game/index.ts — Phaser game configuration and launch.
 *
 * Creates the Phaser.Game instance, registers scenes, and attaches to a
 * DOM container provided by React.
 */

import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { GameScene } from "./scenes/GameScene";
import { HUDScene } from "./scenes/HUDScene";

export function createGame(parent: HTMLElement): Phaser.Game {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent,
    backgroundColor: "#1a1a2e",
    pixelArt: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene, GameScene, HUDScene],
    // Phaser's Arcade physics for simple collision (walls, etc.)
    physics: {
      default: "arcade",
      arcade: {
        gravity: { x: 0, y: 0 }, // top-down, no gravity
        debug: import.meta.env.DEV,
      },
    },
  };

  return new Phaser.Game(config);
}

export function destroyGame(game: Phaser.Game | null): void {
  if (game) {
    game.destroy(true);
  }
}
