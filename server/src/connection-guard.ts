// ============================================================
// A1 · 连接守卫 · Connection Guard
// ============================================================
//
// "看门人"——在玩家加入之前检查两件事：
// The "bouncer" — checks two things before letting a player in:
//   1. 服务器是否已满 (50 人上限) · Is the server full? (50 cap)
//   2. 名字是否已被占用 · Is the name already taken?

import { RedisClient } from "./redis.js";
import { ZoneManager } from "./zone-manager.js";
import { MAX_PLAYERS } from "./types.js";

export class ConnectionGuard {
  constructor(
    private redis: RedisClient,
    private zoneManager: ZoneManager
  ) {}

  /**
   * 检查是否允许加入。
   * 返回 null = 允许；返回 ErrorResponse = 拒绝。
   *
   * Check if join is allowed.
   * Returns null = allowed; ErrorResponse = rejected.
   */
  async checkJoinAllowed(
    name: string
  ): Promise<{ code: string; message: string } | null> {
    // 1. 检查服务器容量 · Check server capacity
    const count = await this.redis.getOnlineCount();
    if (count >= MAX_PLAYERS) {
      return {
        code: "SERVER_FULL",
        message: "服务器已满，请稍后再试",
      };
    }

    // 2. 检查名字唯一性 · Check name uniqueness
    //    遍历当前在线玩家，看有没有重名
    const allPlayers = this.zoneManager.getAllPlayers();
    const nameTaken = allPlayers.some((p) => p.name === name);
    if (nameTaken) {
      return {
        code: "NAME_TAKEN",
        message: "这个名字已被使用，换一个吧",
      };
    }

    return null; // 允许加入 · Allowed
  }

  /**
   * 验证名字格式 · Validate name format.
   * 2-12 字符，不能全是空格。
   */
  static validateName(name: string): {
    valid: boolean;
    message?: string;
  } {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      return { valid: false, message: "名字不能为空" };
    }
    if (trimmed.length < 2) {
      return { valid: false, message: "名字至少需要 2 个字符" };
    }
    if (trimmed.length > 12) {
      return { valid: false, message: "名字不能超过 12 个字符" };
    }
    return { valid: true };
  }
}
