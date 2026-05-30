// ============================================================
// A2 · 资料查看处理器 · Profile View Handler
// ============================================================
//
// 处理 profile.view 事件——查看附近玩家公开资料。
// Handles profile.view — view a nearby player's public profile.
// tags 和 friendsCount 从 store 读取真实数据，isOnline 从 ZoneManager 获取。

import type { Socket } from "socket.io";
import type { ZoneManager } from "../zone-manager.js";
import type { DataStore } from "../db/store.js";
import { INTERACTION_RANGE } from "../types.js";

/**
 * 处理 profile.view 事件 · Handle profile.view event.
 *
 * 兼容两种 payload 字段名（向后兼容 A1 测试 + 协议规范）：
 * Accepts both `id` (A1 test) and `playerId` (protocol spec).
 */
export function handleProfileView(
  socket: Socket,
  data: { id?: string; playerId?: string },
  zoneManager: ZoneManager,
  store: DataStore
): void {
  const requesterId = zoneManager.getPlayerIdBySocket(socket.id);
  if (!requesterId) {
    socket.emit("error", {
      code: "PLAYER_NOT_FOUND",
      message: "你还未加入游戏",
    });
    return;
  }

  const requester = zoneManager.getPlayer(requesterId);
  if (!requester) {
    socket.emit("error", {
      code: "PLAYER_NOT_FOUND",
      message: "找不到你的角色信息",
    });
    return;
  }

  // 兼容 `id`（A1 测试）和 `playerId`（协议规范）
  const targetId = data.id || data.playerId;
  if (!targetId) {
    socket.emit("error", {
      code: "PLAYER_NOT_FOUND",
      message: "请指定要查看的玩家",
    });
    return;
  }

  const target = zoneManager.getPlayer(targetId);
  if (!target) {
    socket.emit("error", {
      code: "PLAYER_NOT_FOUND",
      message: "找不到该玩家",
    });
    return;
  }

  // 曼哈顿距离检查（必须在 3 格以内）
  const dist =
    Math.abs(requester.x - target.x) + Math.abs(requester.y - target.y);
  if (dist > INTERACTION_RANGE) {
    socket.emit("error", {
      code: "OUT_OF_RANGE",
      message: "离太远了，走近一点再看吧",
    });
    return;
  }

  // 从 store 读取真实资料 + ZoneManager 确认在线状态
  const profile = store.getPlayer(targetId);

  socket.emit("profile.view", {
    id: target.id,
    name: target.name,
    avatar: target.avatar,
    tags: profile?.tags ?? [],
    friendsCount: profile?.friendsCount ?? 0,
    isOnline: zoneManager.isOnline(targetId),
  });
}
