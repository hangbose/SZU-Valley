// ============================================================
// A2 · 数据存储层 · Data Store (In-Memory + PostgreSQL)
// ============================================================
//
// 内存 Map 作为读写缓存，PostgreSQL 作为持久化存储。
// In-memory Maps as read/write cache, PostgreSQL for persistence.
//
// 生产环境有 DATABASE_URL 时自动启用 PG 持久化；
// 开发环境无 PG 时退化为纯内存模式。
//
// 表结构 · Tables:
//   players        → Map<playerId, PlayerProfile>
//   friendships    → Map<playerId, Set<playerId>>  双向存储
//   friendRequests → Map<requestId, FriendRequest>
//   chatMessages   → Map<conversationKey, ChatMessage[]>

import type {
  PlayerProfile,
  FriendRequest,
  FriendRequestStatus,
  ChatMessage,
} from "../types.js";
import { CHAT_MAX_MESSAGES, CHAT_PAGE_SIZE, REQUEST_CLEANUP_AGE_MS } from "../types.js";
import type { Pool } from "pg";

// ---- 对话Key工具 · Conversation Key Helper ----

function conversationKey(a: string, b: string): string {
  return a < b ? `${a}::${b}` : `${b}::${a}`;
}

let idCounter = 0;
function nextId(): string {
  return `msg_${Date.now()}_${++idCounter}`;
}

function nextRequestId(): string {
  return `fr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ---- DataStore 类 ----

export class DataStore {
  // 玩家资料 · Player profiles
  private players: Map<string, PlayerProfile> = new Map();

  // 好友关系（双向存储）· Friendships (bidirectional)
  private friendships: Map<string, Set<string>> = new Map();

  // 好友请求 · Friend requests
  private friendRequests: Map<string, FriendRequest> = new Map();

  // 聊天消息 · Chat messages
  private chatMessages: Map<string, ChatMessage[]> = new Map();

  // PG 连接池（可选）· Optional PG pool
  private pg: Pool | null = null;
  private pgReady = false;

  constructor(pg?: Pool) {
    if (pg) {
      this.pg = pg;
      // Async init — errors are logged, server continues in memory-only mode
      this.initPG().catch((err) => {
        console.error("[store] PG init failed, running in memory-only mode:", err.message);
        this.pgReady = false;
      });
    }
  }

  // =========================================================
  // PostgreSQL 初始化 · Initialize & load from DB
  // =========================================================

  private async initPG(): Promise<void> {
    if (!this.pg) return;

    // Verify connection
    await this.pg.query("SELECT 1");

    // Load existing data into memory
    await this.loadPlayers();
    await this.loadFriendships();
    await this.loadFriendRequests();
    await this.loadChatMessages();

    this.pgReady = true;
    console.log("[store] PG ready — data loaded from PostgreSQL");
  }

  private async loadPlayers(): Promise<void> {
    if (!this.pg) return;
    const { rows } = await this.pg.query(
      `SELECT id, name, avatar, tags FROM players`
    );
    for (const r of rows) {
      this.players.set(r.id, {
        id: r.id,
        name: r.name,
        avatar: r.avatar,
        tags: r.tags ?? [],
        friendsCount: 0,
        isOnline: false,
      });
    }
  }

  private async loadFriendships(): Promise<void> {
    if (!this.pg) return;
    const { rows } = await this.pg.query(`SELECT player_a, player_b FROM friendships`);
    for (const r of rows) {
      if (!this.friendships.has(r.player_a)) this.friendships.set(r.player_a, new Set());
      if (!this.friendships.has(r.player_b)) this.friendships.set(r.player_b, new Set());
      this.friendships.get(r.player_a)!.add(r.player_b);
      this.friendships.get(r.player_b)!.add(r.player_a);
    }
    // Update friend counts
    for (const [id, set] of this.friendships) {
      const p = this.players.get(id);
      if (p) p.friendsCount = set.size;
    }
  }

  private async loadFriendRequests(): Promise<void> {
    if (!this.pg) return;
    const { rows } = await this.pg.query(
      `SELECT id, from_player, to_player, status, created_at FROM friend_requests`
    );
    for (const r of rows) {
      this.friendRequests.set(r.id, {
        id: r.id,
        from: r.from_player,
        to: r.to_player,
        status: r.status,
        createdAt: new Date(r.created_at).getTime(),
      });
    }
  }

  private async loadChatMessages(): Promise<void> {
    if (!this.pg) return;
    const { rows } = await this.pg.query(
      `SELECT from_player, to_player, text, created_at FROM chat_messages ORDER BY created_at`
    );
    for (const r of rows) {
      const key = conversationKey(r.from_player, r.to_player);
      if (!this.chatMessages.has(key)) this.chatMessages.set(key, []);
      this.chatMessages.get(key)!.push({
        id: `msg_pg_${this.chatMessages.get(key)!.length}`,
        from: r.from_player,
        to: r.to_player,
        text: r.text,
        timestamp: new Date(r.created_at).getTime(),
      });
    }
    // Trim to max messages
    for (const [key, msgs] of this.chatMessages) {
      if (msgs.length > CHAT_MAX_MESSAGES) {
        msgs.splice(0, msgs.length - CHAT_MAX_MESSAGES);
      }
    }
  }

  // =========================================================
  // 玩家资料 · Player Profile
  // =========================================================

  /** 创建玩家资料 · Create player profile (called on join) */
  createPlayer(id: string, name: string, avatar: string): PlayerProfile {
    const profile: PlayerProfile = {
      id,
      name,
      avatar,
      tags: [],
      friendsCount: this.friendships.get(id)?.size ?? 0,
      isOnline: true,
    };
    this.players.set(id, profile);

    // PG: upsert player
    this.pg?.query(
      `INSERT INTO players (id, name, avatar) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET name = $2, avatar = $3`,
      [id, name, avatar]
    ).catch((err) => console.error("[store] createPlayer PG error:", err.message));

    return profile;
  }

  /** 获取玩家资料 · Get player profile */
  getPlayer(id: string): PlayerProfile | undefined {
    return this.players.get(id);
  }

  /** 更新在线状态 · Update online status */
  setOnline(id: string, online: boolean): void {
    const p = this.players.get(id);
    if (p) p.isOnline = online;
  }

  /** 更新玩家名字和头像（回头客）· Update name + avatar for returning player */
  updatePlayer(id: string, name: string, avatar: string): void {
    const p = this.players.get(id);
    if (p) {
      p.name = name;
      p.avatar = avatar;
    }
    // PG: upsert
    this.pg?.query(
      `INSERT INTO players (id, name, avatar) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET name = $2, avatar = $3`,
      [id, name, avatar]
    ).catch((err) => console.error("[store] updatePlayer PG error:", err.message));
  }

  /** 设置玩家标签 · Set player tags */
  setTags(id: string, tags: string[]): void {
    const p = this.players.get(id);
    if (p) p.tags = tags;
    // PG: update tags
    this.pg?.query(
      `UPDATE players SET tags = $2 WHERE id = $1`,
      [id, tags]
    ).catch((err) => console.error("[store] setTags PG error:", err.message));
  }

  // =========================================================
  // 好友请求 · Friend Requests
  // =========================================================

  /** 创建好友请求 · Create a friend request */
  createFriendRequest(from: string, to: string): FriendRequest {
    const req: FriendRequest = {
      id: nextRequestId(),
      from,
      to,
      status: "pending",
      createdAt: Date.now(),
    };
    this.friendRequests.set(req.id, req);

    // PG: insert
    this.pg?.query(
      `INSERT INTO friend_requests (id, from_player, to_player, status, created_at)
       VALUES ($1, $2, $3, $4, to_timestamp($5))`,
      [req.id, from, to, "pending", req.createdAt / 1000]
    ).catch((err) => console.error("[store] createFriendRequest PG error:", err.message));

    return req;
  }

  /** 获取发给某人的待处理请求 · Get pending requests sent to a player */
  getPendingRequests(playerId: string): FriendRequest[] {
    const result: FriendRequest[] = [];
    for (const req of this.friendRequests.values()) {
      if (req.to === playerId && req.status === "pending") {
        result.push(req);
      }
    }
    return result;
  }

  /** 查找两个玩家之间的待处理请求 · Find pending request between two players */
  findPendingRequest(from: string, to: string): FriendRequest | undefined {
    for (const req of this.friendRequests.values()) {
      if (req.from === from && req.to === to && req.status === "pending") {
        return req;
      }
    }
    return undefined;
  }

  /** 通过 ID 获取请求 · Get request by ID */
  getRequest(id: string): FriendRequest | undefined {
    return this.friendRequests.get(id);
  }

  /** 更新请求状态 · Update request status */
  updateRequestStatus(id: string, status: FriendRequestStatus): boolean {
    const req = this.friendRequests.get(id);
    if (!req) return false;
    req.status = status;

    // PG: update status
    this.pg?.query(
      `UPDATE friend_requests SET status = $2, updated_at = NOW() WHERE id = $1`,
      [id, status]
    ).catch((err) => console.error("[store] updateRequestStatus PG error:", err.message));

    return true;
  }

  // =========================================================
  // 好友关系 · Friendships (bidirectional)
  // =========================================================

  /** 建立双向好友关系 · Create bidirectional friendship */
  addFriendship(a: string, b: string): void {
    if (!this.friendships.has(a)) this.friendships.set(a, new Set());
    if (!this.friendships.has(b)) this.friendships.set(b, new Set());
    this.friendships.get(a)!.add(b);
    this.friendships.get(b)!.add(a);

    // 更新双方的好友计数
    const pa = this.players.get(a);
    const pb = this.players.get(b);
    if (pa) pa.friendsCount = this.friendships.get(a)!.size;
    if (pb) pb.friendsCount = this.friendships.get(b)!.size;

    // PG: insert (ordered to match CHECK constraint)
    const [first, second] = a < b ? [a, b] : [b, a];
    this.pg?.query(
      `INSERT INTO friendships (player_a, player_b) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [first, second]
    ).catch((err) => console.error("[store] addFriendship PG error:", err.message));
  }

  /** 解除好友关系 · Remove friendship */
  removeFriendship(a: string, b: string): void {
    this.friendships.get(a)?.delete(b);
    this.friendships.get(b)?.delete(a);

    const pa = this.players.get(a);
    const pb = this.players.get(b);
    if (pa) pa.friendsCount = this.friendships.get(a)?.size ?? 0;
    if (pb) pb.friendsCount = this.friendships.get(b)?.size ?? 0;

    // PG: delete
    const [first, second] = a < b ? [a, b] : [b, a];
    this.pg?.query(
      `DELETE FROM friendships WHERE player_a = $1 AND player_b = $2`,
      [first, second]
    ).catch((err) => console.error("[store] removeFriendship PG error:", err.message));
  }

  /** 检查两人是否为好友 · Check if two players are friends */
  isFriend(a: string, b: string): boolean {
    return this.friendships.get(a)?.has(b) ?? false;
  }

  /** 获取某人的好友列表 · Get a player's friend list */
  getFriends(playerId: string): string[] {
    return [...(this.friendships.get(playerId) ?? [])];
  }

  /** 获取好友数量 · Get friend count */
  getFriendsCount(playerId: string): number {
    return this.friendships.get(playerId)?.size ?? 0;
  }

  /** 清理已完成的请求 · Clean up completed requests */
  cleanStaleRequests(): number {
    const cutoff = Date.now() - REQUEST_CLEANUP_AGE_MS;
    let cleaned = 0;
    for (const [id, req] of this.friendRequests) {
      if (req.status !== "pending" && req.createdAt < cutoff) {
        this.friendRequests.delete(id);
        cleaned++;
      }
    }
    // PG: batch delete stale
    if (cleaned > 0 && this.pg) {
      this.pg.query(
        `DELETE FROM friend_requests WHERE status != 'pending' AND created_at < to_timestamp($1)`,
        [cutoff / 1000]
      ).catch((err) => console.error("[store] cleanStaleRequests PG error:", err.message));
    }
    return cleaned;
  }

  // =========================================================
  // 聊天消息 · Chat Messages
  // =========================================================

  /** 保存聊天消息 · Save a chat message */
  saveMessage(from: string, to: string, text: string): ChatMessage {
    const msg: ChatMessage = {
      id: nextId(),
      from,
      to,
      text,
      timestamp: Date.now(),
    };

    const key = conversationKey(from, to);
    if (!this.chatMessages.has(key)) {
      this.chatMessages.set(key, []);
    }
    this.chatMessages.get(key)!.push(msg);

    // 只保留最近 N 条消息（内存控制）
    const msgs = this.chatMessages.get(key)!;
    if (msgs.length > CHAT_MAX_MESSAGES) {
      msgs.splice(0, msgs.length - CHAT_MAX_MESSAGES);
    }

    // PG: insert
    this.pg?.query(
      `INSERT INTO chat_messages (from_player, to_player, text, created_at)
       VALUES ($1, $2, $3, to_timestamp($4))`,
      [from, to, text, msg.timestamp / 1000]
    ).catch((err) => console.error("[store] saveMessage PG error:", err.message));

    return msg;
  }

  /** 获取聊天历史 · Get chat history (paginated) */
  getChatHistory(
    playerA: string,
    playerB: string,
    before?: number,
    limit = CHAT_PAGE_SIZE
  ): { messages: ChatMessage[]; hasMore: boolean } {
    const key = conversationKey(playerA, playerB);
    const all = this.chatMessages.get(key) ?? [];

    // 找到 before 时间戳之前的消息
    let filtered = before
      ? all.filter((m) => m.timestamp < before)
      : all;

    const hasMore = filtered.length > limit;
    const messages = filtered.slice(-limit);

    return { messages, hasMore };
  }
}
