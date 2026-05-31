// ============================================================
// A1 · 连接守卫 · Connection Guard
// ============================================================
//
// "看门人"——在玩家加入之前检查容量：
// The "bouncer" — checks capacity before letting a player in:
//   1. 服务器是否已满 (50 人上限) · Is the server full? (50 cap)
// （同名不限制——允许多设备/多标签页用同一名字登录）
// (Duplicate names allowed — multi-device / multi-tab with same name is OK)

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
    _name: string
  ): Promise<{ code: string; message: string } | null> {
    // 检查服务器容量 · Check server capacity
    const count = await this.redis.getOnlineCount();
    if (count >= MAX_PLAYERS) {
      return {
        code: "SERVER_FULL",
        message: "服务器已满，请稍后再试",
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
