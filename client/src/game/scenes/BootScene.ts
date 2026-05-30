/**
 * BootScene — Preloads assets before the game starts.
 *
 * Loads the tileset PNG and Tiled JSON map that D has already delivered.
 * Character sprites are loaded later when D provides them; for now we use
 * placeholder graphics (coloured rectangles) in the entity classes.
 */

import Phaser from "phaser";

/** Tileset image dimensions (pixels). */
const TILESET_WIDTH = 128;
const TILESET_HEIGHT = 96;

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  preload(): void {
    const { width, height } = this.cameras.main;

    // --- Loading bar UI ---
    const loadingText = this.add
      .text(width / 2, height / 2 - 10, "Loading...", {
        fontSize: "24px",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    const barW = 320;
    const barH = 20;
    const barBg = this.add.rectangle(
      width / 2,
      height / 2 + 30,
      barW,
      barH,
      0x333333,
    );
    const barFill = this.add.rectangle(
      width / 2 - barW / 2,
      height / 2 + 30,
      0,
      barH,
      0x4caf50,
    );
    barFill.setOrigin(0, 0.5);

    this.load.on("progress", (value: number) => {
      barFill.width = barW * value;
    });

    this.load.on("complete", () => {
      loadingText.destroy();
      barBg.destroy();
      barFill.destroy();
    });

    // --- Real assets from D ---
    // Tileset image (128×96 px, 12 tiles of 32×32)
    this.load.image("campus-tileset", "assets/tilesets/campus-tileset.png");

    // Tiled map JSON (80×60 tiles = 2560×1920 px world)
    this.load.tilemapTiledJSON("campus-test", "assets/maps/campus-test.json");

    // TODO: load avatar spritesheets and NPC sprites when D delivers them
    // this.load.spritesheet("avatar_01", "assets/sprites/avatars/avatar_01.png", {
    //   frameWidth: 32,
    //   frameHeight: 48,
    // });
  }

  create(): void {
    // Verify tileset loaded at correct size
    const tex = this.textures.get("campus-tileset").getSourceImage();
    if (
      tex.width !== TILESET_WIDTH ||
      tex.height !== TILESET_HEIGHT
    ) {
      console.warn(
        `[BootScene] Unexpected tileset size: ${tex.width}×${tex.height} (expected ${TILESET_WIDTH}×${TILESET_HEIGHT})`,
      );
    }

    this.scene.start("GameScene");
  }
}
