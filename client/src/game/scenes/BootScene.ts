/**
 * BootScene — Preloads all assets before the game starts.
 *
 * First scene in the Phaser pipeline. Shows a loading bar while fetching
 * spritesheets, tilesets, and map JSON from public/assets/.
 */

import Phaser from "phaser";

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  preload(): void {
    // TODO: Load actual assets when D delivers them.
    // For now, just show a simple loading text and transition.
    const { width, height } = this.cameras.main;

    const loadingText = this.add
      .text(width / 2, height / 2, "Loading...", {
        fontSize: "24px",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    // Placeholder loading bar
    const barBg = this.add.rectangle(width / 2, height / 2 + 40, 320, 20, 0x333333);
    const barFill = this.add.rectangle(
      width / 2 - 160,
      height / 2 + 40,
      0,
      20,
      0x4caf50,
    );
    barFill.setOrigin(0, 0.5);

    this.load.on("progress", (value: number) => {
      barFill.width = 320 * value;
    });

    this.load.on("complete", () => {
      loadingText.destroy();
      barBg.destroy();
      barFill.destroy();
    });

    // --- Asset stubs (uncomment when D delivers assets) ---
    // this.load.image("tileset", "assets/tilesets/campus-tileset.png");
    // this.load.tilemapTiledJSON("map", "assets/maps/yuehai-campus.json");
    // for (let i = 1; i <= 8; i++) {
    //   const key = `avatar_${String(i).padStart(2, "0")}`;
    //   this.load.spritesheet(key, `assets/sprites/avatars/${key}.png`, {
    //     frameWidth: 32,
    //     frameHeight: 48,
    //   });
    // }
  }

  create(): void {
    this.scene.start("GameScene");
  }
}
