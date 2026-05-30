// ============================================================
// A2 · 聊天处理器 · Chat Handler
// ============================================================
//
// 处理 chat.send 和 chat.history 事件。
// Handles chat.send and chat.history events.
//
// 流程 · Flow:
//   chat.send → 找发送者 → 自聊守卫 → 频率限制 → 距离检查 → 持久化 → 投递
//   chat.history → 分页查询历史消息（含离线玩家名称回退）

import type { Socket } from "socket.io";
import type { ZoneManager } from "../zone-manager.js";
import type { DataStore } from "../db/store.js";
import { CHAT_RATE_LIMIT, INTERACTION_RANGE, CHAT_MAX_LENGTH } from "../types.js";

/**
 * 处理 chat.send 事件 · Handle chat.send event.
 *
 * 约束 · Constraints:
 *   - 不能给自己发消息
 *   - 频率限制 5条/秒（按秒 bucket）
 *   - 距离 ≤ 3 格（曼哈顿）
 *   - 消息 1-500 字符
 */
export function handleChatSend(
  socket: Socket,
  data: { to: string; text: string },
  zoneManager: ZoneManager,
  store: DataStore
): void {
  const now = Date.now();

  // 0. 空值保护 · Null guard
  if (!data || typeof data.to !== "string" || typeof data.text !== "string") {
    socket.emit("error", {
      code: "INVALID_MOVE",
      message: "无效的聊天请求",
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

  // 2. 不能自聊 · No self-chat
  if (data.to === senderId) {
    socket.emit("error", {
      code: "INVALID_MOVE",
      message: "不能给自己发消息",
    });
    return;
  }

  // 3. 检查接收者是否存在（好友允许离线消息）· Check target (friends get offline delivery)
  const target = zoneManager.getPlayer(data.to);
  const isFriend = store.isFriend(senderId, data.to);
  if (!target) {
    // 未在 ZoneManager 中找到：检查是否为好友
    if (!isFriend) {
      socket.emit("error", {
        code: "PLAYER_NOT_FOUND",
        message: "找不到该玩家",
      });
      return;
    }
    // 好友离线：持久化消息，回显确认但不投递
    const text1 = (data.text ?? "").trim();
    const msg1 = store.saveMessage(senderId, data.to, text1);
    socket.emit("chat.receive", {
      from: senderId,
      fromName: sender.name,
      text: text1,
      timestamp: msg1.timestamp,
    });
    return;
  }

  // 4. 频率限制（5条/秒，按秒 bucket）· Rate limit (5/sec, per-second bucket)
  const currentSecond = Math.floor(now / 1000);
  const lastSecond = socket.data.lastChatSecond ?? 0;

  if (currentSecond === lastSecond) {
    socket.data.chatCount = (socket.data.chatCount ?? 0) + 1;
    if (socket.data.chatCount > CHAT_RATE_LIMIT) {
      socket.emit("error", {
        code: "RATE_LIMITED",
        message: "说话太快了，等一下再发",
      });
      return;
    }
  } else {
    socket.data.lastChatSecond = currentSecond;
    socket.data.chatCount = 1;
  }

  // 5. 距离检查（曼哈顿 ≤ 3 格，好友豁免）· Distance check (friends exempt)
  if (!isFriend) {
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
        message: "离太远了，走近一点再聊天吧",
      });
      return;
    }
  }

  // 6. 文本校验（1-500 字符）· Validate text
  const text = (data.text ?? "").trim();
  if (text.length === 0) {
    socket.emit("error", {
      code: "INVALID_MOVE",
      message: "不能发送空消息",
    });
    return;
  }
  if (text.length > CHAT_MAX_LENGTH) {
    socket.emit("error", {
      code: "INVALID_MOVE",
      message: `消息不能超过 ${CHAT_MAX_LENGTH} 字符`,
    });
    return;
  }

  // 7. 持久化 · Persist to store
  const msg = store.saveMessage(senderId, data.to, text);

  // 8. 投递给接收者 · Deliver to recipient
  const targetSocket = zoneManager.getPlayerSocket(data.to);
  if (targetSocket) {
    targetSocket.emit("chat.receive", {
      from: senderId,
      fromName: sender.name,
      text: text,
      timestamp: msg.timestamp,
    });
  }

  // 9. 回显给发送者（确认消息已送达）· Echo to sender
  socket.emit("chat.receive", {
    from: senderId,
    fromName: sender.name,
    text: text,
    timestamp: msg.timestamp,
  });
}

/**
 * 处理 chat.history 事件 · Handle chat.history event.
 *
 * 注意：离线玩家的名称从 store 回退读取（ZoneManager 只持有在线玩家）。
 * Note: Offline player names fall back to store (ZoneManager only holds online players).
 */
export function handleChatHistory(
  socket: Socket,
  data: { with: string; before?: number },
  zoneManager: ZoneManager,
  store: DataStore
): void {
  const senderId = zoneManager.getPlayerIdBySocket(socket.id);
  if (!senderId) {
    socket.emit("error", {
      code: "PLAYER_NOT_FOUND",
      message: "你还未加入游戏",
    });
    return;
  }

  if (!data.with) {
    socket.emit("error", {
      code: "PLAYER_NOT_FOUND",
      message: "请指定要查看的玩家",
    });
    return;
  }

  const result = store.getChatHistory(senderId, data.with, data.before);

  socket.emit("chat.history", {
    with: data.with,
    messages: result.messages.map((m) => ({
      from: m.from,
      fromName: resolveName(m.from, zoneManager, store),
      text: m.text,
      timestamp: m.timestamp,
    })),
    hasMore: result.hasMore,
  });
}

/**
 * 解析玩家显示名（在线→ZoneManager，离线→Store 回退）。
 * Resolve a player's display name (online→ZoneManager, offline→Store fallback).
 */
function resolveName(
  playerId: string,
  zoneManager: ZoneManager,
  store: DataStore
): string {
  // 优先从 ZoneManager 获取（在线玩家）
  const online = zoneManager.getPlayer(playerId);
  if (online) return online.name;

  // 回退到 Store（离线玩家资料）
  const profile = store.getPlayer(playerId);
  if (profile) return profile.name;

  return "?";
}
