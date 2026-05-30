// ============================================================
// A1 · 移动处理器 · Movement Handler (HOTTEST PATH)
// ============================================================
//
// 整个服务器被调用最频繁的函数——50 人 × 20 次/秒 = 最多 1000 次/秒。
// The most-called function in the entire server — up to 1000 calls/sec.
//
// 流程 · Flow:
//   1. 限速 (50ms 最小间隔)
//   2. 找玩家 (socket → player)
//   3. 位置校验 (防瞬移)
//   4. 更新区域 (Zone Manager, 可能触发跨区)
//   5. 写 Redis (fire-and-forget, 不 await!)
//   6. 广播给区域订阅者

import type { Socket } from "socket.io";
import { ZoneManager, getZoneNeighbors, zoneRoom } from "../zone-manager.js";
import type { RedisClient } from "../redis.js";
import { validateMove } from "../game/position-validator.js";
import { getNPCsInZones } from "./npc.js";
import { MOVE_THROTTLE_MS } from "../types.js";
import type { MoveData, PlayerState, NPC } from "../types.js";

// socket.data 是 Socket.IO v4 内置的任意数据存储。
// socket.data is a built-in arbitrary data store in Socket.IO v4.
// 我们用它来存储 lastMoveTime 和 lastTalkTime，用于限速。

/**
 * 处理 player.move 事件 · Handle player.move event.
 */
export function handleMovement(
  socket: Socket,
  data: MoveData,
  zoneManager: ZoneManager,
  redis: RedisClient,
  npcs: NPC[]
): void {
  const now = Date.now();

  // ---- 1. 限速 · Rate limit (50ms throttle) ----

  const lastTime = socket.data.lastMoveTime ?? 0;
  if (now - lastTime < MOVE_THROTTLE_MS) {
    return; // 静默丢弃 · silently drop
  }
  socket.data.lastMoveTime = now;

  // ---- 2. 找玩家 · Find the player ----

  const playerId = zoneManager.getPlayerIdBySocket(socket.id);
  if (!playerId) {
    return; // 还没 join 就发 move → 忽略
  }

  const player = zoneManager.getPlayer(playerId);
  if (!player) return;

  // ---- 3. 位置校验 · Validate the move ----

  const prevPos = zoneManager.getPlayerPosition(playerId);
  if (prevPos) {
    // 注意：使用更新前的 lastTime 计算时间差，不是刚更新过的 socket.data.lastMoveTime
    // 首次移动时 lastTime=0，给 2000ms 宽限期
    const deltaMs = lastTime === 0 ? 2000 : now - lastTime;
    const result = validateMove(
      prevPos.x,
      prevPos.y,
      data.x,
      data.y,
      deltaMs
    );
    if (!result.valid) {
      console.warn(
        `[move] Invalid move from ${player.name}: ${result.reason}`
      );
      return;
    }
  }

  // ---- 4. 更新 Zone Manager（可能跨区）· Update position (may change zones) ----

  const zoneResult = zoneManager.updatePlayerPosition(
    playerId,
    data.x,
    data.y,
    data.direction,
    data.moving
  );

  // ---- 5. 更新 Redis 位置缓存（fire-and-forget）----

  redis.setPosition(playerId, data.x, data.y).catch((err) => {
    console.error(`[redis] Failed to update position for ${playerId}:`, err);
  });

  // ---- 6. 根据 zoneChanged 发送不同事件 ----

  if (!zoneResult.zoneChanged) {
    // 同区域：仅广播 player.moved（volatile — 丢一帧无所谓）
    socket.volatile
      .to(zoneRoom(zoneResult.newZone))
      .emit("player.moved", {
        id: playerId,
        x: data.x,
        y: data.y,
        direction: data.direction,
        moving: data.moving,
      });
  } else {
    // 跨区域：需要发送 player.left + player.joined + zone snapshot
    const newNeighbors = getZoneNeighbors(zoneResult.newZone);
    const oldNeighbors = getZoneNeighbors(zoneResult.oldZone!);

    // 广播"离开"到旧邻域
    for (const z of oldNeighbors) {
      socket.to(zoneRoom(z)).emit("player.left", { id: playerId });
    }

    // 广播"出现"到新邻域
    for (const z of newNeighbors) {
      socket.to(zoneRoom(z)).emit("player.appeared", {
        id: playerId,
        name: player.name,
        avatar: player.avatar,
        x: data.x,
        y: data.y,
      });
    }

    // 给移动者本人发送新区域的快照（含 NPC 列表！）
    sendZoneSnapshot(socket, newNeighbors, zoneManager, playerId, npcs);

    // 广播 player.moved 到新区域
    socket.volatile
      .to(zoneRoom(zoneResult.newZone))
      .emit("player.moved", {
        id: playerId,
        x: data.x,
        y: data.y,
        direction: data.direction,
        moving: data.moving,
      });
  }
}

/**
 * 发送区域快照（zone.players + zone.npcs）给玩家。
 * Send zone snapshot to a player (after join or zone change).
 */
export function sendZoneSnapshot(
  socket: Socket,
  neighborZones: number[],
  zoneManager: ZoneManager,
  playerId: string,
  npcs?: NPC[]
): void {
  // 收集附近玩家（排除自己）
  const nearbyPlayers: PlayerState[] = [];
  for (const z of neighborZones) {
    nearbyPlayers.push(...zoneManager.getZonePlayers(z));
  }

  const others = nearbyPlayers
    .filter((p) => p.id !== playerId)
    .map((p) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      x: p.x,
      y: p.y,
      direction: p.direction,
      moving: p.moving,
      isFriend: false, // A2 负责填充
    }));

  socket.emit("zone.players", { players: others });

  // 发送 NPC 列表
  if (npcs && npcs.length > 0) {
    const nearbyNPCs = getNPCsInZones(neighborZones, npcs);
    socket.emit("zone.npcs", { npcs: nearbyNPCs });
  }
}
