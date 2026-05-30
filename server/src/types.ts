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
  | "PLAYER_NOT_FOUND";

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
