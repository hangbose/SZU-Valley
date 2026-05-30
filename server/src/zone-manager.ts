// ============================================================
// A1 · 区域管理器 · Zone Manager (THE CORE)
// ============================================================
//
// 这是整个 A1 的心脏。它把 200×150 大地图切成 16×12 的区域，
// 跟踪每个玩家在哪个区域，管理 Socket.IO 房间订阅，
// 确保玩家只收到附近区域的更新。
//
// This is the heart of A1. It partitions the 200×150 map into 16×12
// zones, tracks which player is in which zone, manages Socket.IO room
// subscriptions, and ensures players only receive updates from nearby zones.
//
// 区域数学 · Zone Math:
//   col = floor(x / 16), row = floor(y / 12)
//   zoneId = row * 13 + col
//   每个玩家订阅自己区域 + 8 个邻居（摩尔邻域）

import type { Socket } from "socket.io";
import {
  ZONE_WIDTH,
  ZONE_HEIGHT,
  ZONES_PER_ROW,
  ZONES_PER_COL,
  TOTAL_ZONES,
  MAP_WIDTH,
  MAP_HEIGHT,
} from "./types.js";
import type {
  PlayerState,
  Direction,
  ZoneChangeResult,
} from "./types.js";

// ---- Zone Math Helpers (pure functions) ----

/** 坐标 → 区域编号 · Coordinate → Zone ID */
export function getZoneForPosition(x: number, y: number): number {
  const col = Math.floor(x / ZONE_WIDTH);
  const row = Math.floor(y / ZONE_HEIGHT);
  // 边界钳制 · Clamp to map bounds
  const clampedCol = Math.max(0, Math.min(col, ZONES_PER_ROW - 1));
  const clampedRow = Math.max(0, Math.min(row, ZONES_PER_COL - 1));
  return clampedRow * ZONES_PER_ROW + clampedCol;
}

/** 区域编号 → 列和行 · Zone ID → (col, row) */
export function zoneIdToColRow(
  zoneId: number
): { col: number; row: number } {
  return {
    col: zoneId % ZONES_PER_ROW,
    row: Math.floor(zoneId / ZONES_PER_ROW),
  };
}

/** 获取摩尔邻域区域列表（自身 + 8邻居，钳制到地图边界）· Moore neighborhood */
export function getZoneNeighbors(zoneId: number): number[] {
  const { col, row } = zoneIdToColRow(zoneId);
  const neighbors: number[] = [];

  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const nc = col + dc;
      const nr = row + dr;
      if (nc >= 0 && nc < ZONES_PER_ROW && nr >= 0 && nr < ZONES_PER_COL) {
        neighbors.push(nr * ZONES_PER_ROW + nc);
      }
    }
  }

  return neighbors;
}

/** 区域编号 → Socket.IO 房间名 · Zone ID → room name */
export function zoneRoom(zoneId: number): string {
  return `zone:${zoneId}`;
}

// ---- 出生点 · Spawn Points ----

const SPAWN_POINTS = [
  { x: 25, y: 30 },
  { x: 100, y: 75 },
  { x: 170, y: 65 },
  { x: 50, y: 100 },
  { x: 130, y: 40 },
];

let spawnIndex = 0;

export function getRandomSpawn(): { x: number; y: number } {
  const spawn = SPAWN_POINTS[spawnIndex % SPAWN_POINTS.length];
  spawnIndex++;
  return { ...spawn };
}

// ---- ZoneManager 类 ----

export class ZoneManager {
  // 区域占用：zoneId → 该区域的玩家ID集合
  // Zone occupancy: zoneId → Set of playerIds
  private zoneOccupants: Map<number, Set<string>> = new Map();

  // 玩家→区域 反向索引 · Reverse index: playerId → zoneId
  private playerZone: Map<string, number> = new Map();

  // 玩家完整状态 · Full player state: playerId → PlayerState
  private players: Map<string, PlayerState> = new Map();

  // 玩家订阅：playerId → 已订阅的区域ID集合
  // Player subscriptions: playerId → Set of subscribed zoneIds
  private playerSubscriptions: Map<string, Set<number>> = new Map();

  // Socket → Player 双向映射 · Bidirectional socket→player mapping
  private socketToPlayer: Map<string, string> = new Map();
  private playerToSocket: Map<string, Socket> = new Map();

  constructor() {
    // 预初始化所有区域 · Pre-initialize all zones
    for (let i = 0; i < TOTAL_ZONES; i++) {
      this.zoneOccupants.set(i, new Set());
    }
  }

  // =========================================================
  // 注册玩家 · Register Player
  // =========================================================

  /**
   * 注册新玩家：创建记录、分配区域、订阅房间。
   * Register a new player: create record, assign zone, subscribe to rooms.
   */
  registerPlayer(
    socket: Socket,
    id: string,
    name: string,
    avatar: string,
    spawnX: number,
    spawnY: number
  ): PlayerState {
    const player: PlayerState = {
      id,
      name,
      avatar,
      x: spawnX,
      y: spawnY,
      direction: "down" as Direction,
      moving: false,
      joinedAt: Date.now(),
    };

    // 存入主 Map
    this.players.set(id, player);

    // 建立 socket 双向映射
    this.socketToPlayer.set(socket.id, id);
    this.playerToSocket.set(id, socket);

    // 计算初始区域
    const zoneId = getZoneForPosition(spawnX, spawnY);
    this.playerZone.set(id, zoneId);
    this.zoneOccupants.get(zoneId)!.add(id);

    // 订阅：自身区域 + 8 邻居
    const neighbors = getZoneNeighbors(zoneId);
    const subscribed = new Set<number>();
    for (const z of neighbors) {
      socket.join(zoneRoom(z));
      subscribed.add(z);
    }
    this.playerSubscriptions.set(id, subscribed);

    console.log(
      `[zone] Player ${name} (${id}) joined zone ${zoneId}, ` +
        `subscribed to [${[...subscribed].join(",")}]`
    );

    return player;
  }

  // =========================================================
  // 更新玩家位置 · Update Player Position
  // =========================================================

  /**
   * 更新玩家位置。如果跨区域，自动处理房间退订/订阅。
   * Update player position. If zone changed, handle room leave/join.
   */
  updatePlayerPosition(
    id: string,
    x: number,
    y: number,
    direction: Direction,
    moving: boolean
  ): ZoneChangeResult {
    const player = this.players.get(id);
    if (!player) {
      throw new Error(`Player ${id} not found`);
    }

    // 更新坐标
    player.x = x;
    player.y = y;
    player.direction = direction;
    player.moving = moving;

    // 计算新区域
    const oldZoneId = this.playerZone.get(id)!;
    const newZoneId = getZoneForPosition(x, y);

    // 同区域，无需切换
    if (newZoneId === oldZoneId) {
      return { zoneChanged: false, oldZone: oldZoneId, newZone: newZoneId };
    }

    // ---- 跨区域切换 · Zone Changed ----
    const socket = this.playerToSocket.get(id)!;

    // 1. 从旧区域移除
    this.zoneOccupants.get(oldZoneId)!.delete(id);

    // 2. 加入新区域
    this.zoneOccupants.get(newZoneId)!.add(id);
    this.playerZone.set(id, newZoneId);

    // 3. 计算新旧邻居集合
    const oldNeighbors = getZoneNeighbors(oldZoneId);
    const newNeighbors = getZoneNeighbors(newZoneId);

    // 4. 需要退出的房间（在旧邻居不在新邻居）
    const toLeave = oldNeighbors.filter((z) => !newNeighbors.includes(z));

    // 5. 需要加入的房间（在新邻居不在旧邻居）
    const toJoin = newNeighbors.filter((z) => !oldNeighbors.includes(z));

    // 6. 执行房间操作
    for (const z of toLeave) {
      socket.leave(zoneRoom(z));
    }
    for (const z of toJoin) {
      socket.join(zoneRoom(z));
    }

    // 7. 更新订阅记录
    this.playerSubscriptions.set(id, new Set(newNeighbors));

    console.log(
      `[zone] Player ${player.name} moved zone ${oldZoneId} → ${newZoneId}, ` +
        `leave=[${toLeave.join(",")}] join=[${toJoin.join(",")}]`
    );

    return { zoneChanged: true, oldZone: oldZoneId, newZone: newZoneId };
  }

  // =========================================================
  // 删除玩家 · Remove Player
  // =========================================================

  /**
   * 删除玩家：清理区域、退订房间、删除映射。
   * Remove a player: clean up zones, unsubscribe rooms, delete mappings.
   */
  removePlayer(id: string): { oldZone: number; player: PlayerState } | null {
    const player = this.players.get(id);
    if (!player) return null;

    const zoneId = this.playerZone.get(id);
    const socket = this.playerToSocket.get(id);

    // 清理区域占用
    if (zoneId !== undefined) {
      this.zoneOccupants.get(zoneId)?.delete(id);
      this.playerZone.delete(id);
    }

    // 退订所有房间
    if (socket) {
      const subscriptions = this.playerSubscriptions.get(id);
      if (subscriptions) {
        for (const z of subscriptions) {
          socket.leave(zoneRoom(z));
        }
      }
    }

    // 清理映射
    this.players.delete(id);
    this.playerSubscriptions.delete(id);
    this.playerToSocket.delete(id);
    if (socket) {
      this.socketToPlayer.delete(socket.id);
    }

    console.log(`[zone] Player ${player.name} (${id}) removed from zone ${zoneId}`);

    return { oldZone: zoneId ?? -1, player };
  }

  /**
   * 通过 socket ID 删除玩家 · Remove player by socket ID (used on disconnect).
   */
  removePlayerBySocket(
    socketId: string
  ): { oldZone: number; player: PlayerState } | null {
    const playerId = this.socketToPlayer.get(socketId);
    if (!playerId) return null;
    return this.removePlayer(playerId);
  }

  // =========================================================
  // 查询方法 · Query Methods
  // =========================================================

  /** 获取玩家完整信息 · Get full player info */
  getPlayer(id: string): PlayerState | undefined {
    return this.players.get(id);
  }

  /** 通过 socket ID 获取玩家 · Get player by socket ID */
  getPlayerBySocket(socketId: string): PlayerState | undefined {
    const playerId = this.socketToPlayer.get(socketId);
    if (!playerId) return undefined;
    return this.players.get(playerId);
  }

  /** 通过 socket ID 获取 playerId · Get player ID by socket ID */
  getPlayerIdBySocket(socketId: string): string | undefined {
    return this.socketToPlayer.get(socketId);
  }

  /** 获取区域内的所有玩家 · Get all players in a zone */
  getZonePlayers(zoneId: number): PlayerState[] {
    const idSet = this.zoneOccupants.get(zoneId);
    if (!idSet) return [];
    const players: PlayerState[] = [];
    for (const id of idSet) {
      const p = this.players.get(id);
      if (p) players.push(p);
    }
    return players;
  }

  /** 获取所有在线玩家 · Get all online players */
  getAllPlayers(): PlayerState[] {
    return [...this.players.values()];
  }

  /** 获取 socket 对象 · Get socket by player ID */
  getPlayerSocket(id: string): Socket | undefined {
    return this.playerToSocket.get(id);
  }

  // =========================================================
  // A1 → A2 公共接口 · Public API (called by A2 in-process)
  // =========================================================

  /** A2 用：获取玩家位置 · Get player position (for chat distance check) */
  getPlayerPosition(id: string): { x: number; y: number } | null {
    const player = this.players.get(id);
    if (!player) return null;
    return { x: player.x, y: player.y };
  }

  /** A2 用：玩家是否在线 · Is player online? */
  isOnline(id: string): boolean {
    return this.players.has(id);
  }

  /** A2 用：在线人数 · Online count */
  getOnlineCount(): number {
    return this.players.size;
  }

  /** A2 用：获取区域邻居列表 · Get zone neighbors (exposed for A2 reuse) */
  getPublicZoneNeighbors(zoneId: number): number[] {
    return getZoneNeighbors(zoneId);
  }

  /** A2 用：通过 socket ID 获取 playerId · Get playerId from socket.id */
  getPlayerId(socketId: string): string | undefined {
    return this.socketToPlayer.get(socketId);
  }
}
