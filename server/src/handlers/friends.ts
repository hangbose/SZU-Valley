// ============================================================
// A2 · 好友处理器 · Friend Handler
// ============================================================
//
// 处理 friend.request / friend.accept / friend.reject 事件。
// Handles friend.request / friend.accept / friend.reject events.
//
// 流程 · Flow:
//   friend.request → 找发送者 → 频率限制 → 距离检查 → 业务校验 → 创建请求 → 通知目标
//   friend.accept  → 找接收者 → 状态机校验 → 建立好友关系 → 通知双方
//   friend.reject  → 找接收者 → 状态机校验 → 标记拒绝

import type { Socket } from "socket.io";
import type { ZoneManager } from "../zone-manager.js";
import type { DataStore } from "../db/store.js";
import { FRIEND_RATE_LIMIT, INTERACTION_RANGE } from "../types.js";
import {
  canSendRequest,
  createRequest,
  acceptRequest,
  rejectRequest,
} from "../social/friend-state.js";

/**
 * 处理 friend.request 事件 · Handle friend.request event.
 */
export function handleFriendRequest(
  socket: Socket,
  data: { to: string },
  zoneManager: ZoneManager,
  store: DataStore
): void {
  const now = Date.now();

  // 0. 空值保护 · Null guard
  if (!data || typeof data.to !== "string") {
    socket.emit("error", {
      code: "PLAYER_NOT_FOUND",
      message: "请指定要添加的玩家",
    });
    return;
  }

  // 1. 找发送者 · Find the sender
  const senderId = zoneManager.getPlayerIdBySocket(socket.id);
  if (!senderId) {
    socket.emit("error", {
      code: "PLAYER_NOT_FOUND",
      message: "你还未加入游戏",
    });
    return;
  }

  const sender = zoneManager.getPlayer(senderId);
  if (!sender) {
    socket.emit("error", {
      code: "PLAYER_NOT_FOUND",
      message: "找不到你的角色信息",
    });
    return;
  }

  // 2. 检查目标存在 · Check target exists
  const target = zoneManager.getPlayer(data.to);
  if (!target) {
    socket.emit("error", {
      code: "PLAYER_NOT_FOUND",
      message: "找不到该玩家",
    });
    return;
  }

  // 3. 频率限制（10条/分钟，滑动窗口）· Rate limit (10/min, sliding window)
  const oneMinuteAgo = now - 60000;
  const timestamps: number[] = socket.data.friendRequestTimestamps ?? [];
  // 清理过期记录 · Clean expired entries
  const recent = timestamps.filter((t) => t > oneMinuteAgo);
  if (recent.length >= FRIEND_RATE_LIMIT) {
    socket.emit("error", {
      code: "RATE_LIMITED",
      message: "好友请求太频繁了，等一下再试",
    });
    return;
  }
  recent.push(now);
  socket.data.friendRequestTimestamps = recent;

  // 4. 距离检查（曼哈顿 ≤ 3 格）· Distance check
  const senderPos = zoneManager.getPlayerPosition(senderId);
  const targetPos = zoneManager.getPlayerPosition(data.to);

  if (!senderPos || !targetPos) {
    socket.emit("error", {
      code: "OUT_OF_RANGE",
      message: "无法获取位置信息",
    });
    return;
  }

  const dist =
    Math.abs(senderPos.x - targetPos.x) +
    Math.abs(senderPos.y - targetPos.y);

  if (dist > INTERACTION_RANGE) {
    socket.emit("error", {
      code: "OUT_OF_RANGE",
      message: "离太远了，走近一点再加好友吧",
    });
    return;
  }

  // 5. 业务校验 · Business validation
  const check = canSendRequest(senderId, data.to, store);
  if (!check.ok) {
    socket.emit("error", {
      code: "ALREADY_FRIENDS",
      message: check.reason ?? "无法发送好友请求",
    });
    return;
  }

  // 6. 创建请求 · Create the request
  createRequest(senderId, data.to, store);

  // 7. 通知目标 · Notify the target
  const targetSocket = zoneManager.getPlayerSocket(data.to);
  if (targetSocket) {
    targetSocket.emit("friend.requested", {
      from: senderId,
      fromName: sender.name,
    });
  }

  console.log(
    `[friend] ${sender.name} sent friend request to ${target.name}`
  );
}

/**
 * 处理 friend.accept 事件 · Handle friend.accept event.
 */
export function handleFriendAccept(
  socket: Socket,
  data: { from: string },
  zoneManager: ZoneManager,
  store: DataStore
): void {
  // 0. 空值保护 · Null guard
  if (!data || typeof data.from !== "string") {
    socket.emit("error", {
      code: "REQUEST_NOT_FOUND",
      message: "请指定要接受的好友请求",
    });
    return;
  }

  // 1. 找接收者 · Find the accepter
  const accepterId = zoneManager.getPlayerIdBySocket(socket.id);
  if (!accepterId) {
    socket.emit("error", {
      code: "PLAYER_NOT_FOUND",
      message: "你还未加入游戏",
    });
    return;
  }

  const accepter = zoneManager.getPlayer(accepterId);
  if (!accepter) {
    socket.emit("error", {
      code: "PLAYER_NOT_FOUND",
      message: "找不到你的角色信息",
    });
    return;
  }

  // 2. 执行接受 · Execute accept
  const result = acceptRequest(accepterId, data.from, store);
  if (!result.ok) {
    socket.emit("error", {
      code: "REQUEST_NOT_FOUND",
      message: result.reason ?? "无法接受好友请求",
    });
    return;
  }

  // 3. 通知请求发起者 · Notify the requester
  const requesterSocket = zoneManager.getPlayerSocket(data.from);
  if (requesterSocket) {
    requesterSocket.emit("friend.accepted", {
      by: accepterId,
      byName: accepter.name,
    });
  }

  // 4. 同时通知接受者自己（确认）· Also notify the accepter
  socket.emit("friend.accepted", {
    by: accepterId,
    byName: accepter.name,
  });

  console.log(
    `[friend] ${accepter.name} accepted request from ${data.from}`
  );
}

/**
 * 处理 friend.reject 事件 · Handle friend.reject event.
 */
export function handleFriendReject(
  socket: Socket,
  data: { from: string },
  zoneManager: ZoneManager,
  store: DataStore
): void {
  // 0. 空值保护 · Null guard
  if (!data || typeof data.from !== "string") {
    socket.emit("error", {
      code: "REQUEST_NOT_FOUND",
      message: "请指定要拒绝的好友请求",
    });
    return;
  }

  // 1. 找拒绝者 · Find the rejecter
  const rejecterId = zoneManager.getPlayerIdBySocket(socket.id);
  if (!rejecterId) {
    socket.emit("error", {
      code: "PLAYER_NOT_FOUND",
      message: "你还未加入游戏",
    });
    return;
  }

  // 2. 执行拒绝 · Execute reject
  const result = rejectRequest(rejecterId, data.from, store);
  if (!result.ok) {
    socket.emit("error", {
      code: "REQUEST_NOT_FOUND",
      message: result.reason ?? "没有可拒绝的好友请求",
    });
    return;
  }

  console.log(
    `[friend] ${rejecterId} rejected request from ${data.from}`
  );
}
