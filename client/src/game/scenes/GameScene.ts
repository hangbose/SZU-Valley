/**
 * GameScene — Main gameplay scene.
 *
 * Orchestrates the tilemap, local player, camera, entity registry,
 * proximity detection, interaction prompt, and server event handling
 * (remote players, NPCs, movement broadcast).
 *
 * Test NPCs are seeded as a fallback and replaced when the server
 * sends `zone.npcs`.
 */

import Phaser from "phaser";
import { bridge } from "@/network/bridge";
import type { MapEntity } from "@/network/bridge";
import { getSocket, consumeZoneBuffer } from "@/network/socket";
import { TileMapManager } from "@/game/map/TileMapManager";
import { LocalPlayer } from "@/game/entities/LocalPlayer";
import { RemotePlayer } from "@/game/entities/RemotePlayer";
import { NPC } from "@/game/entities/NPC";
import { useGameStore } from "@/ui/store/gameStore";

// ---------------------------------------------------------------------------
// Chat bubble tunables
// ---------------------------------------------------------------------------

/** Max characters shown in a chat bubble before truncation. */
const BUBBLE_MAX_CHARS = 20;

/** How long the bubble stays visible (ms). */
const BUBBLE_DURATION = 30_000;

/** When to start the fade-out (ms before removal). */
const BUBBLE_FADE_START = 2000;

interface BubbleData {
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  text: Phaser.GameObjects.Text;
  entityId: string;
  createdAt: number;
  onClick: (() => void) | null;
}

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** Default spawn tile when the server doesn't assign one. Centre of 200×150 map. */
const DEFAULT_SPAWN_TILE = { x: 100, y: 75 };

/** Cache keys (must match BootScene preload keys). */
const TILESET_KEY = "campus-tileset";
const MAP_KEY = "campus-test";
const BACKGROUND_KEY = "campus-background";

/** Manhattan distance threshold for proximity (tiles). */
const PROXIMITY_RANGE = 3;

/** Number of proximity checks per second (avoids scanning every frame). */
const PROXIMITY_HZ = 10;

/** How often to send `player.move` to the server (ms). */
const MOVE_SEND_INTERVAL = 50;

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
    tileX: 96,
    tileY: 28,
    description: "管理图书馆借阅 · Manages book loans",
  },
  {
    id: "npc_barista",
    name: "咖啡师 · Barista",
    tileX: 116,
    tileY: 132,
    description: "校园咖啡店店员 · Campus café staff",
  },
  {
    id: "npc_student_a",
    name: "自习的同学 · Studious classmate",
    tileX: 100,
    tileY: 80,
    description: "正在复习高数 · Reviewing advanced math",
  },
  {
    id: "npc_guard",
    name: "保安大叔 · Security guard",
    tileX: 100,
    tileY: 139,
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
  private promptKey!: Phaser.GameObjects.Sprite;
  private eKey!: Phaser.Input.Keyboard.Key;
  private readonly PROMPT_SCALE = 0.7;

  // ---- NPC instances (for cleanup) ----
  private npcs: NPC[] = [];

  // ---- Remote players (id → RemotePlayer) ----
  private remotePlayers = new Map<string, RemotePlayer>();

  // ---- Socket state ----
  private lastMoveSend = 0;
  private serverNpcSeeded = false;

  // ---- Chat bubbles ----
  private bubbles = new Map<string, BubbleData>();

  constructor() {
    super({ key: "GameScene" });
  }

  // -----------------------------------------------------------------------
  // Phaser lifecycle
  // -----------------------------------------------------------------------

  create(): void {
    // --- 1. Tilemap ---
    this.tileMapManager = new TileMapManager(this);
    const collisionLayer = this.tileMapManager.load(MAP_KEY, TILESET_KEY, {
      debugCollision: false,
      renderVisualLayers: false,
    });

    const worldW = this.tileMapManager.worldWidth;
    const worldH = this.tileMapManager.worldHeight;

    this.add
      .image(0, 0, BACKGROUND_KEY)
      .setOrigin(0)
      .setDepth(-10)
      .setDisplaySize(worldW, worldH);

    this.physics.world.setBounds(0, 0, worldW, worldH);
    this.cameras.main.setBounds(0, 0, worldW, worldH);

    // --- 2. Local player (use server-assigned spawn, fallback to default) ---
    const store = useGameStore.getState();
    const spawnTileX = store.spawnX || DEFAULT_SPAWN_TILE.x;
    const spawnTileY = store.spawnY || DEFAULT_SPAWN_TILE.y;

    this.localPlayer = new LocalPlayer(this);
    this.localPlayer.spawn(spawnTileX, spawnTileY, store.playerAvatar || "");
    this.physics.add.collider(this.localPlayer.sprite, collisionLayer);

    // --- 3. Camera ---
    this.cameras.main.startFollow(this.localPlayer.sprite, true, 0.1, 0.1);
    this.cameras.main.setZoom(0.2); // show more of the map by default

    // --- 3b. Scroll-wheel zoom ---
    this.setupZoom();

    // --- 4. Seed test NPCs (fallback — replaced when server sends zone.npcs) ---
    this.seedTestNpcs();

    // --- 4b. Server event handlers ---
    this.setupServerEvents();

    // --- 4c. Consume buffered zone data (may have arrived before GameScene started) ---
    this.consumeZoneBuffer();

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
    this.registry.set("playerSprite", this.localPlayer.sprite);
    this.registry.set("entities", this.entities);
    this.registry.set("proximityTargets", this.proximityTargets);
    this.registry.set("closestTargetId", this.closestTargetId);

    // --- 9. Launch HUDScene (parallel scene for minimap) ---
    this.scene.launch("HUDScene");

    // --- 10. Resize ---
    this.scale.on("resize", this.handleResize, this);

    // --- 11. Listen for friend-click → fly camera ---
    bridge.on("focus-entity", ({ id }) => this.flyToEntity(id));
  }

  update(time: number, delta: number): void {
    // Local player
    this.localPlayer.update(time, delta);

    // Send player.move to server (throttled)
    this.sendMoveToServer(time);

    // Remote players interpolation
    for (const rp of this.remotePlayers.values()) {
      rp.update(time, delta);
    }

    // Update chat bubbles (follow entities, fade out)
    this.updateBubbles(time);
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
  // Test NPC seeding (fallback)
  // -----------------------------------------------------------------------

  private seedTestNpcs(): void {
    if (this.serverNpcSeeded) return;

    for (const seed of TEST_NPCS) {
      this.spawnNpc(seed.id, seed.name, "", seed.tileX, seed.tileY, seed.description);
    }
  }

  /** Spawn a single NPC and register it. */
  private spawnNpc(
    id: string,
    name: string,
    avatar: string,
    tileX: number,
    tileY: number,
    description: string,
  ): void {
    // Avoid duplicates
    if (this.entities.has(id)) return;

    const npc = new NPC(this, id, name, avatar, tileX, tileY, description);
    npc.sprite.setDepth(5);
    this.npcs.push(npc);
    this.registerEntity({ id, name, x: tileX, y: tileY, isNPC: true });
  }

  // -----------------------------------------------------------------------
  // Server event handlers
  // -----------------------------------------------------------------------

  private setupServerEvents(): void {
    const socket = getSocket();
    const store = useGameStore.getState;
    const myId = store().playerId;

    // --- player.appeared → spawn remote player ---
    socket.on("player.appeared", (data: {
      id: string; name: string; avatar: string; x: number; y: number;
    }) => {
      if (data.id === myId) return; // skip self
      if (this.remotePlayers.has(data.id)) return; // already spawned

      const rp = new RemotePlayer(this, data.id, data.name, data.avatar, data.x, data.y);
      this.remotePlayers.set(data.id, rp);
      this.registerEntity({
        id: data.id,
        name: data.name,
        x: Math.round(data.x),
        y: Math.round(data.y),
        isNPC: false,
      });
    });

    // --- player.moved → update remote player target ---
    socket.on("player.moved", (data: {
      id: string; x: number; y: number;
    }) => {
      if (data.id === myId) return;
      const rp = this.remotePlayers.get(data.id);
      if (!rp) return;

      rp.setTarget(data.x, data.y);

      // Update registry coords for proximity detection
      const entity = this.entities.get(data.id);
      if (entity) {
        entity.x = Math.round(data.x);
        entity.y = Math.round(data.y);
      }
    });

    // --- player.left → remove remote player ---
    socket.on("player.left", (data: { id: string }) => {
      const rp = this.remotePlayers.get(data.id);
      if (rp) {
        rp.destroy();
        this.remotePlayers.delete(data.id);
      }
      this.unregisterEntity(data.id);
    });

    // --- zone.players → initial snapshot of nearby players ---
    socket.on("zone.players", (data: {
      players: Array<{ id: string; name: string; avatar: string; x: number; y: number }>;
    }) => {
      if (!Array.isArray(data?.players)) return;

      for (const p of data.players) {
        if (p.id === myId) continue;
        if (this.remotePlayers.has(p.id)) continue;

        const rp = new RemotePlayer(this, p.id, p.name, p.avatar, p.x, p.y);
        this.remotePlayers.set(p.id, rp);
        this.registerEntity({
          id: p.id,
          name: p.name,
          x: Math.round(p.x),
          y: Math.round(p.y),
          isNPC: false,
        });
      }

      // Update HUD online count
      store().setOnlineCount(this.remotePlayers.size + 1); // +1 for self
    });

    // --- zone.npcs → NPCs in this zone (replaces test NPCs) ---
    socket.on("zone.npcs", (data: {
      npcs: Array<{ id: string; name: string; avatar: string; x: number; y: number; description: string }>;
    }) => {
      if (!Array.isArray(data?.npcs) || data.npcs.length === 0) return;

      // Clear test NPCs on first server response
      if (!this.serverNpcSeeded) {
        this.clearTestNpcs();
        this.serverNpcSeeded = true;
      }

      for (const npcData of data.npcs) {
        this.spawnNpc(
          npcData.id,
          npcData.name,
          npcData.avatar,
          npcData.x,
          npcData.y,
          npcData.description || "",
        );
      }
    });

    // --- player.joined (echoed to self → update online count) ---
    socket.on("player.joined", () => {
      store().setOnlineCount(this.remotePlayers.size + 1);
    });

    // --- chat.receive → show bubble above sender ---
    socket.on("chat.receive", (data: {
      from: string; fromName: string; text: string;
    }) => {
      const px = this.getEntityPixelXY(data.from);
      this.showBubble(data.from, px.x, px.y, data.text, () => {
        store().setActiveChatId(data.from);
      });
    });

    // --- npc.dialogue → show bubble above NPC ---
    socket.on("npc.dialogue", (data: {
      npcId: string; npcName: string; text: string;
    }) => {
      const entity = this.entities.get(data.npcId);
      if (!entity) return;
      const px = entity.x * 32 + 16;
      const py = entity.y * 32 - 4;
      this.showBubble(data.npcId, px, py, data.text, null);
    });
  }

  /** Remove test NPCs (called when server NPC data arrives). */
  private clearTestNpcs(): void {
    for (const npc of this.npcs) {
      this.unregisterEntity(npc.id);
      npc.destroy();
    }
    this.npcs = [];
  }

  /** Process zone data that arrived before GameScene was ready. */
  private consumeZoneBuffer(): void {
    const buffer = consumeZoneBuffer();
    if (!buffer) return;

    const store = useGameStore.getState;
    const myId = store().playerId;

    // Process buffered players
    if (buffer.players.length > 0) {
      for (const p of buffer.players) {
        if (p.id === myId) continue;
        if (this.remotePlayers.has(p.id)) continue;

        const rp = new RemotePlayer(this, p.id, p.name, p.avatar, p.x, p.y);
        this.remotePlayers.set(p.id, rp);
        this.registerEntity({
          id: p.id,
          name: p.name,
          x: Math.round(p.x),
          y: Math.round(p.y),
          isNPC: false,
        });
      }
      store().setOnlineCount(this.remotePlayers.size + 1);
    }

    // Process buffered NPCs
    if (buffer.npcs.length > 0) {
      if (!this.serverNpcSeeded) {
        this.clearTestNpcs();
        this.serverNpcSeeded = true;
      }
      for (const npcData of buffer.npcs) {
        this.spawnNpc(
          npcData.id,
          npcData.name,
          npcData.avatar,
          npcData.x,
          npcData.y,
          npcData.description || "",
        );
      }
    }
  }

  // -----------------------------------------------------------------------
  // Send player.move to server
  // -----------------------------------------------------------------------

  private sendMoveToServer(time: number): void {
    if (time - this.lastMoveSend < MOVE_SEND_INTERVAL) return;
    this.lastMoveSend = time;

    const socket = getSocket();
    if (!socket.connected) return;

    const body = this.localPlayer.sprite.body as Phaser.Physics.Arcade.Body | null;
    const moving = body ? Math.abs(body.velocity.x) > 1 || Math.abs(body.velocity.y) > 1 : false;

    socket.emit("player.move", {
      // pixel → tile (fractional). Tile centre = integer tile coord.
      x: (this.localPlayer.sprite.x - 16) / 32,
      y: (this.localPlayer.sprite.y - 16) / 32,
      direction: this.localPlayer.direction,
      moving,
    });
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
    this.promptKey = this.add
      .sprite(0, 0, "ui-key")
      .setOrigin(0.5, 1)
      .setDepth(99)
      .setScale(this.PROMPT_SCALE)
      .setVisible(false);
  }

  private showPrompt(entity: MapEntity): void {
    const px = entity.x * 32 + 16;
    const py = entity.y * 32 - 4;
    this.promptKey.setPosition(px, py - 4).setVisible(true);
  }

  private hidePrompt(): void {
    this.promptKey.setVisible(false);
  }

  private updatePromptPosition(): void {
    if (!this.closestTargetId) return;
    const entity = this.entities.get(this.closestTargetId);
    if (!entity) { this.hidePrompt(); return; }
    const px = entity.x * 32 + 16;
    const py = entity.y * 32 - 4;
    this.promptKey.setPosition(px, py - 4);
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
  // Chat bubbles
  // -----------------------------------------------------------------------

  /** Create or replace a chat bubble above an entity. */
  private showBubble(
    entityId: string,
    worldX: number,
    worldY: number,
    text: string,
    onClick: (() => void) | null,
  ): void {
    const existing = this.bubbles.get(entityId);
    if (existing) {
      existing.container.destroy();
      this.bubbles.delete(entityId);
    }

    const truncated = text.length > BUBBLE_MAX_CHARS
      ? text.slice(0, BUBBLE_MAX_CHARS) + "…"
      : text;

    const scale = 0.4;
    const bg = this.add.sprite(0, 0, "ui-bubble")
      .setOrigin(0.5, 0.5)
      .setScale(scale);

    const label = this.add.text(0, -2, truncated, {
      fontSize: "36px",
      color: "#2b2b32",
      fontFamily: "monospace",
      wordWrap: { width: bg.displayWidth - 18 },
    }).setOrigin(0.5, 0.5);

    const container = this.add.container(worldX, worldY - 26, [bg, label]);
    container.setDepth(95);

    if (onClick) {
      const hitZone = this.add
        .zone(0, 0, bg.displayWidth, bg.displayHeight)
        .setInteractive({ useHandCursor: true });
      hitZone.on("pointerdown", onClick);
      container.add(hitZone);
    }

    this.bubbles.set(entityId, {
      container,
      bg: undefined as unknown as Phaser.GameObjects.Graphics,
      text: label,
      entityId,
      createdAt: this.time.now,
      onClick,
    });
  }

  /** Update all active bubbles: follow entities, fade old ones. */
  private updateBubbles(time: number): void {
    for (const [key, bubble] of this.bubbles) {
      const age = time - bubble.createdAt;

      // Fade out in last 2 seconds
      if (age > BUBBLE_DURATION - BUBBLE_FADE_START) {
        const alpha = Phaser.Math.Clamp(
          (BUBBLE_DURATION - age) / BUBBLE_FADE_START,
          0,
          1,
        );
        bubble.container.setAlpha(alpha);
      }

      // Remove expired
      if (age > BUBBLE_DURATION) {
        bubble.container.destroy();
        this.bubbles.delete(key);
        continue;
      }

      // Follow entity
      const px = this.getEntityPixelXY(key);
      bubble.container.setPosition(px.x, px.y - 20);
    }
  }

  /** Get the pixel position of an entity by its ID. */
  private getEntityPixelXY(entityId: string): { x: number; y: number } {
    // Check local player
    if (entityId === useGameStore.getState().playerId) {
      return { x: this.localPlayer.sprite.x, y: this.localPlayer.sprite.y };
    }

    // Check remote players for precise sub-tile position
    const rp = this.remotePlayers.get(entityId);
    if (rp) {
      return { x: rp.sprite.x, y: rp.sprite.y };
    }

    // Check entities registry (NPCs, etc.)
    const entity = this.entities.get(entityId);
    if (entity) {
      return { x: entity.x * 32 + 16, y: entity.y * 32 + 16 };
    }

    return { x: 0, y: 0 };
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
  // Zoom
  // -----------------------------------------------------------------------

  /** Min/max camera zoom levels. */
  private static readonly ZOOM_MIN = 0.15;
  private static readonly ZOOM_MAX = 2;

  private setupZoom(): void {
    this.input.on("wheel", (_pointer: Phaser.Input.Pointer, _gx: never[], _goy: never[], _dx: number, dy: number) => {
      const newZoom = Phaser.Math.Clamp(
        this.cameras.main.zoom - dy * 0.001,
        GameScene.ZOOM_MIN,
        GameScene.ZOOM_MAX,
      );
      this.cameras.main.setZoom(newZoom);
    });
  }

  // -----------------------------------------------------------------------
  // Focus entity (friend click)
  // -----------------------------------------------------------------------

  /** Smoothly pan camera to an entity. */
  private flyToEntity(id: string): void {
    const entity = this.entities.get(id);
    if (!entity) return;

    const targetPx = entity.x * 32 + 16;
    const targetPy = entity.y * 32 + 16;

    // Tween camera scroll position
    this.cameras.main.pan(targetPx, targetPy, 600, "Cubic.easeInOut");
  }

  // -----------------------------------------------------------------------
  // Resize
  // -----------------------------------------------------------------------

  private handleResize = (): void => {
    const { width, height } = this.scale;
    this.cameras.main.setSize(width, height);
  };
}
