// ============================================================
// A2 · 数据存储层 · Data Store (In-Memory)
// ============================================================
//
// 内存 Map 模拟数据库表，所有 A2 社交逻辑的数据来源。
// In-memory Maps simulating DB tables — the data source for all
// A2 social logic.
//
// 表结构 · Tables:
//   players        → Map<playerId, PlayerProfile>
//   friendships    → Map<playerId, Set<playerId>>  双向存储
//   friendRequests → Map<requestId, FriendRequest>
//   chatMessages   → Map<conversationKey, ChatMessage[]>
//
// 后续换 PostgreSQL 只需替换这个文件的实现。
// Swap to PostgreSQL later by replacing this file's implementation.

import type {
  PlayerProfile,
  FriendRequest,
  FriendRequestStatus,
  ChatMessage,
} from "../types.js";
import { CHAT_MAX_MESSAGES, CHAT_PAGE_SIZE, REQUEST_CLEANUP_AGE_MS } from "../types.js";

// ---- 对话Key工具 · Conversation Key Helper ----

function conversationKey(a: string, b: string): string {
  return a < b ? `${a}::${b}` : `${b}::${a}`;
}

let idCounter = 0;
function nextId(): string {
  return `msg_${Date.now()}_${++idCounter}`;
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
      friendsCount: 0,
      isOnline: true,
    };
    this.players.set(id, profile);
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

  /** 设置玩家标签 · Set player tags */
  setTags(id: string, tags: string[]): void {
    const p = this.players.get(id);
    if (p) p.tags = tags;
  }

  // =========================================================
  // 好友请求 · Friend Requests
  // =========================================================

  /** 创建好友请求 · Create a friend request */
  createFriendRequest(from: string, to: string): FriendRequest {
    const req: FriendRequest = {
      id: `fr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      from,
      to,
      status: "pending",
      createdAt: Date.now(),
    };
    this.friendRequests.set(req.id, req);
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
  findPendingRequest(
    from: string,
    to: string
  ): FriendRequest | undefined {
    for (const req of this.friendRequests.values()) {
      if (
        req.from === from &&
        req.to === to &&
        req.status === "pending"
      ) {
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
  }

  /** 解除好友关系 · Remove friendship */
  removeFriendship(a: string, b: string): void {
    this.friendships.get(a)?.delete(b);
    this.friendships.get(b)?.delete(a);

    const pa = this.players.get(a);
    const pb = this.players.get(b);
    if (pa) pa.friendsCount = this.friendships.get(a)?.size ?? 0;
    if (pb) pb.friendsCount = this.friendships.get(b)?.size ?? 0;
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

  /** 清理已完成的请求（accepted/rejected 超过 5 分钟的记录）
   * Clean up completed requests older than 5 minutes.
   */
  cleanStaleRequests(): number {
    const cutoff = Date.now() - REQUEST_CLEANUP_AGE_MS;
    let cleaned = 0;
    for (const [id, req] of this.friendRequests) {
      if (req.status !== "pending" && req.createdAt < cutoff) {
        this.friendRequests.delete(id);
        cleaned++;
      }
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
