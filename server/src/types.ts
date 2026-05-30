// ============================================================
// SZU Valley · 共享类型定义 · Shared Type Definitions
// ============================================================

/** 玩家方向 · Player facing direction */
export type Direction = "up" | "down" | "left" | "right";

/** 玩家移动数据（客户端→服务端）· Move payload from client */
export interface MoveData {
  x: number;
  y: number;
  direction: Direction;
  moving: boolean;
}

/** 玩家加入数据（客户端→服务端）· Join payload from client */
export interface JoinData {
  name: string;
  avatar: string;
  playerId?: string; // 方案 A：localStorage 持久化身份（可选）
}

/** NPC 对话数据（客户端→服务端）· NPC talk payload from client */
export interface TalkData {
  npcId: string;
}

/** 服务端玩家的完整状态 · Full player state on server */
export interface PlayerState {
  id: string;
  name: string;
  avatar: string;
  x: number;
  y: number;
  direction: Direction;
  moving: boolean;
  joinedAt: number;
}

/** NPC 配置（来自 npcs.json）· NPC configuration */
export interface NPC {
  id: string;
  name: string;
  avatar: string;
  x: number;
  y: number;
  description: string;
}

/** 出生点 · Spawn point */
export interface SpawnPoint {
  x: number;
  y: number;
}

/** 服务端错误码 · Server error codes */
export type ErrorCode =
  | "SERVER_FULL"
  | "NAME_TAKEN"
  | "INVALID_NAME"
  | "OUT_OF_RANGE"
  | "INVALID_MOVE"
  | "RATE_LIMITED"
  | "NPC_NOT_FOUND"
  | "PLAYER_NOT_FOUND"
  | "ALREADY_FRIENDS"
  | "REQUEST_NOT_FOUND"
  | "NOT_FRIENDS";

/** 服务端错误响应 · Server error response */
export interface ErrorResponse {
  code: ErrorCode;
  message: string;
}

/** 位置校验结果 · Position validation result */
export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

/** 区域变更结果 · Zone change result from updatePlayerPosition */
export interface ZoneChangeResult {
  zoneChanged: boolean;
  oldZone: number | null;
  newZone: number;
}

// ---- 地图常量 · Map Constants ----

/** 地图宽度（瓦片数）· Map width in tiles */
export const MAP_WIDTH = 200;

/** 地图高度（瓦片数）· Map height in tiles */
export const MAP_HEIGHT = 150;

/** 区域宽度（瓦片数）· Zone width in tiles */
export const ZONE_WIDTH = 16;

/** 区域高度（瓦片数）· Zone height in tiles */
export const ZONE_HEIGHT = 12;

/** 每行区域数 · Zones per row */
export const ZONES_PER_ROW = Math.ceil(MAP_WIDTH / ZONE_WIDTH); // 13

/** 每列区域数 · Zones per column */
export const ZONES_PER_COL = Math.ceil(MAP_HEIGHT / ZONE_HEIGHT); // 13

/** 总区域数 · Total zones */
export const TOTAL_ZONES = ZONES_PER_ROW * ZONES_PER_COL; // 169

/** 最大玩家数 · Max concurrent players */
export const MAX_PLAYERS = 50;

/** 交互距离（曼哈顿，瓦片）· Interaction range (Manhattan, tiles) */
export const INTERACTION_RANGE = 3;

/** 移动最小间隔（毫秒）· Minimum move interval (ms) */
export const MOVE_THROTTLE_MS = 50;

/** 最大移动速度（瓦片/秒）· Max move speed (tiles/sec) for cheat detection */
export const MAX_SPEED = 8;

/** 聊天频率限制（条/秒）· Chat rate limit per second */
export const CHAT_RATE_LIMIT = 5;

/** 好友请求频率限制（条/分钟）· Friend request rate limit per minute */
export const FRIEND_RATE_LIMIT = 10;

/** 聊天消息最大长度（字符）· Max chat message length in chars */
export const CHAT_MAX_LENGTH = 500;

/** 对话历史每页条数 · Chat history page size */
export const CHAT_PAGE_SIZE = 50;

/** 聊天消息内存上限（每条对话）· Max messages per conversation in memory */
export const CHAT_MAX_MESSAGES = 500;

/** 好友请求过期清理间隔（毫秒）· Friend request cleanup interval */
export const REQUEST_CLEANUP_AGE_MS = 5 * 60 * 1000;

// ---- A2: 社交类型 · Social Types ----

/** 好友请求状态 · Friend request status */
export type FriendRequestStatus = "pending" | "accepted" | "rejected";

/** 好友请求 · A friend request */
export interface FriendRequest {
  id: string;
  from: string;
  to: string;
  status: FriendRequestStatus;
  createdAt: number;
}

/** 好友关系 · A friendship pair */
export interface Friendship {
  playerA: string;
  playerB: string;
  createdAt: number;
}

/** 聊天消息 · A chat message */
export interface ChatMessage {
  id: string;
  from: string;
  to: string;
  text: string;
  timestamp: number;
}

/** 玩家公开资料（返回给客户端）· Player public profile */
export interface PlayerProfile {
  id: string;
  name: string;
  avatar: string;
  tags: string[];
  friendsCount: number;
  isOnline: boolean;
}
