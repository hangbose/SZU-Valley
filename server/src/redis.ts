// ============================================================
// A1 · Redis 客户端封装 (含内存兜底) · Redis Client (w/ memory fallback)
// ============================================================
//
// 优先连接 Redis，失败时自动切换到内存 Map。
// 内存模式数据在进程重启后丢失，但本地开发完全够用。
//
// Tries Redis first; falls back to in-memory Map on failure.
// Memory mode loses data on restart — fine for local dev.

import { Redis } from "ioredis";

const POSITION_TTL = 300;

/** Internal interface — same API whether Redis or memory-backed. */
interface Store {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  addOnlinePlayer(id: string): Promise<void>;
  removeOnlinePlayer(id: string): Promise<void>;
  getOnlineCount(): Promise<number>;
  isOnline(id: string): Promise<boolean>;
  setPosition(id: string, x: number, y: number): Promise<void>;
  getPosition(id: string): Promise<{ x: number; y: number } | null>;
  removePosition(id: string): Promise<void>;
}

// ============================================================
// Redis implementation
// ============================================================

class RedisStore implements Store {
  private redis: Redis;

  constructor(url: string) {
    this.redis = new Redis(url, {
      lazyConnect: true,
      retryStrategy: (times) => {
        if (times > 3) return null;
        return Math.min(times * 300, 1500);
      },
    });
  }

  onError(handler: () => void): void {
    this.redis.on("error", handler);
  }

  async connect(): Promise<void> {
    await this.redis.connect();
  }

  async disconnect(): Promise<void> {
    await this.redis.quit().catch(() => {});
  }

  async addOnlinePlayer(id: string): Promise<void> {
    await this.redis.sadd("online:players", id);
  }

  async removeOnlinePlayer(id: string): Promise<void> {
    await this.redis.srem("online:players", id);
  }

  async getOnlineCount(): Promise<number> {
    return await this.redis.scard("online:players");
  }

  async isOnline(id: string): Promise<boolean> {
    return (await this.redis.sismember("online:players", id)) === 1;
  }

  async setPosition(id: string, x: number, y: number): Promise<void> {
    await this.redis.setex(`pos:${id}`, POSITION_TTL, JSON.stringify({ x, y }));
  }

  async getPosition(id: string): Promise<{ x: number; y: number } | null> {
    const json = await this.redis.get(`pos:${id}`);
    if (!json) return null;
    try {
      return JSON.parse(json) as { x: number; y: number };
    } catch {
      return null;
    }
  }

  async removePosition(id: string): Promise<void> {
    await this.redis.del(`pos:${id}`);
  }
}

// ============================================================
// In-memory fallback
// ============================================================

class MemoryStore implements Store {
  private online = new Set<string>();
  private positions = new Map<string, { x: number; y: number }>();

  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}

  async addOnlinePlayer(id: string): Promise<void> {
    this.online.add(id);
  }

  async removeOnlinePlayer(id: string): Promise<void> {
    this.online.delete(id);
    this.positions.delete(id);
  }

  async getOnlineCount(): Promise<number> {
    return this.online.size;
  }

  async isOnline(id: string): Promise<boolean> {
    return this.online.has(id);
  }

  async setPosition(id: string, x: number, y: number): Promise<void> {
    this.positions.set(id, { x, y });
  }

  async getPosition(id: string): Promise<{ x: number; y: number } | null> {
    return this.positions.get(id) ?? null;
  }

  async removePosition(id: string): Promise<void> {
    this.positions.delete(id);
  }
}

// ============================================================
// RedisClient — auto-selects backend
// ============================================================

export class RedisClient {
  private store!: Store;

  constructor(private url: string) {}

  async connect(): Promise<void> {
    try {
      const redisStore = new RedisStore(this.url);
      // Catch connection-refused noise before connect() call
      const onErr = () => {};
      redisStore.onError(onErr);
      await redisStore.connect();
      this.store = redisStore;
      console.log("[redis] ✅ Connected to Redis");
    } catch (_err) {
      console.warn("[redis] ⚠️  Redis unavailable — using in-memory store (data lost on restart)");
      this.store = new MemoryStore();
    }
  }

  async disconnect(): Promise<void> {
    await this.store.disconnect();
  }

  async addOnlinePlayer(id: string): Promise<void> {
    return this.store.addOnlinePlayer(id);
  }

  async removeOnlinePlayer(id: string): Promise<void> {
    return this.store.removeOnlinePlayer(id);
  }

  async getOnlineCount(): Promise<number> {
    return this.store.getOnlineCount();
  }

  async isOnline(id: string): Promise<boolean> {
    return this.store.isOnline(id);
  }

  async setPosition(id: string, x: number, y: number): Promise<void> {
    return this.store.setPosition(id, x, y);
  }

  async getPosition(id: string): Promise<{ x: number; y: number } | null> {
    return this.store.getPosition(id);
  }

  async removePosition(id: string): Promise<void> {
    return this.store.removePosition(id);
  }
}
