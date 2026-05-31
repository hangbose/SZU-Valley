// ============================================================
// A2 · 加入处理器 · Join Handler
// ============================================================
//
// 处理 player.join 事件：名字校验、头像校验、分配 ID/出生点、
// 注册 Zone Manager → 写入存储 → Redis → 广播。
//
// Handles player.join: name + avatar validation, assign ID/spawn,
// register with Zone Manager → write to store → Redis → broadcast.
//
// 注意：ZoneManager 先注册，Store 后写入——如果 ZoneManager 注册失败，
// Store 不会留下孤儿记录。
// Note: ZoneManager registered first, Store written after — if ZoneManager
// fails, no orphaned profile remains in Store.

import type { Socket } from "socket.io";
import type { RedisClient } from "../redis.js";
import { ZoneManager, getZoneForPosition, getZoneNeighbors } from "../zone-manager.js";
import { ConnectionGuard } from "../connection-guard.js";
import { sendZoneSnapshot } from "./movement.js";
import type { DataStore } from "../db/store.js";
import type { JoinData, NPC } from "../types.js";

/** 有效头像列表（协议: avatar_01 ~ avatar_08）· Valid avatar presets */
const VALID_AVATARS = new Set([
  "avatar_01", "avatar_02", "avatar_03", "avatar_04",
  "avatar_05", "avatar_06", "avatar_07", "avatar_08",
]);

export async function handleJoin(
  socket: Socket,
  data: JoinData,
  zoneManager: ZoneManager,
  redis: RedisClient,
  connectionGuard: ConnectionGuard,
  store: DataStore,
  npcs: NPC[]
): Promise<void> {
  try {
    // 0. 空值保护 · Null guard
    if (!data || typeof data.name !== "string") {
      socket.emit("error", {
        code: "INVALID_NAME",
        message: "请提供有效的名字",
      });
      return;
    }

    // 1. 验证名字格式 · Validate name format
    const nameCheck = ConnectionGuard.validateName(data.name);
    if (!nameCheck.valid) {
      socket.emit("error", {
        code: "INVALID_NAME",
        message: nameCheck.message,
      });
      return;
    }

    // 2. 验证头像 · Validate avatar
    const avatar = (data.avatar ?? "").trim();
    if (!VALID_AVATARS.has(avatar)) {
      socket.emit("error", {
        code: "INVALID_NAME",
        message: "请选择一个有效的头像",
      });
      return;
    }

    // 3. 连接守卫检查 · Connection guard (capacity + uniqueness)
    const guardResult = await connectionGuard.checkJoinAllowed(
      data.name.trim()
    );
    if (guardResult) {
      socket.emit("error", guardResult);
      setTimeout(() => socket.disconnect(), 1000);
      return;
    }

    // 检查 await 后 socket 是否还在 · Check socket is still connected after await
    if (!socket.connected) {
      return;
    }

    // 4. 分配 ID（方案 A：支持 localStorage 持久化身份）
    //    Use persisted playerId if available, otherwise generate new
    const name = data.name.trim();
    const persistedId = data.playerId?.trim();
    let playerId: string;

    if (persistedId && store.getPlayer(persistedId)) {
      // 回头客：复用旧 ID，更新名字和头像
      playerId = persistedId;
      store.updatePlayer(playerId, name, avatar);
      console.log(`[join] Returning player "${name}" (${playerId})`);
    } else if (persistedId) {
      // 客户端有 ID 但服务器不认识（重启后数据丢失）：用此 ID 新建
      playerId = persistedId;
    } else {
      // 新玩家
      playerId = crypto.randomUUID();
    }

    const spawn = { x: 100, y: 75 };

    // 5. 先注册到 Zone Manager（失败不会留下 Store 孤儿记录）
    const player = zoneManager.registerPlayer(
      socket,
      playerId,
      name,
      avatar,
      spawn.x,
      spawn.y
    );

    // 6. 写/更新数据存储 (A2) · Write or update store
    if (!store.getPlayer(playerId)) {
      store.createPlayer(playerId, name, avatar);
    }

    // 6b. 保存标签（自由文本，去重去空）· Save tags (free text, dedupe + trim)
    if (Array.isArray(data.tags)) {
      const cleanTags = [...new Set(
        data.tags.map((t: string) => (t ?? "").trim()).filter((t: string) => t.length > 0)
      )].slice(0, 10); // 最多 10 个标签
      if (cleanTags.length > 0) {
        store.setTags(playerId, cleanTags);
      }
    }

    // 7. 更新 Redis (A1) · Update Redis
    await redis.addOnlinePlayer(playerId);
    await redis.setPosition(playerId, spawn.x, spawn.y);

    // 8. 构建好友列表（含在线状态，供客户端恢复 UI）
    const friendIds = store.getFriends(playerId);
    const friends = friendIds.map((fid) => {
      const profile = store.getPlayer(fid);
      const online = zoneManager.isOnline(fid);
      return {
        id: fid,
        name: profile?.name ?? "?",
        avatar: profile?.avatar ?? "",
        isOnline: online,
      };
    });

    // 9. 发送加入确认（只发给加入者自己）
    socket.emit("player.joined", {
      playerId,
      spawn: { x: spawn.x, y: spawn.y },
      friends,
    });

    // 10. 发送区域快照（附近的玩家和 NPC，含 isFriend 信息）
    const zoneId = getZoneForPosition(spawn.x, spawn.y);
    const neighborZones = getZoneNeighbors(zoneId);
    sendZoneSnapshot(socket, neighborZones, zoneManager, playerId, store, npcs);

    // 11. 广播"新玩家出现"给区域内的其他人
    for (const z of neighborZones) {
      socket.to(`zone:${z}`).emit("player.appeared", {
        id: playerId,
        name: player.name,
        avatar: player.avatar,
        x: spawn.x,
        y: spawn.y,
      });
    }

    console.log(
      `[join] Player "${player.name}" (${playerId}) joined at (${spawn.x}, ${spawn.y})`
    );
  } catch (err) {
    console.error("[join] Unexpected error:", err);
    socket.emit("error", {
      code: "SERVER_FULL",
      message: "服务器内部错误，请稍后重试",
    });
  }
}
