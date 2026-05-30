// ============================================================
// A1 · Socket.IO 入口 · Entry Point
// ============================================================
//
// 服务器主文件——创建 HTTP 服务器，挂载 Socket.IO，
// 注册所有事件处理器，串联所有模块。
//
// Main server file — creates the HTTP server, attaches Socket.IO,
// registers all event handlers, wires up all modules.

import { createServer } from "http";
import { Server } from "socket.io";
import { RedisClient } from "./redis.js";
import { ZoneManager, getZoneForPosition, getZoneNeighbors } from "./zone-manager.js";
import { ConnectionGuard } from "./connection-guard.js";
import { handleMovement, sendZoneSnapshot } from "./handlers/movement.js";
import { handleNPCTalk, loadNPCs, loadNPCDialogues } from "./handlers/npc.js";
import type { JoinData } from "./types.js";

// ---- 配置 · Configuration ----

const PORT = parseInt(process.env.PORT || "3001");
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// ---- 初始化模块 · Initialize Modules ----

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: { origin: "*" },
  pingInterval: 10000,
  pingTimeout: 5000,
});

const redis = new RedisClient(REDIS_URL);
const zoneManager = new ZoneManager();
const connectionGuard = new ConnectionGuard(redis, zoneManager);

// 加载 NPC 数据 · Load NPC data on startup
const npcs = loadNPCs();
const dialogues = loadNPCDialogues();
console.log(`[npc] Loaded ${npcs.length} NPCs, ${Object.keys(dialogues).length} dialogue sets`);

// ---- Socket.IO 事件处理 · Event Handling ----

io.on("connection", (socket) => {
  console.log(`[connect] Socket ${socket.id} connected`);

  // ============================================================
  // PLAYER JOIN · 玩家加入
  // ============================================================
  socket.on("player.join", async (data: JoinData) => {
    try {
      // 0. 空值保护 · Null guard
      if (!data || typeof data.name !== "string") {
        socket.emit("error", { code: "INVALID_NAME", message: "请提供有效的名字" });
        return;
      }

      // 1. 验证名字格式 · Validate name format
      const nameCheck = ConnectionGuard.validateName(data.name);
      if (!nameCheck.valid) {
        socket.emit("error", { code: "INVALID_NAME", message: nameCheck.message });
        return;
      }

      // 2. 连接守卫检查 · Connection guard (capacity + uniqueness)
      const guardResult = await connectionGuard.checkJoinAllowed(data.name.trim());
      if (guardResult) {
        socket.emit("error", guardResult);
        setTimeout(() => socket.disconnect(), 1000);
        return;
      }

      // 3. 分配 ID 和出生点（测试阶段统一出生在地图中央）
      const playerId = crypto.randomUUID();
      const spawn = { x: 100, y: 75 };

      // 4. 注册到 Zone Manager
      const player = zoneManager.registerPlayer(
        socket,
        playerId,
        data.name.trim(),
        data.avatar,
        spawn.x,
        spawn.y
      );

      // 5. 更新 Redis
      await redis.addOnlinePlayer(playerId);
      await redis.setPosition(playerId, spawn.x, spawn.y);

      // 6. 发送加入确认（只发给加入者自己）
      socket.emit("player.joined", {
        playerId,
        spawn: { x: spawn.x, y: spawn.y },
      });

      // 7. 发送区域快照（附近的玩家和 NPC）
      const zoneId = getZoneForPosition(spawn.x, spawn.y);
      const neighborZones = getZoneNeighbors(zoneId);
      sendZoneSnapshot(socket, neighborZones, zoneManager, playerId, npcs);

      // 8. 广播"新玩家加入"给区域内的其他人
      for (const z of neighborZones) {
        socket.to(`zone:${z}`).emit("player.joined", {
          id: playerId,
          name: player.name,
          avatar: player.avatar,
          x: spawn.x,
          y: spawn.y,
        });
      }

      console.log(`[join] Player "${player.name}" (${playerId}) joined at (${spawn.x}, ${spawn.y})`);
    } catch (err) {
      console.error("[join] Unexpected error:", err);
      socket.emit("error", {
        code: "SERVER_FULL",
        message: "服务器内部错误，请稍后重试",
      });
    }
  });

  // ============================================================
  // PLAYER MOVE · 玩家移动
  // ============================================================
  socket.on("player.move", (data) => {
    handleMovement(socket, data, zoneManager, redis, npcs);
  });

  // ============================================================
  // NPC TALK · NPC 对话
  // ============================================================
  socket.on("npc.talk", (data: { npcId: string }) => {
    handleNPCTalk(socket, data, zoneManager, npcs, dialogues);
  });

  // ============================================================
  // DISCONNECT · 玩家断开
  // ============================================================
  socket.on("disconnect", async () => {
    console.log(`[disconnect] Socket ${socket.id} disconnected`);

    const result = zoneManager.removePlayerBySocket(socket.id);
    if (!result) return;

    const { oldZone, player } = result;

    // 清理 Redis
    try {
      await redis.removeOnlinePlayer(player.id);
      await redis.removePosition(player.id);
    } catch (err) {
      console.error("[redis] Cleanup error:", err);
    }

    // 广播"玩家离开"到旧区域及所有邻居
    if (oldZone >= 0) {
      const neighbors = getZoneNeighbors(oldZone);
      for (const z of neighbors) {
        io.to(`zone:${z}`).emit("player.left", { id: player.id });
      }
    }

    console.log(
      `[leave] Player "${player.name}" (${player.id}) left, ` +
        `online: ${zoneManager.getOnlineCount()}`
    );
  });
});

// ---- 启动服务器 · Start Server ----

async function main() {
  try {
    await redis.connect();
  } catch (err) {
    console.error("[server] Failed to connect to Redis:", err);
    console.error("[server] Make sure Redis is running on", REDIS_URL);
    process.exit(1);
  }

  httpServer.listen(PORT, () => {
    console.log(`[server] 🎮 SZU-Valley server listening on http://localhost:${PORT}`);
    console.log(`[server] Max players: 50 | Map: 200×150 | Zones: 13×13`);
  });
}

main().catch((err) => {
  console.error("[server] Fatal error:", err);
  process.exit(1);
});
