# 团队分工 · 2+1+1 模式 · Team Division · 2+1+1 Model

后端拆两份（实时服务 + 社交数据），前端合一份（游戏层 + UI 层），资产一份。共 4 人。

> Backend split in two (real-time services + social/data), frontend merged into one (game layer + UI layer), plus one for assets. 4 people total.

---

## 为什么这么拆 · Why This Split

**后端拆开**：A 的 Zone Manager 是整个项目最复杂的单模块，Movement 是最高频路径。把它们和社交/数据库逻辑混在一起会让一个人过载。两部分职责天然不同——一个跟空间和性能打交道，一个跟业务和存储打交道。

> **Backend split**: Zone Manager is the single most complex module; Movement is the hottest path. Putting them together with social/DB logic overloads one person. The two halves have different natures — one deals with space & performance, the other with business logic & storage.

**前端合并**：B（Phaser）和 C（React）之间有一个 bridge 接口。一个人同时做两边，bridge 就是自己的左手和右手——零沟通成本、调试不用跨人排查。代价是一个人需要会两套技术栈，但总时间比两个人各做一半更短。

> **Frontend merged**: B (Phaser) and C (React) share a bridge interface. One person owning both sides makes the bridge their own left and right hand — zero communication overhead, no cross-person debugging. The trade-off is needing both tech stacks, but total time is shorter than two people coordinating.

---

## 角色 A1：后端 — 实时游戏服务 · Role A1: Backend — Real-time Game Services

**范围 · Scope**: 所有与空间、位置、实时广播相关的服务端逻辑。整个项目最硬核的部分。

> All server-side logic related to space, position, and real-time broadcast. The most technically challenging part of the project.

### 模块 · Modules

| 模块 · Module | 描述 · Description |
|--------|-------------|
| Socket.IO 服务器 · Socket.IO server | 连接生命周期、事件路由、房间管理 · Connection lifecycle, event routing, room management |
| Zone Manager · 区域管理器 | **最核心模块**。区域分配、邻居计算、跨区订阅/退订、按区域广播 · **Core module**. Zone assignment, neighbor calculation, cross-zone subscribe/unsubscribe, zone-scoped broadcast |
| Movement System · 移动系统 | **最高频模块**。位置校验（防瞬移作弊）、Redis 读写、~20次/秒/人的广播 · **Hottest module**. Position validation (anti-teleport cheat), Redis read/write, ~20 broadcasts/sec/player |
| Connection Guard · 连接守卫 | 50 人上限检查、名字唯一性校验 · 50-player cap, name uniqueness check |
| NPC Engine · NPC 引擎 | 加载 JSON 配置到内存、按区域广播 NPC 列表、响应 `npc.talk` 返回随机对话 · Load JSON configs into memory, broadcast NPC lists per zone, respond to `npc.talk` with random dialogue |
| Redis Schema · Redis 模式 | `online:players` 集合（SADD/SREM/SCARD）、`pos:{playerId}` 字符串（SET/GET/DEL + TTL）· `online:players` set (SADD/SREM/SCARD), `pos:{playerId}` string (SET/GET/DEL + TTL) |

### A1 对外暴露的查询接口 · Public Query Interface

这些函数给 A2 调用（同一个 Node.js 进程内，不需要 HTTP）：

> Called by A2 within the same Node.js process — no HTTP needed:

```ts
getPlayerPosition(playerId: string): {x: number, y: number} | null
getZonePlayers(zoneId: number): Player[]
getZoneNeighbors(zoneId: number): number[]
isOnline(playerId: string): boolean
getOnlineCount(): number
```

### 关键文件 · Key Files

```
server/src/
├── index.ts                  # Socket.IO 入口 · Entry point
├── zone-manager.ts           # 区域管理（最复杂）· Zone management (most complex)
├── connection-guard.ts       # 连接守卫 · Connection guard
├── handlers/
│   ├── movement.ts           # 移动处理（最高频）· Movement handler (hottest)
│   └── npc.ts                # NPC 对话处理 · NPC talk handler
├── game/
│   └── position-validator.ts # 位置校验（防作弊）· Position validation (anti-cheat)
├── redis.ts                  # Redis 客户端封装 · Redis client wrapper
└── data/
    ├── npcs.json
    └── npc-dialogues.json
```

---

## 角色 A2：后端 — 社交逻辑 + 数据 + 部署 · Role A2: Backend — Social Logic + Data + Deployment

**范围 · Scope**: 所有与玩家身份、社交关系、消息持久化、数据库和部署相关的服务端逻辑。模块多但每个比 A1 简单。

> All server-side logic related to player identity, social relationships, message persistence, database, and deployment. More modules but each is simpler than A1's.

### 模块 · Modules

| 模块 · Module | 描述 · Description |
|--------|-------------|
| Join Handler · 加入处理 | 名字校验（2-12字符）、分配 UUID + 出生点、写 PostgreSQL + Redis、通知 A1 做 zone 订阅 · Name validation (2-12 chars), assign UUID + spawn point, write PostgreSQL + Redis, tell A1 to subscribe to zone |
| Chat Relay · 聊天转发 | 频率限制（5条/秒）、调用 A1 做距离验证（≤3格）、写 PostgreSQL、投递消息 · Rate limit (5/sec), call A1 for distance check (≤3 tiles), write PostgreSQL, deliver message |
| Friend System · 好友系统 | `friend.request` → `friend.accept` / `friend.reject` 三态流转、双向关系写入 PostgreSQL、通知双方 · Request → Accept/Reject state machine, bidirectional relationship in PostgreSQL, notify both parties |
| PostgreSQL Schema · 数据库模式 | `players`、`friendships`、`friend_requests`、`chat_messages` 表设计 + 索引 + 迁移脚本 · Table design + indexes + migration scripts |
| Deployment · 部署 | Docker Compose（Node.js + PostgreSQL + Redis + Nginx）、环境变量配置、Nginx wss:// 反向代理 · Docker Compose (Node.js + PostgreSQL + Redis + Nginx), env config, Nginx wss:// reverse proxy |

### A2 对外暴露的查询接口 · Public Query Interface

这些函数给 A1 调用（同一个 Node.js 进程内）：

> Called by A1 within the same Node.js process:

```ts
getPlayerProfile(playerId: string): Profile | null
isFriend(playerA: string, playerB: string): boolean
getFriendsList(playerId: string): Friend[]
saveChatMessage(from: string, to: string, text: string): Message
```

### A1 与 A2 的协作边界 · A1/A2 Collaboration Boundary

聊天（Chat）是两个角色交汇的地方：

> Chat is where the two roles intersect:

```
收到 chat.send → A2 的 chat handler 处理
  ├─ A2 做频率限制
  ├─ A2 调用 A1.getPlayerPosition() 验证距离 ≤ 3 格
  ├─ A2 写 PostgreSQL（message 持久化）
  └─ A2 投递 chat.receive 给目标 socket
```

A2 拥有 chat handler，但它借用 A1 的位置查询。不需要 HTTP——同一个进程内的函数调用。

> A2 owns the chat handler but borrows A1's position query. No HTTP — just function calls within the same process.

### 关键文件 · Key Files

```
server/src/
├── handlers/
│   ├── join.ts               # 加入处理 · Join handler
│   ├── chat.ts               # 聊天转发 · Chat relay
│   └── friends.ts            # 好友系统 · Friend system
├── social/
│   └── friend-state.ts       # 好友请求状态机 · Friend request state machine
├── db/
│   ├── pool.ts               # PostgreSQL 连接池 · Connection pool
│   ├── migrations/
│   │   └── 001_init.sql
│   └── queries/
│       ├── players.ts
│       ├── friendships.ts
│       └── messages.ts
├── Dockerfile
├── docker-compose.yml
├── nginx.conf
└── .env.example
```

---

## 角色 BC：全栈前端 · Role BC: Full-stack Frontend

**范围 · Scope**: Phaser.js 游戏层 + React UI 层 + 两者之间的 bridge 接口。一个人同时掌握画布上和画布外的所有代码。

> Phaser.js game layer + React UI layer + the bridge between them. One person owns everything on and above the canvas.

### 为什么合并 · Why Merge

B 和 C 之间通过 bridge 通信——Phaser 发现事件（谁靠近了、谁被点了），React 决定如何响应（弹什么面板、发什么请求）。一个人做两边，bridge 接口没有沟通成本，不会出现"你改了事件名没告诉我"的情况。

> B and C communicate through a bridge — Phaser detects events (who's nearby, who was clicked), React decides how to respond (which panel to show, what request to send). One person on both sides means zero communication overhead on the bridge — no "you changed the event name and didn't tell me."

### 模块 · Modules

| 模块 · Module | 描述 · Description |
|--------|-------------|
| **Phaser — 游戏层 · Game Layer** | |
| Boot & Preload · 启动与预加载 | 资源加载、启动画面 · Asset loading, splash screen |
| TileMap Scene · 瓦片地图场景 | 加载 Tiled `.json` 地图、渲染图层、碰撞瓦片 · Load Tiled `.json` map, render layers, collision tiles |
| Local Player · 本地玩家 | 精灵动画（四方向空闲/行走）、键盘输入（方向键/WASD）· Sprite animation (idle/walk 4-dir), keyboard input (arrows/WASD) |
| Remote Players · 远程玩家 | 生成/销毁远程精灵、位置平滑插值 · Spawn/despawn remote sprites, smooth position interpolation |
| NPC Sprites · NPC 精灵 | 固定位置渲染 NPC、点击检测 · Render NPCs at fixed positions, click detection |
| Camera · 镜头 | 跟随本地玩家、世界边界限制 · Follow local player, world bounds clamping |
| Proximity Detection · 近距离检测 | 曼哈顿距离 ≤3 格时触发事件 · Emit event when Manhattan distance ≤3 tiles |
| Interaction Prompt · 交互提示 | "按 E 交谈/互动"浮层 · "Press E to interact" floating indicator |
| Minimap · 小地图 | Phaser 内渲染缩略地图覆盖层 · Phaser-rendered minimap overlay |
| **Bridge · 通信桥梁** | |
| Game → UI Events · 游戏到UI事件 | `bridge.onMove`, `bridge.onClickPlayer`, `bridge.onClickNPC` |
| UI → Game Commands · UI到游戏命令 | `bridge.focusPlayer(id)`, `bridge.showIndicator(bool)` |
| Socket Wrapper · Socket封装 | Socket.IO 客户端、事件收发、重连逻辑 · Socket.IO client, event send/receive, reconnection logic |
| **React — UI 层 · UI Layer** | |
| JoinScreen · 加入界面 | 名字输入（2-12字符校验）、头像选择器（8预设）、"进入校园"按钮 · Name input (2-12 char validation), avatar picker (8 presets), "Enter Campus" button |
| ChatPanel · 聊天面板 | 消息气泡列表、输入框（500字符限制）、自动滚底、未读红点 · Message bubble list, input (500 char limit), auto-scroll, unread badge |
| ProfileCard · 资料卡片 | 点玩家时弹出：头像、名字、标签、好友数、在线状态、"聊天"/"加好友"按钮 · Popup on player click: avatar, name, tags, friend count, online status, "Chat"/"Add Friend" buttons |
| FriendToast · 好友请求提示 | 屏幕右上方滑入通知 + 接受/拒绝按钮、3秒自动消失 · Slide-in notification from top-right + accept/reject buttons, auto-dismiss 3s |
| FriendsList · 好友列表 | 侧边栏：在线好友（绿点）+ 离线好友（灰点）、点击名字镜头飞过去 · Sidebar: online friends (green dot) + offline friends (grey dot), click name to fly camera |
| HUD · 抬头显示 | 在线人数 `23/50`、当前区域名、连接状态灯（绿/黄/红）· Online count `23/50`, current zone name, connection status light (green/yellow/red) |
| State Store · 状态管理 | Zustand/Context 全局状态：playerId, onlineCount, friends, chatMessages, pendingRequests · Zustand/Context global state: playerId, onlineCount, friends, chatMessages, pendingRequests |

### 关键文件 · Key Files

```
client/
├── src/
│   ├── main.tsx                     # React 入口 · React entry
│   ├── game/
│   │   ├── index.ts                 # Phaser 游戏配置 + 启动 · Phaser config + launch
│   │   ├── scenes/
│   │   │   ├── BootScene.ts
│   │   │   ├── GameScene.ts
│   │   │   └── HUDScene.ts          # 小地图 (Phaser) · Minimap (Phaser)
│   │   ├── entities/
│   │   │   ├── LocalPlayer.ts
│   │   │   ├── RemotePlayer.ts
│   │   │   └── NPC.ts
│   │   ├── map/
│   │   │   └── TileMapManager.ts
│   │   └── input/
│   │       └── KeyboardController.ts
│   ├── ui/
│   │   ├── App.tsx                  # 根组件，挂载 Phaser · Root component, mounts Phaser
│   │   ├── screens/
│   │   │   └── JoinScreen.tsx
│   │   ├── components/
│   │   │   ├── ChatPanel.tsx
│   │   │   ├── ProfileCard.tsx
│   │   │   ├── FriendsList.tsx
│   │   │   ├── FriendToast.tsx
│   │   │   └── HUD.tsx
│   │   ├── hooks/
│   │   │   ├── useSocket.ts
│   │   │   ├── useChat.ts
│   │   │   └── useFriends.ts
│   │   └── store/
│   │       └── gameStore.ts
│   └── network/
│       ├── bridge.ts                # Phaser ↔ React 事件总线 · event bus
│       └── socket.ts                # Socket.IO 客户端封装 · client wrapper
└── public/
    └── assets/                      # D 的产出放在这里 · D's output goes here
```

### BC 的工作量说明 · Workload Notes

合并后约 16 个模块，比 A1 或 A2 都多。但 bridge 零沟通成本 + 调试不用跨人排查，总时间比 B 和 C 各做一半短。最忙的是第 4-5 天（同时调远程玩家插值和接真实 socket 事件）。

> ~16 modules merged — more than A1 or A2 individually. But zero bridge communication + no cross-person debugging makes total time shorter than B+C separately. Busiest days: 4-5 (remote player interpolation + wiring real socket events simultaneously).

---

## 角色 D：内容与资产 · Role D: Content & Assets

**范围 · Scope**: 所有创意资产和数据文件——不写代码。工作量"较轻"但产出是 A1、A2、BC 的输入。

> All creative assets and data files — no coding. The "lighter" workload, but the output is input for A1, A2, and BC.

### 模块 · Modules

| 模块 · Module | 描述 · Description |
|--------|-------------|
| 像素瓦片集 · Pixel Tileset | 一张 PNG 大图，32×32 格子：草地、路径、水面、建筑墙壁/地板、树、花、长椅、路灯 · One big PNG, 32×32 cells: grass, path, water, building walls/floors, trees, flowers, benches, lamps |
| 地图文件 · Map Design | Tiled 编辑器绘制，导出 `.json`。200×150 瓦片，融合粤海校区地标。必须含三个图层：地面层 + 装饰层 + 碰撞层 · Draw in Tiled editor, export `.json`. 200×150 tiles, fused Yuèhǎi landmarks. Must have 3 layers: ground + decoration + collision |
| 角色精灵 · Character Sprites | 6-8 个头像预设，每个 4 方向 × 2 帧待机 + 4 方向 × 4 帧走路 = 24 帧。32×48 像素/格 · 6-8 avatar presets, each 4 dir × 2 idle frames + 4 dir × 4 walk frames = 24 frames. 32×48 px/cell |
| NPC 精灵 · NPC Sprites | 8-12 个 NPC，每个只需 1-2 帧（不动）。可复用角色模板换配色和衣服 · 8-12 NPCs, 1-2 frames each (don't move). Can reuse character base with different colors/outfits |
| NPC 配置 · NPC Configuration | `npcs.json`：每个 NPC 的 id、name、avatar、x、y、description · `npcs.json`: id, name, avatar, x, y, description per NPC |
| NPC 对话 · NPC Dialogue | `npc-dialogues.json`：每个 NPC 3-5 行对话，中文，校园主题，接地气 · `npc-dialogues.json`: 3-5 lines per NPC, Chinese, campus-themed, relatable |
| UI 调色板 · UI Style | `palette.css`：CSS 变量（--szu-green, --panel-bg, --text-primary 等）。与 BC 商量确定 · `palette.css`: CSS variables (--szu-green, --panel-bg, --text-primary, etc.). Coordinate with BC |

### 关键文件 · Key Files

```
client/public/assets/
├── tilesets/
│   └── campus-tileset.png          # 像素瓦片集大图 · Big pixel tileset image
├── sprites/
│   ├── avatars/
│   │   ├── avatar_01.png … avatar_08.png
│   └── npcs/
│       ├── npc_librarian.png … npc_chef.png
├── maps/
│   └── yuehai-campus.json          # Tiled 导出 · Tiled export
└── ui/
    └── palette.css

server/src/data/
├── npcs.json
└── npc-dialogues.json
```

### 交付顺序（关键路径）· Delivery Order (Critical Path)

```
第 1-2 天：瓦片集 PNG + 地图 JSON  →  BC 能加载真地图，A1 能定义 zone 边界
第 3-4 天：4 个头像精灵             →  BC 能做本地玩家动画
第 4-5 天：NPC 精灵 + npcs.json     →  BC 能渲染 NPC，A1 能测 NPC Engine
第 5-6 天：npc-dialogues.json       →  A1 的 NPC 对话可联调
第 6-7 天：剩余头像 + palette.css   →  BC 做最终样式
```

**瓦片集和地图是整个项目最关键的依赖。D 前两天的产出决定 BC 和 A1 能不能进入正轨。**

> The tileset and map are the single most critical dependency in the project. D's first two days determine whether BC and A1 can get on track.

---

## 依赖关系图 · Dependency Graph

```
角色 D (资产) · Role D (Assets)
  │
  ├── 瓦片集 + 地图 JSON ─────► 角色 BC (全栈前端) · Role BC (Full-stack Frontend)
  │   tileset + map JSON           │
  │                                 │
  ├── 精灵 · sprites ─────────►    │
  │                                 │
  ├── NPC 配置 · NPC config ──► 角色 A1 (实时游戏服务) · Role A1 (Real-time Game)
  │                                 │
  │                                 ├─ getPlayerPosition()
  │                                 ├─ getZonePlayers()
  │                                 └─ isOnline()
  │                                          │
  │                                          ▼
  │                                 角色 A2 (社交+数据+部署) · Role A2 (Social+Data+Deploy)
  │
  └── UI 调色板 · UI palette ──► 角色 BC (全栈前端) · Role BC
```

- **A1** 和 **BC** 可以从第一天开始并行（A1：Socket.IO 脚手架；BC：Phaser + React 脚手架）
  > **A1** and **BC** can start in parallel on day 1 (A1: Socket.IO scaffold; BC: Phaser + React scaffold)
- **A2** 也可以从第一天开始（PostgreSQL schema + Join Handler，不依赖 A1）
  > **A2** can also start day 1 (PostgreSQL schema + Join Handler, no A1 dependency)
- **A2 的 Chat Relay** 需要调 A1 的 `getPlayerPosition()`——这个在第 3-4 天联调
  > **A2's Chat Relay** calls A1's `getPlayerPosition()` — integrate on days 3-4
- **D 必须先交付瓦片集和地图**（解除 BC）→ 精灵（完全解除 BC）→ NPC 配置（解除 A1）
  > **D must deliver tileset + map first** (unblocks BC) → sprites (fully unblocks BC) → NPC config (unblocks A1)

---

## 推荐的第一周排期 · Recommended First Week Sequencing

| 天 · Day | A1 · 实时服务 | A2 · 社交+部署 | BC · 全栈前端 | D · 内容资产 |
|-----|--------|--------|--------|--------|
| 1 | Socket.IO 脚手架，连接守卫<br>Socket.IO scaffold, connection guard | PostgreSQL schema 设计 + 迁移<br>PostgreSQL schema design + migrations | Phaser 空场景 + React 脚手架 + JoinScreen<br>Phaser empty scene + React scaffold + JoinScreen | 纸上草绘校园地图布局<br>Sketch campus map layout on paper |
| 2 | Zone Manager 核心逻辑<br>Zone Manager core logic | Join Handler + Redis online set<br>Join Handler + Redis online set | 占位网格 + 键盘移动 + 镜头 + ChatPanel 骨架<br>Placeholder grid + keyboard movement + camera + ChatPanel skeleton | 创建瓦片集精灵表<br>Create tileset spritesheet |
| 3 | Movement 处理 + 位置校验<br>Movement handler + position validation | Friend System（三态流转）<br>Friend System (state machine) | 本地玩家动画 + 碰撞 + ProfileCard + friend hooks<br>Local player animation + collision + ProfileCard + friend hooks | 在 Tiled 中构建地图<br>Build map in Tiled editor |
| 4 | NPC Engine<br>NPC Engine | Chat Relay（调 A1 距离验证）<br>Chat Relay (call A1 distance check) | **最忙**：远程玩家插值 + UI 接真实 socket 事件<br>**Busiest**: remote player interpolation + wire UI to real socket | 角色精灵（4 个头像）<br>Character sprites (4 avatars) |
| 5 | 联调 A2 + 调试<br>Integrate with A2 + debug | Docker Compose + Nginx 配置<br>Docker Compose + Nginx config | NPC 渲染 + 近距离检测 + FriendsList + HUD<br>NPC rendering + proximity detection + FriendsList + HUD | NPC 精灵 + 对话编写<br>NPC sprites + dialogue writing |
| 6 | 集成测试 + Bug 修复<br>Integration testing + bug fixes | 集成测试 + 部署验证<br>Integration testing + deploy verification | 集成测试 + 打磨 UI<br>Integration testing + UI polish | 剩余头像 + 地图打磨<br>Remaining avatars + map polish |
| 7 | Bug 修复<br>Bug fixes | 生产部署<br>Production deploy | Bug 修复<br>Bug fixes | 最终对话检查<br>Final dialogue pass |

---

## 3 人最小阵容 · 3-Person Minimal Lineup

如果只有 3 人，D 可以裁掉——BC 或 A2 兼职写 NPC 配置 JSON。瓦片集和精灵图用免费像素素材先顶，后续再换。

> If only 3 people, cut D — BC or A2 writes NPC JSON configs part-time. Use free pixel art assets for tileset/sprites initially, replace later.

```
A1（实时游戏服务）＋ A2（社交+数据+部署）＋ BC（全栈前端）＝ 3 人
```
