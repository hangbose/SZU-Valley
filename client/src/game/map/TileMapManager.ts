/**
 * TileMapManager — Loads and manages the Tiled JSON tile map.
 *
 * Creates all three layers from the Tiled map:
 *   1. ground      — rendered (grass, paths, water, etc.)
 *   2. decoration  — rendered above ground (trees, flowers, benches)
 *   3. collision   — invisible, used for Arcade physics collision
 *
 * The dedicated collision layer is the single source of truth for
 * walkability — we don't guess based on tile type.
 */

import Phaser from "phaser";

/** Tile size in pixels — must match the Tiled map and tileset. */
export const TILE_SIZE = 32;

export class TileMapManager {
  /** The Phaser tilemap instance. */
  map: Phaser.Tilemaps.Tilemap | null = null;

  /** The collision layer (invisible, used for physics). */
  collisionLayer: Phaser.Tilemaps.TilemapLayer | null = null;

  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Create the tilemap from assets preloaded by BootScene.
   *
   * @returns The collision layer so callers can set up physics colliders.
   */
  load(
    mapKey: string,
    tilesetKey: string,
  ): Phaser.Tilemaps.TilemapLayer {
    const map = this.scene.make.tilemap({ key: mapKey });
    this.map = map;

    // The TSX name must match the tileset name in the Tiled map
    const tileset = map.addTilesetImage("campus-tileset", tilesetKey);
    if (!tileset) {
      throw new Error(
        `[TileMapManager] Tileset "campus-tileset" not found in map "${mapKey}".`,
      );
    }

    // --- Layer 1: Ground (rendered, z=0) ---
    const groundLayer = map.createLayer("ground", tileset, 0, 0);
    if (!groundLayer) {
      throw new Error(`[TileMapManager] Layer "ground" not found.`);
    }
    groundLayer.setDepth(0);

    // --- Layer 2: Decoration (rendered above ground, z=5) ---
    // Trees, flowers, benches — things that sit on top of the ground
    const decorationLayer = map.createLayer("decoration", tileset, 0, 0);
    if (decorationLayer) {
      decorationLayer.setDepth(5);
    }

    // --- Layer 3: Collision (invisible, z=999 so it's never rendered) ---
    const collisionLayer = map.createLayer("collision", tileset, 0, 0);
    if (!collisionLayer) {
      throw new Error(`[TileMapManager] Layer "collision" not found.`);
    }
    collisionLayer.setDepth(999);
    collisionLayer.setVisible(false);

    // Mark every non-empty tile on the collision layer as colliding
    // Tiled uses 0 = empty, so exclude 0 → everything else blocks
    collisionLayer.setCollisionByExclusion([-1]); // -1 means "exclude nothing"

    this.collisionLayer = collisionLayer;

    // --- Dev: render collision overlay ---
    if (import.meta.env.DEV) {
      const debugGraphics = this.scene.add.graphics().setAlpha(0.25);
      debugGraphics.setDepth(998);
      collisionLayer.renderDebug(debugGraphics, {
        tileColor: null,
        collidingTileColor: new Phaser.Display.Color(255, 0, 0, 80),
        faceColor: new Phaser.Display.Color(255, 0, 0, 40),
      });
    }

    return collisionLayer;
  }

  /** Check whether a tile coordinate is walkable (no collision). */
  isWalkable(tileX: number, tileY: number): boolean {
    if (!this.collisionLayer) return false;
    const tile = this.collisionLayer.getTileAt(tileX, tileY);
    if (!tile) return true; // empty tile → walkable
    return !tile.collides;
  }

  /** Get the world dimensions in pixels. */
  get worldWidth(): number {
    return this.map?.widthInPixels ?? 0;
  }

  get worldHeight(): number {
    return this.map?.heightInPixels ?? 0;
  }

  // -----------------------------------------------------------------------
  // Static helpers
  // -----------------------------------------------------------------------

  /** Convert a pixel coordinate to a tile index. */
  static pixelToTile(px: number): number {
    return Math.floor(px / TILE_SIZE);
  }

  /** Convert a tile index to the pixel centre of that tile. */
  static tileToPixel(tile: number): number {
    return tile * TILE_SIZE + TILE_SIZE / 2;
  }
}
