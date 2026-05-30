/**
 * TileMapManager — Loads and manages the Tiled JSON tile map.
 *
 * Creates tilemap layers (ground, decoration, collision) and provides
 * helper methods for tile queries (walkable checks, position ↔ tile conversion).
 */

import Phaser from "phaser";

export class TileMapManager {
  map: Phaser.Tilemaps.Tilemap | null = null;
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    void this.scene; // used when map layers are created
  }

  /** Load a Tiled JSON map from the cache (BootScene preloaded it). */
  load(key: string, tilesetKey: string): void {
    // TODO: Create tilemap from cache
    // const map = this.scene.make.tilemap({ key });
    // const tileset = map.addTilesetImage("campus-tileset", tilesetKey);
    // if (!tileset) throw new Error("Tileset not found");
    // map.createLayer("ground", tileset, 0, 0);
    // map.createLayer("decoration", tileset, 0, 0);
    // const collisionLayer = map.createLayer("collision", tileset, 0, 0);
    // collisionLayer?.setCollisionByExclusion([-1]);
    // this.map = map;
    void key;
    void tilesetKey;
  }

  /** Check if a tile coordinate is walkable. */
  isWalkable(_tileX: number, _tileY: number): boolean {
    // TODO: Check collision layer tile at (tileX, tileY)
    return true;
  }

  /** Convert pixel position to tile coordinate. */
  static pixelToTile(px: number): number {
    return Math.floor(px / 32);
  }

  /** Convert tile coordinate to pixel position (center of tile). */
  static tileToPixel(tile: number): number {
    return tile * 32 + 16;
  }
}
