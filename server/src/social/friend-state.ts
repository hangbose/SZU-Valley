// ============================================================
// A2 · 好友状态机 · Friend Request State Machine
// ============================================================
//
// 好友请求的三态流转：pending → accepted / rejected
// Friend request state transitions: pending → accepted / rejected
//
// 业务规则 · Business rules:
//   - 不能重复发送好友请求（已有 pending 时拒绝）
//   - 已是好友时拒绝
//   - 不能给自己发好友请求

import type { DataStore } from "../db/store.js";
import type { FriendRequest } from "../types.js";

/** 发送请求的条件检查结果 */
interface CheckResult {
  ok: boolean;
  reason?: string;
}

/**
 * 检查是否可以发送好友请求。
 * Check if a friend request can be sent.
 */
export function canSendRequest(
  senderId: string,
  targetId: string,
  store: DataStore
): CheckResult {
  if (senderId === targetId) {
    return { ok: false, reason: "不能加自己为好友" };
  }

  if (store.isFriend(senderId, targetId)) {
    return { ok: false, reason: "你们已经是好友了" };
  }

  const existing = store.findPendingRequest(senderId, targetId);
  if (existing) {
    return { ok: false, reason: "你已经发过好友请求了，等对方回应吧" };
  }

  return { ok: true };
}

/**
 * 创建好友请求。
 * Create a friend request (assumes canSendRequest already passed).
 */
export function createRequest(
  from: string,
  to: string,
  store: DataStore
): FriendRequest {
  return store.createFriendRequest(from, to);
}

/**
 * 接受好友请求。
 * Accept a friend request.
 *
 * 规则：请求必须是 pending 状态，且接收者匹配。
 */
export function acceptRequest(
  accepterId: string,
  fromId: string,
  store: DataStore
): { ok: boolean; reason?: string } {
  // 查找 from→accepter 的 pending 请求
  const req = store.findPendingRequest(fromId, accepterId);
  if (!req) {
    return { ok: false, reason: "没有找到待处理的好友请求" };
  }

  // 已在 acceptRequest 中做了前置校验，这里直接执行
  store.updateRequestStatus(req.id, "accepted");
  store.addFriendship(fromId, accepterId);

  return { ok: true };
}

/**
 * 拒绝好友请求。
 * Reject a friend request.
 */
export function rejectRequest(
  rejecterId: string,
  fromId: string,
  store: DataStore
): { ok: boolean; reason?: string } {
  const req = store.findPendingRequest(fromId, rejecterId);
  if (!req) {
    return { ok: false, reason: "没有找到待处理的好友请求" };
  }

  store.updateRequestStatus(req.id, "rejected");
  return { ok: true };
}
