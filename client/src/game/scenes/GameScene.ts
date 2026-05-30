/**
 * GameScene — Main gameplay scene.
 *
 * Orchestrates the tilemap, local player, camera, entity registry,
 * proximity detection, and interaction prompt. Test NPCs are seeded
 * so proximity + interaction can be exercised without a server.
 */

import Phaser from "phaser";
import { bridge } from "@/network/bridge";
import type { MapEntity } from "@/network/bridge";
import { TileMapManager } from "@/game/map/TileMapManager";
import { LocalPlayer } from "@/game/entities/LocalPlayer";
import { NPC } from "@/game/entities/NPC";

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** Default spawn tile when the server doesn't assign one. Centre of 80×60 map. */
const DEFAULT_SPAWN_TILE = { x: 40, y: 30 };

/** Cache keys (must match BootScene preload keys). */
const TILESET_KEY = "campus-tileset";
const MAP_KEY = "campus-test";

/** Manhattan distance threshold for proximity (tiles). */
const PROXIMITY_RANGE = 3;

/** Number of proximity checks per second (avoids scanning every frame). */
const PROXIMITY_HZ = 10;

// ---------------------------------------------------------------------------
// Test NPCs (static seed data — replaced by zone.npcs socket event later)
// ---------------------------------------------------------------------------

interface NpcSeed {
  id: string;
  name: string;
  tileX: number;
  tileY: number;
  description: string;
}

const TEST_NPCS: NpcSeed[] = [
  {
    id: "npc_librarian",
    name: "图书管理员 · Librarian",
    tileX: 36,
    tileY: 28,
    description: "管理图书馆借阅 · Manages book loans",
  },
  {
    id: "npc_barista",
    name: "咖啡师 · Barista",
    tileX: 44,
    tileY: 26,
    description: "校园咖啡店店员 · Campus café staff",
  },
  {
    id: "npc_student_a",
    name: "自习的同学 · Studious classmate",
    tileX: 38,
    tileY: 34,
    description: "正在复习高数 · Reviewing advanced math",
  },
  {
    id: "npc_guard",
    name: "保安大叔 · Security guard",
    tileX: 42,
    tileY: 32,
    description: "校门执勤 · On gate duty",
  },
];

// ---------------------------------------------------------------------------
// GameScene
// ---------------------------------------------------------------------------

export class GameScene extends Phaser.Scene {
  // ---- Subsystems ----
  private tileMapManager!: TileMapManager;
  private localPlayer!: LocalPlayer;

  // ---- Entity registry (id → MapEntity) ----
  private entities = new Map<string, MapEntity>();

  // ---- Proximity state ----
  private proximityTargets = new Set<string>();
  private lastProximityCheck = 0;
  private closestTargetId: string | null = null;

  // ---- Interaction prompt ----
  private promptText!: Phaser.GameObjects.Text;
  private promptBg!: Phaser.GameObjects.Rectangle;
  private eKey!: Phaser.Input.Keyboard.Key;

  // ---- NPC instances (for cleanup) ----
  private npcs: NPC[] = [];

  constructor() {
    super({ key: "GameScene" });
  }

  // -----------------------------------------------------------------------
  // Phaser lifecycle
  // -----------------------------------------------------------------------

  create(): void {
    // --- 1. Tilemap ---
    this.tileMapManager = new TileMapManager(this);
    const collisionLayer = this.tileMapManager.load(MAP_KEY, TILESET_KEY);

    const worldW = this.tileMapManager.worldWidth;
    const worldH = this.tileMapManager.worldHeight;
    this.physics.world.setBounds(0, 0, worldW, worldH);
    this.cameras.main.setBounds(0, 0, worldW, worldH);

    // --- 2. Local player ---
    this.localPlayer = new LocalPlayer(this);
    this.localPlayer.spawn(DEFAULT_SPAWN_TILE.x, DEFAULT_SPAWN_TILE.y, "");
    this.physics.add.collider(this.localPlayer.sprite, collisionLayer);

    // --- 3. Camera ---
    this.cameras.main.startFollow(this.localPlayer.sprite, true, 0.1, 0.1);

    // --- 4. Seed test NPCs ---
    for (const seed of TEST_NPCS) {
      const npc = new NPC(
        this,
        seed.id,
        seed.name,
        "",
        seed.tileX,
        seed.tileY,
        seed.description,
      );
      npc.sprite.setDepth(5);
      this.npcs.push(npc);
      this.registerEntity({
        id: seed.id,
        name: seed.name,
        x: seed.tileX,
        y: seed.tileY,
        isNPC: true,
      });
    }

    // --- 5. Interaction prompt (hidden until someone is nearby) ---
    this.createInteractionPrompt();

    // --- 6. E key for interaction ---
    this.eKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    // --- 6b. Tap/click on ground → walk there ---
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      // Only trigger on left-click / single tap
      if (pointer.button !== 0) return;

      // Convert screen coords to world coords (accounts for camera scroll)
      const worldPoint = this.cameras.main.getWorldPoint(
        pointer.x,
        pointer.y,
      );
      const tileX = TileMapManager.pixelToTile(worldPoint.x);
      const tileY = TileMapManager.pixelToTile(worldPoint.y);

      // Don't walk if clicking on an entity at/near that tile
      for (const [, entity] of this.entities) {
        if (entity.x === tileX && entity.y === tileY) return;
      }

      // Don't walk onto non-walkable tiles
      if (!this.tileMapManager.isWalkable(tileX, tileY)) return;

      // Go!
      this.localPlayer.walkTo(tileX, tileY);

      // Visual feedback: a brief ripple dot at the target
      this.showTapFeedback(worldPoint.x, worldPoint.y);
    });

    // --- 7. Bridge events ---
    bridge.emit("position-changed", {
      x: this.localPlayer.tileX,
      y: this.localPlayer.tileY,
      zoneName: "Campus",
    });
    bridge.emit("zone-changed", { zoneName: "Campus" });

    // --- 8. Share data with HUDScene via registry ---
    this.registry.set("tileMapManager", this.tileMapManager);
    this.registry.set("localPlayer", this.localPlayer);
    this.registry.set("entities", this.entities);
    this.registry.set("proximityTargets", this.proximityTargets);
    this.registry.set("closestTargetId", this.closestTargetId);

    // --- 9. Launch HUDScene (parallel scene for minimap) ---
    this.scene.launch("HUDScene");

    // --- 10. Resize ---
    this.scale.on("resize", this.handleResize, this);
  }

  update(time: number, delta: number): void {
    // Local player
    this.localPlayer.update(time, delta);

    // Proximity check (throttled to PROXIMITY_HZ)
    if (time - this.lastProximityCheck >= 1000 / PROXIMITY_HZ) {
      this.lastProximityCheck = time;
      this.runProximityCheck();
    }

    // Update interaction prompt position
    this.updatePromptPosition();

    // E key → interact with closest target
    if (Phaser.Input.Keyboard.JustDown(this.eKey)) {
      this.interactWithClosest();
    }
  }

  // -----------------------------------------------------------------------
  // Entity registry
  // -----------------------------------------------------------------------

  /** Add or update an entity in the registry. */
  registerEntity(entity: MapEntity): void {
    this.entities.set(entity.id, entity);
  }

  /** Remove an entity from the registry (and proximity). */
  unregisterEntity(id: string): void {
    this.entities.delete(id);
    this.proximityTargets.delete(id);
    if (this.closestTargetId === id) {
      this.closestTargetId = null;
      this.hidePrompt();
    }
  }

  // -----------------------------------------------------------------------
  // Proximity detection
  // -----------------------------------------------------------------------

  private runProximityCheck(): void {
    const px = this.localPlayer.tileX;
    const py = this.localPlayer.tileY;

    for (const [id, entity] of this.entities) {
      const dist = Math.abs(px - entity.x) + Math.abs(py - entity.y);
      const wasNear = this.proximityTargets.has(id);

      if (dist <= PROXIMITY_RANGE && !wasNear) {
        // Entered proximity
        this.proximityTargets.add(id);
        bridge.emit("proximity-enter", entity);
      } else if (dist > PROXIMITY_RANGE && wasNear) {
        // Left proximity
        this.proximityTargets.delete(id);
        bridge.emit("proximity-exit", { id });
      }
    }

    // Recalculate closest target
    this.closestTargetId = this.findClosestTarget(px, py);
    if (this.closestTargetId) {
      this.showPrompt(this.entities.get(this.closestTargetId)!);
    } else {
      this.hidePrompt();
    }
  }

  /** Find the closest proximity target by Manhattan distance. */
  private findClosestTarget(
    px: number,
    py: number,
  ): string | null {
    let best: string | null = null;
    let bestDist = Infinity;

    for (const id of this.proximityTargets) {
      const e = this.entities.get(id);
      if (!e) continue;
      const d = Math.abs(px - e.x) + Math.abs(py - e.y);
      if (d < bestDist) {
        bestDist = d;
        best = id;
      }
    }

    return best;
  }

  // -----------------------------------------------------------------------
  // Interaction prompt ("按 E 交谈 · Press E to talk")
  // -----------------------------------------------------------------------

  private createInteractionPrompt(): void {
    const label = "按 E 交谈 · Press E";

    this.promptText = this.add
      .text(0, 0, label, {
        fontSize: "11px",
        color: "#ffffff",
        fontFamily: "monospace",
      })
      .setOrigin(0.5, 1)
      .setDepth(100)
      .setVisible(false);

    // Background pill
    const padX = 10;
    const padY = 4;
    this.promptBg = this.add
      .rectangle(
        0,
        0,
        this.promptText.width + padX * 2,
        this.promptText.height + padY * 2,
        0x000000,
        0.7,
      )
      .setOrigin(0.5, 1)
      .setDepth(99)
      .setVisible(false);
  }

  /** Show the prompt above a target entity. */
  private showPrompt(entity: MapEntity): void {
    const px = entity.x * 32 + 16;
    const py = entity.y * 32 - 4; // just above the sprite

    this.promptBg.setPosition(px, py).setVisible(true);
    this.promptText.setPosition(px, py - 6).setVisible(true);
  }

  /** Hide the interaction prompt. */
  private hidePrompt(): void {
    this.promptBg.setVisible(false);
    this.promptText.setVisible(false);
  }

  /** Re-position the prompt every frame (follows moving targets). */
  private updatePromptPosition(): void {
    if (!this.closestTargetId) return;
    const entity = this.entities.get(this.closestTargetId);
    if (!entity) {
      this.hidePrompt();
      return;
    }
    const px = entity.x * 32 + 16;
    const py = entity.y * 32 - 4;
    this.promptBg.setPosition(px, py);
    this.promptText.setPosition(px, py - 6);
  }

  // -----------------------------------------------------------------------
  // Interaction
  // -----------------------------------------------------------------------

  /** Press E on the closest target → emit the appropriate bridge event. */
  private interactWithClosest(): void {
    if (!this.closestTargetId) return;
    const entity = this.entities.get(this.closestTargetId);
    if (!entity) return;

    if (entity.isNPC) {
      bridge.emit("npc-clicked", {
        npcId: entity.id,
        npcName: entity.name,
        screenX: this.scale.width / 2,
        screenY: this.scale.height / 2,
      });
    } else {
      bridge.emit("player-clicked", {
        playerId: entity.id,
        screenX: this.scale.width / 2,
        screenY: this.scale.height / 2,
      });
    }
  }

  // -----------------------------------------------------------------------
  // Tap feedback
  // -----------------------------------------------------------------------

  /** Brief expanding ring at the tap location. */
  private showTapFeedback(worldX: number, worldY: number): void {
    const ring = this.add.circle(worldX, worldY, 6, 0xffffff, 0.5);
    ring.setDepth(50);
    ring.setStrokeStyle(2, 0x4caf50, 0.8);

    this.tweens.add({
      targets: ring,
      radius: 24,
      alpha: 0,
      duration: 400,
      ease: "Cubic.easeOut",
      onComplete: () => ring.destroy(),
    });
  }

  // -----------------------------------------------------------------------
  // Resize
  // -----------------------------------------------------------------------

  private handleResize = (): void => {
    const { width, height } = this.scale;
    this.cameras.main.setSize(width, height);
  };
}
