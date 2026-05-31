/**
 * HUDScene — Minimap rendered by Phaser (parallel scene, above GameScene).
 *
 * Draws a scaled-down tile overview in the bottom-right corner with:
 *  - Terrain colors (one-time render, cached to a texture)
 *  - Local-player dot (green, updated each frame)
 *  - Camera viewport rectangle (white outline)
 *  - NPC dots (blue)
 *
 * Reads tilemap, player, and entity data from the Phaser registry
 * populated by GameScene.
 */

import Phaser from "phaser";
import type { MapEntity } from "@/network/bridge";
import type { TileMapManager } from "@/game/map/TileMapManager";
import type { LocalPlayer } from "@/game/entities/LocalPlayer";

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** Pixels per map tile on the minimap. */
const MINIMAP_SCALE = 1;

/** Minimap margin from the bottom-right corner of the screen (px). */
const MARGIN = 10;

/** How often to update dynamic elements (Hz). */
const UPDATE_HZ = 5;

// ---------------------------------------------------------------------------
// Terrain colour palette (tileset-local index → colour)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// HUDScene
// ---------------------------------------------------------------------------

export class HUDScene extends Phaser.Scene {
  private minimapX = 0;
  private minimapY = 0;
  private mmW = 160; // computed from map size
  private mmH = 120;

  // Container wrapping all static minimap elements (repositioned on resize)
  private minimapContainer!: Phaser.GameObjects.Container;

  // Dynamic elements (redrawn each update)
  private dynamicGfx!: Phaser.GameObjects.Graphics;

  // Ref to GameScene data (set via registry)
  private tileMapManager: TileMapManager | null = null;
  private localPlayer: LocalPlayer | null = null;

  private lastUpdate = 0;

  constructor() {
    super({ key: "HUDScene" });
  }

  // -----------------------------------------------------------------------
  // Phaser lifecycle
  // -----------------------------------------------------------------------

  create(): void {
    // Read shared data from GameScene (via registry)
    this.tileMapManager = this.registry.get("tileMapManager") ?? null;
    this.localPlayer = this.registry.get("localPlayer") ?? null;

    // Compute minimap size from actual map dimensions
    const mapW = this.tileMapManager?.map?.width ?? 80;
    const mapH = this.tileMapManager?.map?.height ?? 60;
    this.mmW = mapW * MINIMAP_SCALE;
    this.mmH = mapH * MINIMAP_SCALE;

    // Container for all static minimap elements (repositioned on resize)
    this.minimapContainer = this.add.container(0, 0);
    this.minimapContainer.setDepth(199);

    // --- Minimap background (same image as main map) ---
    const bg = this.add.image(this.mmW / 2, this.mmH / 2, "campus-background")
      .setDisplaySize(this.mmW, this.mmH)
      .setDepth(199);
    this.minimapContainer.add(bg);

    // --- Border (in container, local coords) ---
    const border = this.add
      .rectangle(this.mmW / 2, this.mmH / 2, this.mmW + 2, this.mmH + 2)
      .setStrokeStyle(1, 0xffffff, 0.35)
      .setFillStyle(0x000000, 0)
      .setDepth(200);
    this.minimapContainer.add(border);

    // --- Dynamic elements (world coords, not in container) ---
    this.dynamicGfx = this.add.graphics().setDepth(201);

    // --- Label (add to container) ---
    const label = this.add
      .text(4, 2, "M", {
        fontSize: "9px",
        color: "#ffffff",
        fontFamily: "monospace",
      })
      .setAlpha(0.5)
      .setDepth(202);
    this.minimapContainer.add(label);

    // --- Clickable overlay → jump camera (add to container) ---
    const hitZone = this.add
      .zone(this.mmW / 2, this.mmH / 2, this.mmW, this.mmH)
      .setInteractive({ useHandCursor: true })
      .setDepth(203);
    this.minimapContainer.add(hitZone);

    hitZone.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      const localX = pointer.x - this.minimapX;
      const localY = pointer.y - this.minimapY;
      const tileX = Math.floor(localX / MINIMAP_SCALE);
      const tileY = Math.floor(localY / MINIMAP_SCALE);

      const gameScene = this.scene.get("GameScene");
      if (gameScene) {
        const cam = gameScene.cameras.main;
        cam.stopFollow();

        const targetScrollX = tileX * 32 + 16 - cam.width / 2;
        const targetScrollY = tileY * 32 + 16 - cam.height / 2;

        gameScene.tweens.add({
          targets: cam,
          scrollX: targetScrollX,
          scrollY: targetScrollY,
          duration: 300,
          ease: "Cubic.easeOut",
        });
      }
    });

    const resumeFollow = () => {
      const gameScene = this.scene.get("GameScene");
      if (!gameScene) return;
      const sprite = gameScene.registry.get("playerSprite") as
        | Phaser.GameObjects.Sprite
        | null;
      if (sprite) {
        gameScene.cameras.main.startFollow(sprite, true, 0.1, 0.1);
      }
    };

    hitZone.on("pointerup", resumeFollow);
    hitZone.on("pointerout", resumeFollow);

    // Position the container and handle resize
    this.repositionMinimap();
    this.scale.on("resize", this.repositionMinimap, this);
  }

  /** Recalculate minimap position from current camera size. */
  private repositionMinimap = (): void => {
    const { width, height } = this.cameras.main;
    this.minimapX = width - this.mmW - MARGIN;
    this.minimapY = height - this.mmH - MARGIN;
    this.minimapContainer.setPosition(this.minimapX, this.minimapY);
  };

  update(time: number): void {
    if (time - this.lastUpdate < 1000 / UPDATE_HZ) return;
    this.lastUpdate = time;

    this.dynamicGfx.clear();

    // --- NPC dots (blue) ---
    const entities: Map<string, MapEntity> | undefined =
      this.registry.get("entities");
    if (entities) {
      for (const [, entity] of entities) {
        if (entity.isNPC) {
          const mx = this.minimapX + entity.x * MINIMAP_SCALE;
          const my = this.minimapY + entity.y * MINIMAP_SCALE;
          this.dynamicGfx.fillStyle(0x4488ff, 0.9);
          this.dynamicGfx.fillRect(mx - 2, my - 2, 4, 4);
        }
      }
    }

    // --- Player dot (green, slightly larger) ---
    if (this.localPlayer?.sprite) {
      const px = this.localPlayer.tileX;
      const py = this.localPlayer.tileY;
      const mx = this.minimapX + px * MINIMAP_SCALE;
      const my = this.minimapY + py * MINIMAP_SCALE;
      this.dynamicGfx.fillStyle(0x4caf50, 1);
      this.dynamicGfx.fillRect(mx - 3, my - 3, 6, 6);
    }

    // --- Camera viewport (white outline) ---
    const cam = this.scene.get("GameScene")?.cameras?.main;
    if (cam) {
      const camTileX = Math.floor(cam.scrollX / 32);
      const camTileY = Math.floor(cam.scrollY / 32);
      const camTileW = Math.ceil(cam.width / 32);
      const camTileH = Math.ceil(cam.height / 32);

      const rx = this.minimapX + camTileX * MINIMAP_SCALE;
      const ry = this.minimapY + camTileY * MINIMAP_SCALE;
      const rw = camTileW * MINIMAP_SCALE;
      const rh = camTileH * MINIMAP_SCALE;

      this.dynamicGfx.lineStyle(1, 0xffffff, 0.7);
      this.dynamicGfx.strokeRect(rx, ry, rw, rh);
    }
  }

}
