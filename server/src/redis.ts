// ============================================================
// A1 · Redis 客户端封装 · Redis Client Wrapper
// ============================================================
//
// Redis 是服务器的"短期记忆"——存储实时位置和在线状态。
// Redis is the server's "short-term memory" — stores live positions
// and online status.
//
// 数据结构 · Data Structures:
//   online:players   → Set    (SADD/SREM/SCARD) 谁在线
//   pos:{playerId}   → String (SETEX/GET/DEL)   玩家位置 JSON, TTL 300s

import { Redis } from "ioredis";

const POSITION_TTL = 300; // 5 分钟 · 5 minutes

export class RedisClient {
  private redis: Redis;
  private connected = false;

  constructor(url: string) {
    this.redis = new Redis(url, {
      lazyConnect: true,
      retryStrategy: (times) => {
        if (times > 10) return null; // 放弃重连 · give up
        return Math.min(times * 200, 2000);
      },
    });
  }

  /** 连接 Redis · Connect */
  async connect(): Promise<void> {
    await this.redis.connect();
    this.connected = true;
    console.log("[redis] Connected");
  }

  /** 断开 Redis · Disconnect */
  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.redis.quit();
      this.connected = false;
    }
  }

  // ---- 在线玩家集合 · Online Player Set ----

  /** 标记玩家上线 · Mark player as online */
  async addOnlinePlayer(playerId: string): Promise<void> {
    await this.redis.sadd("online:players", playerId);
  }

  /** 标记玩家下线 · Mark player as offline */
  async removeOnlinePlayer(playerId: string): Promise<void> {
    await this.redis.srem("online:players", playerId);
  }

  /** 获取在线人数 · Get online count */
  async getOnlineCount(): Promise<number> {
    return await this.redis.scard("online:players");
  }

  /** 检查玩家是否在线 · Check if player is online */
  async isOnline(playerId: string): Promise<boolean> {
    const result = await this.redis.sismember("online:players", playerId);
    return result === 1;
  }

  // ---- 位置缓存 · Position Cache ----

  /** 更新玩家位置（带 TTL）· Set player position with TTL */
  async setPosition(
    playerId: string,
    x: number,
    y: number
  ): Promise<void> {
    const json = JSON.stringify({ x, y });
    await this.redis.setex(`pos:${playerId}`, POSITION_TTL, json);
  }

  /** 获取玩家位置 · Get player position */
  async getPosition(
    playerId: string
  ): Promise<{ x: number; y: number } | null> {
    const json = await this.redis.get(`pos:${playerId}`);
    if (!json) return null;
    try {
      return JSON.parse(json) as { x: number; y: number };
    } catch {
      return null;
    }
  }

  /** 删除玩家位置 · Delete player position */
  async removePosition(playerId: string): Promise<void> {
    await this.redis.del(`pos:${playerId}`);
  }
}
