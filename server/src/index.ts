// ============================================================
// A1/A2 · Socket.IO 入口 · Entry Point
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

// ---- A2 模块导入 · A2 Module Imports ----
import { DataStore } from "./db/store.js";
import { handleJoin } from "./handlers/join.js";
import { handleProfileView } from "./handlers/profile.js";
import { handleChatSend, handleChatHistory } from "./handlers/chat.js";
import {
  handleFriendRequest,
  handleFriendAccept,
  handleFriendReject,
} from "./handlers/friends.js";

import type { JoinData } from "./types.js";
import { REQUEST_CLEANUP_AGE_MS } from "./types.js";

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
const store = new DataStore(); // A2 数据存储 · Data store

// 加载 NPC 数据 · Load NPC data on startup
const npcs = loadNPCs();
const dialogues = loadNPCDialogues();
console.log(`[npc] Loaded ${npcs.length} NPCs, ${Object.keys(dialogues).length} dialogue sets`);

// ---- Socket.IO 事件处理 · Event Handling ----

io.on("connection", (socket) => {
  console.log(`[connect] Socket ${socket.id} connected`);

  // ============================================================
  // PLAYER JOIN · 玩家加入 (A2 handler)
  // ============================================================
  socket.on("player.join", async (data: JoinData) => {
    await handleJoin(socket, data, zoneManager, redis, connectionGuard, store, npcs);
  });

  // ============================================================
  // PLAYER MOVE · 玩家移动 (A1 handler)
  // ============================================================
  socket.on("player.move", (data) => {
    handleMovement(socket, data, zoneManager, redis, store, npcs);
  });

  // ============================================================
  // NPC TALK · NPC 对话 (A1 handler)
  // ============================================================
  socket.on("npc.talk", (data: { npcId: string }) => {
    handleNPCTalk(socket, data, zoneManager, npcs, dialogues);
  });

  // ============================================================
  // PROFILE VIEW · 查看附近玩家资料 (A2 handler)
  // ============================================================
  socket.on("profile.view", (data: { id: string }) => {
    handleProfileView(socket, data, zoneManager, store);
  });

  // ============================================================
  // CHAT · 聊天 (A2 handlers)
  // ============================================================
  socket.on("chat.send", (data: { to: string; text: string }) => {
    handleChatSend(socket, data, zoneManager, store);
  });

  socket.on("chat.history", (data: { with: string; before?: number }) => {
    handleChatHistory(socket, data, zoneManager, store);
  });

  // ============================================================
  // FRIEND SYSTEM · 好友系统 (A2 handlers)
  // ============================================================
  socket.on("friend.request", (data: { to: string }) => {
    handleFriendRequest(socket, data, zoneManager, store);
  });

  socket.on("friend.accept", (data: { from: string }) => {
    handleFriendAccept(socket, data, zoneManager, store);
  });

  socket.on("friend.reject", (data: { from: string }) => {
    handleFriendReject(socket, data, zoneManager, store);
  });

  // ============================================================
  // DISCONNECT · 玩家断开 (A1 + A2 handler)
  // ============================================================
  socket.on("disconnect", async () => {
    console.log(`[disconnect] Socket ${socket.id} disconnected`);

    try {
      const result = zoneManager.removePlayerBySocket(socket.id);
      if (!result) return;

      const { oldZone, player } = result;

      // 更新 A2 存储的在线状态 · Update online status in A2 store
      store.setOnline(player.id, false);

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
    } catch (err) {
      console.error("[disconnect] Error during disconnect cleanup:", err);
    }
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

  // 定期清理过期好友请求（每 5 分钟）· Periodic stale request cleanup
  setInterval(() => {
    const cleaned = store.cleanStaleRequests();
    if (cleaned > 0) {
      console.log(`[store] Cleaned ${cleaned} stale friend requests`);
    }
  }, REQUEST_CLEANUP_AGE_MS);
}

main().catch((err) => {
  console.error("[server] Fatal error:", err);
  process.exit(1);
});
