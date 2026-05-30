# SZU Valley · 深大像素校园

一个为深圳大学学生打造的像素风多人校园社交地图。像星露谷物语一样走来走去，看见其他同学，靠近就能聊天。

> A pixel-art multiplayer campus social map for Shenzhen University students. Walk around like Stardew Valley, see other students, chat when you get close.

**不是游戏——而是一个类游戏的社交空间。** 地图让打招呼变得自然，而不是一种交易。

> **Not a game — a game-like social space.** The map makes introducing yourself feel natural instead of transactional.

---

## 功能介绍 · What it does

- 输入名字，选择像素头像，进入校园地图
  > Enter a name, pick a pixel avatar, drop into the campus map
- 在一个融合了真实深大地标（图书馆、文山湖、科技楼……）的瓦片地图上行走
  > Walk around a tile-based map fusing real SZU landmarks (Library, Wenshan Lake, Sci-Tech Building…)
- 实时看到其他玩家移动
  > See other players moving in real time
- 走近某人（3 格以内），点击他们，查看他们的个人资料
  > Walk up to someone (within 3 tiles), click them, view their profile
- 发起 1:1 聊天，发送好友请求
  > Start a 1:1 chat, send a friend request
- 如果周围没人，可以和散布在校园各处的 NPC 聊天
  > If nobody's around, chat with NPCs placed across campus
- 最多 50 个并发玩家
  > Max 50 concurrent players

---

## 技术栈 · Tech Stack

| 层 · Layer | 技术 · Technology |
|-------|-----------|
| 游戏渲染 · Game rendering | Phaser.js 3.x |
| UI 覆盖层 · UI overlay | React 18 |
| 打包工具 · Bundler | Vite |
| 实时服务器 · Realtime server | Node.js + Socket.IO |
| 数据库（持久化）· Database (persistence) | PostgreSQL |
| 位置缓存（内存）· Position cache (in-memory) | Redis |
| 部署（静态资源）· Deployment (static) | Vercel |
| 部署（服务端）· Deployment (server) | Railway / Fly.io / 轻量 VPS |

---

## 快速开始 · Quick Start

### 环境要求 · Prerequisites

- Node.js ≥ 20
- PostgreSQL 16
- Redis 7

### 安装步骤 · Setup

```bash
# 克隆仓库 · Clone
git clone <repo-url> && cd SZU-Valley

# 安装依赖 · Install dependencies
npm install
cd client && npm install && cd ..
cd server && npm install && cd ..

# 设置数据库 · Set up database
createdb szu_valley
cp server/.env.example server/.env  # 编辑数据库凭据 · edit credentials

# 运行迁移 · Run migrations
cd server && npm run migrate && cd ..

# 启动开发环境 · Start dev
npm run dev        # 同时启动客户端 (Vite :5173) 和服务端 (Socket.IO :3001)
```

### 项目结构 · Project layout

```
SZU-Valley/
├── client/               # Phaser.js + React 前端 (Vite) · frontend
│   ├── src/
│   │   ├── game/         # Phaser 场景、实体、地图 · scenes, entities, map
│   │   ├── ui/           # React 组件 (聊天、资料、好友) · components (Chat, Profile, Friends)
│   │   └── network/      # WebSocket 客户端封装 · client wrapper
│   └── public/
│       └── assets/       # 精灵图、瓦片集、地图 JSON · Sprites, tilesets, map JSON
├── server/               # Node.js + Socket.IO 后端 · backend
│   ├── src/
│   │   ├── game/         # 区域管理、NPC 引擎、移动 · Zone manager, NPC engine, movement
│   │   ├── social/       # 聊天、好友、资料 · Chat, friendship, profiles
│   │   └── data/         # NPC 配置、对话种子数据 · NPC configs, dialogue seed data
│   └── data/
│       ├── npcs.json
│       └── npc-dialogues.json
├── docs/                 # 设计文档与规格说明 · Design docs & specs
│   ├── constraints.md
│   ├── architecture.md
│   ├── protocol.md
│   └── roles.md
└── CONTEXT.md            # 领域术语表 · Domain glossary
```
