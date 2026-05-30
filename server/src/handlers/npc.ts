// ============================================================
// A1 · NPC 引擎 · NPC Engine
// ============================================================
//
// NPC 是校园里的"路人角色"——不会动，但会说预设的对话。
// NPCs are the "background characters" on campus — they don't move
// but speak pre-written dialogue lines.
//
// 职责 · Responsibilities:
//   1. 加载 NPC 配置和对话 · Load NPC configs and dialogues from JSON
//   2. 按区域筛选 NPC · Filter NPCs by zone
//   3. 处理 npc.talk 事件 · Handle npc.talk: distance check, random line

import type { Socket } from "socket.io";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { ZoneManager, getZoneForPosition } from "../zone-manager.js";
import { INTERACTION_RANGE } from "../types.js";
import type { NPC } from "../types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 从 JSON 文件加载 NPC 配置。
 * Load NPC configurations from npcs.json.
 */
export function loadNPCs(): NPC[] {
  try {
    const filePath = join(__dirname, "..", "..", "data", "npcs.json");
    const raw = readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as NPC[];
  } catch (err) {
    console.error("[npc] Failed to load npcs.json:", err);
    return [];
  }
}

/**
 * 从 JSON 文件加载 NPC 对话。
 * Load NPC dialogues from npc-dialogues.json.
 */
export function loadNPCDialogues(): Record<string, string[]> {
  try {
    const filePath = join(__dirname, "..", "..", "data", "npc-dialogues.json");
    const raw = readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as Record<string, string[]>;
  } catch (err) {
    console.error("[npc] Failed to load npc-dialogues.json:", err);
    return {};
  }
}

/**
 * 获取指定区域列表中的所有 NPC。
 * Get all NPCs whose position falls within any of the given zones.
 */
export function getNPCsInZones(zoneIds: number[], npcs: NPC[]): NPC[] {
  return npcs.filter((npc) => {
    const zone = getZoneForPosition(npc.x, npc.y);
    return zoneIds.includes(zone);
  });
}

/**
 * 处理 npc.talk 事件 · Handle npc.talk event.
 */
export function handleNPCTalk(
  socket: Socket,
  data: { npcId: string },
  zoneManager: ZoneManager,
  npcs: NPC[],
  dialogues: Record<string, string[]>
): void {
  const now = Date.now();

  // ---- 1. 找玩家 · Find the player ----

  const playerId = zoneManager.getPlayerIdBySocket(socket.id);
  if (!playerId) {
    socket.emit("error", {
      code: "PLAYER_NOT_FOUND",
      message: "你还未加入游戏",
    });
    return;
  }

  const player = zoneManager.getPlayer(playerId);
  if (!player) {
    socket.emit("error", {
      code: "PLAYER_NOT_FOUND",
      message: "找不到你的角色信息",
    });
    return;
  }

  // ---- 2. 找 NPC · Find the NPC ----

  const npc = npcs.find((n) => n.id === data.npcId);
  if (!npc) {
    socket.emit("error", {
      code: "NPC_NOT_FOUND",
      message: "找不到这个 NPC",
    });
    return;
  }

  // ---- 3. 距离检查（曼哈顿距离 ≤ 3 格）· Distance check ----

  const dist =
    Math.abs(player.x - npc.x) + Math.abs(player.y - npc.y);
  if (dist > INTERACTION_RANGE) {
    socket.emit("error", {
      code: "OUT_OF_RANGE",
      message: "离太远了，走近一点再说吧",
    });
    return;
  }

  // ---- 4. 频率限制（2次/秒）· Rate limit (2/sec per player) ----

  const lastTime = socket.data.lastTalkTime ?? 0;
  if (now - lastTime < 500) {
    socket.emit("error", {
      code: "RATE_LIMITED",
      message: "说话太快了，等一下再试",
    });
    return;
  }
  socket.data.lastTalkTime = now;

  // ---- 5. 随机选一句对话 · Pick a random dialogue line ----

  const lines = dialogues[npc.id] ?? [
    "（这个 NPC 暂时没有想说的话）",
  ];
  const line = lines[Math.floor(Math.random() * lines.length)];

  // ---- 6. 发送回复 · Respond ----

  socket.emit("npc.dialogue", {
    npcId: npc.id,
    npcName: npc.name,
    text: line,
  });
}
