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

const TILE_COLORS: Record<number, number> = {
  0: 0x4a8c3f, // grass
  1: 0x5a9c4f, // grass_alt
  2: 0xc4b078, // path
  3: 0xb4a068, // path_alt
  4: 0x3366cc, // water
  5: 0x777777, // wall
  6: 0x2d5a1e, // tree
  7: 0xe8a0b8, // flower_pink
  8: 0xe8d040, // flower_yel
  9: 0x8b7352, // bench
  10: 0x994444, // roof
  11: 0x3a6c2f, // grass_dark
};

const DEFAULT_TILE_COLOR = 0x000000;

// ---------------------------------------------------------------------------
// HUDScene
// ---------------------------------------------------------------------------

export class HUDScene extends Phaser.Scene {
  private minimapX = 0;
  private minimapY = 0;
  private mmW = 160; // computed from map size
  private mmH = 120;

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

    const { width, height } = this.cameras.main;

    // Position minimap at bottom-right
    this.minimapX = width - this.mmW - MARGIN;
    this.minimapY = height - this.mmH - MARGIN;

    // --- Static terrain (rendered once) ---
    this.renderTerrain();

    // --- Border ---
    this.add
      .rectangle(
        this.minimapX + this.mmW / 2,
        this.minimapY + this.mmH / 2,
        this.mmW + 2,
        this.mmH + 2,
      )
      .setStrokeStyle(1, 0xffffff, 0.35)
      .setFillStyle(0x000000, 0)
      .setDepth(200);

    // --- Dynamic elements ---
    this.dynamicGfx = this.add.graphics().setDepth(201);

    // --- Label ---
    this.add
      .text(this.minimapX + 4, this.minimapY + 2, "M", {
        fontSize: "9px",
        color: "#ffffff",
        fontFamily: "monospace",
      })
      .setAlpha(0.5)
      .setDepth(202);

    // --- Clickable overlay → jump camera ---
    const hitZone = this.add
      .zone(
        this.minimapX + this.mmW / 2,
        this.minimapY + this.mmH / 2,
        this.mmW,
        this.mmH,
      )
      .setInteractive({ useHandCursor: true })
      .setDepth(203);

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
  }

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

  // -----------------------------------------------------------------------
  // Terrain render (one-time)
  // -----------------------------------------------------------------------

  private renderTerrain(): void {
    const map = this.tileMapManager?.map;
    if (!map) {
      this.add
        .rectangle(
          this.minimapX + this.mmW / 2,
          this.minimapY + this.mmH / 2,
          this.mmW,
          this.mmH,
          0x111122,
          0.85,
        )
        .setDepth(199);
      return;
    }

    const groundLayer = map.getLayer("ground");
    if (!groundLayer?.data) return;

    const mapW = map.width;
    const mapH = map.height;

    const terrainGfx = this.add.graphics();
    terrainGfx.setDepth(199);

    // Background
    terrainGfx.fillStyle(0x111122, 0.85);
    terrainGfx.fillRect(this.minimapX, this.minimapY, this.mmW, this.mmH);

    // Each tile → MINIMAP_SCALE × MINIMAP_SCALE pixels
    for (let ty = 0; ty < mapH; ty++) {
      for (let tx = 0; tx < mapW; tx++) {
        const tile = groundLayer.data[ty]?.[tx];
        if (!tile || tile.index === -1) continue;

        const color = TILE_COLORS[tile.index] ?? DEFAULT_TILE_COLOR;
        terrainGfx.fillStyle(color, 0.85);
        terrainGfx.fillRect(
          this.minimapX + tx * MINIMAP_SCALE,
          this.minimapY + ty * MINIMAP_SCALE,
          MINIMAP_SCALE,
          MINIMAP_SCALE,
        );
      }
    }
  }
}
