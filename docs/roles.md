# 团队分工 · 3+1 模式 · Team Division · 3+1 Model

三位核心贡献者加上一个负责资产和内容的较轻角色。

> Three core contributors plus one lighter role for assets and content.

---

## 角色 A：后端与基础设施 · Role A: Backend & Infrastructure

**范围 · Scope**: 所有服务端内容加上部署。· Everything server-side plus deployment.

### 模块 · Modules

| 模块 · Module | 描述 · Description |
|--------|-------------|
| Socket.IO 服务器 · Socket.IO server | 连接生命周期、事件路由、房间管理 · Connection lifecycle, event routing, room management |
| 区域管理器 · Zone Manager | 区域分配、订阅、邻居计算 · Zone assignment, subscription, neighbor calculation |
| 移动系统 · Movement System | 位置验证、Redis 读写、广播 · Position validation, Redis read/write, broadcast |
| 聊天转发 · Chat Relay | 范围验证、消息持久化、投递 · Range verification, message persistence, delivery |
| 好友系统 · Friend System | 请求/接受/拒绝流程、PostgreSQL 持久化 · Request/accept/reject flow, PostgreSQL persistence |
| NPC 引擎 · NPC Engine | 加载 JSON 配置、提供对话、广播 NPC 列表 · Load JSON configs, serve dialogue, broadcast NPC lists |
| 连接守卫 · Connection Guard | 50 人上限、名字唯一性检查 · 50-player cap, name uniqueness check |
| PostgreSQL 模式 · PostgreSQL schema | Players、friendships、chat_history 表 + 迁移 · Players, friendships, chat_history tables + migrations |
| Redis 模式 · Redis schema | 位置键、在线集合、TTL 管理 · Position keys, online set, TTL management |
| 部署 · Deployment | Docker Compose、Nginx 反向代理、环境配置 · Docker Compose, Nginx reverse proxy, environment config |

### 关键文件 · Key Files

```
server/
├── src/
│   ├── index.ts              # 入口点，Socket.IO 初始化 · Entry point, Socket.IO init
│   ├── handlers/
│   │   ├── join.ts
│   │   ├── movement.ts
│   │   ├── chat.ts
│   │   ├── friends.ts
│   │   └── npc.ts
│   ├── zone-manager.ts
│   ├── connection-guard.ts
│   ├── db/
│   │   ├── pool.ts           # PG 连接 · PG connection
│   │   ├── migrations/
│   │   └── queries/
│   └── redis.ts              # Redis 客户端 · Redis client
├── data/
│   ├── npcs.json
│   └── npc-dialogues.json
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

---

## 角色 B：前端 — 游戏层 · Role B: Frontend — Game Layer

**范围 · Scope**: Phaser.js — 地图、精灵、移动、镜头。· the map, the sprites, the movement, the camera.

### 模块 · Modules

| 模块 · Module | 描述 · Description |
|--------|-------------|
| 启动与预加载 · Boot & Preload | 资源加载、启动画面 · Asset loading, splash screen |
| 瓦片地图场景 · TileMap Scene | 加载 Tiled `.json` 地图、渲染图层、碰撞瓦片 · Load Tiled `.json` map, render layers, collision tiles |
| 本地玩家 · Local Player | 精灵动画（四方向空闲/行走）、键盘输入 · Sprite animation (idle/walk in 4 directions), keyboard input |
| 远程玩家 · Remote Players | 生成/销毁精灵、平滑位置插值 · Spawn/despawn sprites, smooth position interpolation |
| NPC 精灵 · NPC Sprites | 在固定位置渲染 NPC、点击检测 · Render NPCs at fixed positions, click detection |
| 镜头 · Camera | 跟随本地玩家、世界边界限制 · Follow local player, world bounds clamping |
| 近距离检测 · Proximity Detection | 当目标进入/离开 3 格范围时发出事件 · Emit event when a target enters/exits 3-tile range |
| 交互提示 · Interaction Prompt | 显示/隐藏"按 E 交互"指示器 · Show/hide "Press E to interact" indicator |
| Bridge 接口 · Bridge Interface | 向 React 发出事件，接受 React 的命令 · Emit events to React, accept commands from React |

### 关键文件 · Key Files

```
client/src/game/
├── index.ts              # Phaser 游戏配置 + 启动 · Phaser game config + launch
├── scenes/
│   ├── BootScene.ts
│   ├── GameScene.ts
│   └── HUDScene.ts       # 小地图覆盖层 (Phaser, 非 React) · Minimap overlay (Phaser, not React)
├── entities/
│   ├── LocalPlayer.ts
│   ├── RemotePlayer.ts
│   └── NPC.ts
├── map/
│   └── TileMapManager.ts
├── input/
│   └── KeyboardController.ts
└── bridge.ts             # 游戏 ↔ React 通信 · Game ↔ React communication
```

---

## 角色 C：前端 — UI 层 · Role C: Frontend — UI Layer

**范围 · Scope**: React — 游戏画布之外的所有面板、覆盖层、表单和界面。· all panels, overlays, forms, and screens outside the game canvas.

### 模块 · Modules

| 模块 · Module | 描述 · Description |
|--------|-------------|
| 加入界面 · Join Screen | 名字输入、头像选择器、"进入校园"按钮 · Name input, avatar picker, "Enter Campus" button |
| 聊天面板 · Chat Panel | 消息列表、文本输入、自动滚动、未读标记 · Message list, text input, auto-scroll, unread badge |
| 资料卡片 · Profile Card | 点击玩家时显示：名字、头像、标签、好友按钮 · Shown on player click: name, avatar, tags, friend button |
| 好友请求提示 · Friend Request Toast | 滑入通知 + 接受/拒绝 · Slide-in notification + accept/reject |
| 好友列表 · Friends List | 显示在线/离线好友的侧边栏 · Sidebar showing online/offline friends |
| HUD 覆盖层 · HUD Overlay | 玩家数量、当前区域名称、连接状态 · Player count, current zone name, connection status |
| WebSocket Bridge | Socket.IO 客户端封装、事件 → React 状态 · Socket.IO client wrapper, event → React state |

### 关键文件 · Key Files

```
client/src/ui/
├── App.tsx                   # 根组件，挂载 Phaser · Root component, mounts Phaser
├── screens/
│   └── JoinScreen.tsx
├── components/
│   ├── ChatPanel.tsx
│   ├── ProfileCard.tsx
│   ├── FriendsList.tsx
│   ├── FriendToast.tsx
│   └── HUD.tsx
├── hooks/
│   ├── useSocket.ts
│   ├── useChat.ts
│   └── useFriends.ts
└── store/
    └── gameStore.ts          # 共享状态 (Zustand 或 Context) · Shared state (Zustand or Context)
```

---

## 角色 D（+1）：内容与资产 · Role D (+1): Content & Assets

**范围 · Scope**: 所有创意资产和数据——工作量"较轻"的角色。· All creative assets and data — the "lighter" workload.

### 模块 · Modules

| 模块 · Module | 描述 · Description |
|--------|-------------|
| 像素瓦片集 · Pixel Tileset | 32×32 瓦片：草地、路径、水面、建筑墙壁/地板 · 32×32 tiles: grass, path, water, building walls/floors |
| 角色精灵 · Character Sprites | 4 方向行走 + 空闲帧（每方向约 4 帧），用于 6–8 个头像预设 · 4-direction walk + idle frames (~4 frames per direction) for 6–8 avatar presets |
| NPC 精灵 · NPC Sprites | 8–12 个独特 NPC 角色精灵（可复用角色基础并加以变化）· 8–12 unique NPC character sprites (can reuse character base with variations) |
| 地图设计 · Map Design | Tiled `.tmz`/`.json` 地图文件：融合粤海地标、可行走层、碰撞层 · Tiled `.tmz`/`.json` map file: fused Yuèhǎi landmarks, walkable layer, collision layer |
| NPC 配置 · NPC Configuration | `npcs.json`：NPC 放置（x, y, 名称, 描述, 头像）· `npcs.json`: NPC placement (x, y, name, description, avatar) |
| NPC 对话 · NPC Dialogue | `npc-dialogues.json`：每个 NPC 3–5 行对话，校园主题风味文本 · `npc-dialogues.json`: 3–5 lines per NPC, campus-themed flavor text |
| UI 样式 · UI Style | CSS 调色板、字体选择、面板设计（与角色 C 协作）· CSS color palette, font choices, panel design (collaborate with Role C) |

### 关键文件 · Key Files

```
client/public/assets/
├── tilesets/
│   └── campus-tileset.png
├── sprites/
│   ├── avatars/
│   │   ├── avatar_01.png … avatar_08.png
│   └── npcs/
│       ├── npc_librarian.png … npc_chef.png
├── maps/
│   └── yuehai-campus.json       # Tiled 导出 · Tiled export
└── ui/
    └── palette.css

server/data/
├── npcs.json
└── npc-dialogues.json
```

### 依赖关系 · Dependency: 角色 D 创建角色 B 和 C 所需的资产。他们应先交付瓦片集 + 地图 JSON（解除角色 B 的阻塞），然后是精灵（完全解除角色 B 的阻塞），最后是 NPC 配置（解除角色 A 的 NPC 引擎测试阻塞）。

> Role D creates assets that Roles B and C consume. They should deliver the tileset + map JSON first (unblocks Role B), then sprites (unblocks Role B fully), then NPC config (unblocks Role A's NPC engine testing).

---

## 依赖关系图 · Dependency Graph

```
角色 D (资产) · Role D (Assets)
  │
  ├── 瓦片集 + 地图 JSON ─────► 角色 B (游戏层) · Role B (Game Layer)
  │   tileset + map JSON             │
  │                                   │
  ├── 精灵 · sprites ─────────►      │
  │                                   ▼
  ├── NPC 配置 ─────► 角色 A (后端) · Role A (Backend)
  │   NPC config            │
  │                         │
  └── UI 调色板 ──► 角色 C (UI) · Role C (UI)
      UI palette
```

- **角色 A** 和 **角色 B** 可以从第一天开始并行开发（角色 A：服务器脚手架；角色 B：使用占位矩形的 Phaser 脚手架）
  > **Role A** and **Role B** can start in parallel on day 1 (Role A: server scaffold; Role B: Phaser scaffold with placeholder rectangles)
- **角色 C** 可以从第一天开始使用模拟数据（硬编码消息、假玩家列表）
  > **Role C** can start day 1 with mock data (hardcoded messages, fake player list)
- **角色 D** 应先交付瓦片集（解除 B 的阻塞），然后是精灵，最后是 NPC 数据
  > **Role D** should deliver tileset first (unblocks B), then sprites, then NPC data

---

## 推荐的第一周排期 · Recommended First Week Sequencing

| 天 · Day | 角色 A · Role A | 角色 B · Role B | 角色 C · Role C | 角色 D · Role D |
|-----|--------|--------|--------|--------|
| 1 | Socket.IO 脚手架，连接守卫<br>Socket.IO scaffold, connection guard | Phaser 启动 + 空场景<br>Phaser boot + empty scene | React 脚手架 + JoinScreen<br>React scaffold + JoinScreen | 在纸上草绘校园地图布局<br>Sketch campus map layout on paper |
| 2 | 玩家加入/断连处理<br>Player join/disconnect handlers | TileMap 加载（占位网格）<br>TileMap loading (placeholder grid) | WebSocket hook, ChatPanel 骨架<br>WebSocket hook, ChatPanel skeleton | 创建瓦片集精灵表<br>Create tileset spritesheet |
| 3 | 区域管理器 + 移动广播<br>Zone manager + movement broadcast | 本地玩家移动 + 镜头<br>Local player movement + camera | ProfileCard + friend hooks | 在 Tiled 编辑器中构建地图<br>Build map in Tiled editor |
| 4 | 聊天转发 + 好友系统<br>Chat relay + friend system | 远程玩家生成 + 插值<br>Remote player spawning + interpolation | 将 UI 接入真实 socket 事件<br>Wire UI to real socket events | 角色精灵（4 个头像）<br>Character sprites (4 avatars) |
| 5 | NPC 引擎<br>NPC engine | NPC 渲染 + 近距离指示器<br>NPC rendering + proximity indicator | FriendsList + 打磨<br>FriendsList + polish | NPC 精灵 + 对话编写<br>NPC sprites + dialogue writing |
| 6 | 集成测试<br>Integration testing | 集成测试<br>Integration testing | 集成测试<br>Integration testing | 剩余头像 + 地图打磨<br>Remaining avatars + map polish |
| 7 | Bug 修复 + 部署<br>Bug fixes + deploy | Bug 修复<br>Bug fixes | Bug 修复<br>Bug fixes | 最终对话检查<br>Final dialogue pass |
