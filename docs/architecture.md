# 系统架构 · Architecture

系统如何组合在一起，每个部分负责什么，以及我们为什么这样选择。

> How the system fits together, what each piece owns, and why we chose it.

---

## 系统架构图 · System Diagram

```
┌─────────────────────────────────────────────────────┐
│                   浏览器 · Browser                    │
│  ┌───────────────────────────────────────────────┐  │
│  │              React UI 层 · UI Layer             │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────┐  │  │
│  │  │JoinScreen│ │ChatPanel │ │ProfileCard   │  │  │
│  │  │ 加入界面  │ │ 聊天面板  │ │  资料卡片     │  │  │
│  │  └──────────┘ │          │ │              │  │  │
│  │               │ Messages │ │ Name, Tags   │  │  │
│  │               │ 消息列表  │ │ 名字, 标签    │  │  │
│  │               │ Input    │ │ Add Friend   │  │  │
│  │               │ 输入框    │ │ 添加好友      │  │  │
│  │               └──────────┘ └──────────────┘  │  │
│  │  ┌──────────┐ ┌──────────────────────────┐   │  │
│  │  │FriendsList│ │HUD (minimap, status)     │   │  │
│  │  │ 好友列表  │ │HUD (小地图, 状态)         │   │  │
│  │  └──────────┘ └──────────────────────────┘   │  │
│  └───────────────────────────────────────────────┘  │
│                      ▲                               │
│                      │ state · 状态                   │
│                      ▼                               │
│  ┌───────────────────────────────────────────────┐  │
│  │            Phaser.js 游戏层 · Game Layer        │  │
│  │  ┌──────────┐ ┌────────┐ ┌────────────────┐  │  │
│  │  │TileMap   │ │Player  │ │Camera (follow) │  │  │
│  │  │ 瓦片地图  │ │Sprite  │ │镜头 (跟随)      │  │  │
│  │  │(Tiled)   │ │玩家精灵 │ │                │  │  │
│  │  └──────────┘ └────────┘ └────────────────┘  │  │
│  │  ┌──────────┐ ┌────────┐ ┌────────────────┐  │  │
│  │  │NPCSprite │ │Remote  │ │Collision       │  │  │
│  │  │ NPC精灵   │ │Players │ │(walkable tiles)│  │  │
│  │  │          │ │远程玩家 │ │碰撞 (可行走瓦片)│  │  │
│  │  └──────────┘ └────────┘ └────────────────┘  │  │
│  └───────────────────────────────────────────────┘  │
│                      ▲                               │
│                      │ events · 事件                  │
│                      ▼                               │
│  ┌───────────────────────────────────────────────┐  │
│  │         WebSocket 客户端 (Socket.IO)            │  │
│  │         WebSocket Client                       │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                       │
                       │ wss://
                       ▼
┌─────────────────────────────────────────────────────┐
│              Node.js 服务器 (:3001) · Server           │
│  ┌───────────────────────────────────────────────┐  │
│  │            Socket.IO 服务器 · Server            │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────┐  │  │
│  │  │Join      │ │Movement  │ │Chat Relay    │  │  │
│  │  │加入处理   │ │移动广播   │ │聊天转发       │  │  │
│  │  │Handler   │ │Broadcast │ │              │  │  │
│  │  └──────────┘ └──────────┘ └──────────────┘  │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────┐  │  │
│  │  │Friend    │ │NPC Talk  │ │Disconnect    │  │  │
│  │  │好友处理   │ │NPC对话   │ │断开连接处理   │  │  │
│  │  │Handler   │ │Handler   │ │Handler       │  │  │
│  │  └──────────┘ └──────────┘ └──────────────┘  │  │
│  └───────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────┐  │
│  │            区域管理器 · Zone Manager            │  │
│  │  追踪哪个玩家在哪个区域                           │  │
│  │  Tracks which player is in which zone         │  │
│  │  移动时：计算新区域，重新订阅                      │  │
│  │  On move: computes new zone, re-subscribes    │  │
│  │  仅向本区域 + 8 个邻居广播                       │  │
│  │  Broadcasts only to zone + 8 neighbors        │  │
│  └───────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────┐  │
│  │            NPC 引擎 · NPC Engine               │  │
│  │  加载 npcs.json + npc-dialogues.json          │  │
│  │  Loads npcs.json + npc-dialogues.json        │  │
│  │  在 npc.talk 事件时提供对话                      │  │
│  │  Serves dialogue on npc.talk events           │  │
│  │  玩家加入时广播所属区域的 NPC 列表                 │  │
│  │  Broadcasts NPC list per zone on join         │  │
│  └───────────────────────────────────────────────┘  │
│         │                        │                   │
│         ▼                        ▼                   │
│  ┌────────────┐          ┌────────────┐              │
│  │ PostgreSQL │          │   Redis    │              │
│  │            │          │            │              │
│  │ • 玩家     │          │ • 位置     │              │
│  │   players  │          │   positions│              │
│  │ • 好友     │          │   (实时)   │              │
│  │   friends  │          │   (live)   │              │
│  │ • 消息     │          │ • 在线集合 │              │
│  │   messages │          │   online   │              │
│  └────────────┘          │   set      │              │
│                          └────────────┘              │
└─────────────────────────────────────────────────────┘
```

---

## 各层职责 · Layer Responsibilities

### Phaser.js（游戏层）· Game Layer

- 加载并渲染 Tiled `.tmx`/`.json` 瓦片地图
  > Load and render the Tiled `.tmx`/`.json` tilemap
- 为本地玩家精灵制作动画（空闲 / 四方向行走）
  > Animate the local player sprite (idle / walk directions)
- 在两次更新之间平滑插值远程玩家位置
  > Smoothly interpolate remote player positions between updates
- 强制执行基于瓦片的碰撞检测（墙壁、水面）
  > Enforce tile-based collision (walls, water)
- 用镜头跟随本地玩家
  > Follow the local player with the camera
- 向上层 React 发送事件（例如 `player-clicked`、`npc-clicked`、`position-changed`）
  > Emit events upward to React (e.g. `player-clicked`, `npc-clicked`, `position-changed`)

Phaser 不知道聊天、好友或资料的存在。它只负责触发事件；React 负责监听。

> Phaser does NOT know about chat, friends, or profiles. It fires events; React listens.

### React（UI 层）· UI Layer

- 加入界面（名字输入、头像选择器）
  > Join screen (name input, avatar picker)
- 聊天面板（消息列表、文本输入、发送按钮）
  > Chat panel (message list, text input, send button)
- 资料卡片（点击附近玩家时显示）
  > Profile card (shown when clicking a nearby player)
- 好友请求提示 + 好友列表侧边栏
  > Friend request toast + friends list sidebar
- HUD 覆盖层（在线人数、小地图）
  > HUD overlay (online count, minimap)
- 管理 UI 状态（哪个面板打开、未读计数等）
  > Manages UI state (which panel is open, unread count, etc.)

React 不渲染到游戏画布上。它位于 Phaser 画布上方的 DOM 元素中。

> React does NOT render to the game canvas. It sits in DOM elements positioned above Phaser's canvas.

### 通信桥梁 · Communication Bridge

一个共享模块（`client/src/network/`），两个层都使用：

> A shared module (`client/src/network/`) that both layers use:

- **Phaser → Bridge**: `bridge.onMove(x, y)`, `bridge.onClickPlayer(id)`, `bridge.onClickNPC(id)`
- **Bridge → React**: `bridge.onChatReceive(msg)`, `bridge.onProfileView(data)`, `bridge.onFriendRequest(from)`
- **Bridge ↔ Server**: 原始 Socket.IO 事件 · Raw Socket.IO events

### Node.js 服务器 · Server

- **加入处理 · Join Handler**: 验证名字，分配出生点，创建 Player 记录，向所在区域广播
  > validate name, assign spawn point, create Player record, broadcast to zone
- **移动广播 · Movement Broadcast**: 接收 `player.move`，更新 Redis 位置，向区域订阅者广播
  > receive `player.move`, update Redis position, broadcast to zone subscribers
- **聊天转发 · Chat Relay**: 接收 `chat.send`，验证目标在范围内，投递消息
  > receive `chat.send`, verify target is in range, deliver
- **好友处理 · Friend Handler**: 创建/接受好友请求，持久化到 PostgreSQL
  > create/accept friend request, persist to PostgreSQL
- **NPC 引擎 · NPC Engine**: 在 `npc.talk` 时查找 NPC 对话，返回对话行
  > on `npc.talk`, look up NPC dialogue, return line
- **区域管理 · Zone Manager**: 跟踪区域成员，管理订阅，处理断线
  > track zone memberships, manage subscriptions, handle disconnects
- **连接守卫 · Connection Guard**: 当 `online_count >= 50` 时拒绝连接
  > reject connections when `online_count >= 50`

### 数据存储 · Data Stores

| 数据 · Data | 存储 · Store | 原因 · Reason |
|------|-------|--------|
| 玩家资料 · Player profiles | PostgreSQL | 持久化、关系型 · Persistent, relational |
| 好友关系 · Friendship edges | PostgreSQL | 需要 join 查询 · Needs join queries |
| 聊天记录 · Chat history | PostgreSQL | 审计追踪、历史回溯 · Audit trail, scroll-back |
| 实时位置 · Live positions | Redis | 易失、高写入、亚毫秒读取 · Volatile, high-write, sub-ms reads |
| 在线玩家集合 · Online player set | Redis | `SADD`/`SREM`/`SCARD` 计数 · `SADD`/`SREM`/`SCARD` for count |
| NPC 配置 · NPC config | JSON 文件 | 静态，无需数据库 · Static, no DB needed |
| NPC 对话 · NPC dialogue | JSON 文件 | 静态，易于编辑 · Static, easy to edit |

---

## 数据流：移动 · Data Flow: Movement

```
1. 玩家按下右箭头键 · Player presses ArrowRight
2. Phaser 在本地更新精灵位置（平滑）· Phaser updates sprite position locally (smooth)
3. 每 ~50ms，Phaser 通过 bridge 发送 { x, y, direction }
   Every ~50ms, Phaser sends { x, y, direction } via bridge
4. Bridge 向服务器发送 player.move · Bridge emits player.move to server
5. 服务器更新 Redis: SET pos:<playerId> {x, y}
   Server updates Redis: SET pos:<playerId> {x, y}
6. 服务器计算新位置所在的区域 · Server computes zone for new position
7. 服务器向区域内 + 邻居区域的所有 socket 广播 player.moved
   Server broadcasts player.moved to all sockets in zone + neighbors
8. 每个接收的客户端的 Phaser 层更新远程精灵目标位置
   Each receiving client's Phaser layer updates remote sprite target position
9. 远程精灵平滑插值向目标移动 · Remote sprites smoothly interpolate toward target
```

## 数据流：聊天 · Data Flow: Chat

```
1. 玩家 A 点击玩家 B（3 格以内）→ React 显示 ProfileCard
   Player A clicks Player B (within 3 tiles) → React shows ProfileCard
2. 玩家 A 点击"聊天"→ React 打开 ChatPanel
   Player A clicks "Chat" → React opens ChatPanel
3. 玩家 A 输入消息，按回车 · Player A types message, hits Enter
4. Bridge 发送 chat.send { to: playerBId, text: "hi!" }
   Bridge sends chat.send { to: playerBId, text: "hi!" }
5. 服务器验证 A 和 B 在范围内 · Server verifies A and B are within range
6. 服务器将消息持久化到 PostgreSQL · Server persists message to PostgreSQL
7. 服务器向玩家 B 发送 chat.receive { from: playerAId, text: "hi!" }
   Server emits chat.receive { from: playerAId, text: "hi!" } to Player B
8. 玩家 B 的 React ChatPanel 追加消息 · Player B's React ChatPanel appends the message
```

---

## 部署拓扑 · Deployment Topology

```
    ┌──────────────────────────┐
    │   Vercel (静态托管)       │
    │   Vercel (static host)   │
    │   client/dist/**         │
    └──────┬───────────────────┘
           │ HTTPS
           ▼
    ┌──────────────┐
    │  CDN / Edge  │
    └──────┬───────┘
           │
           ▼
    ┌──────────────────────────────────────────┐
    │  用户浏览器 · User Browser                 │
    │  ┌────────────────────────────────────┐   │
    │  │ index.html → Phaser + React 启动   │   │
    │  │ index.html → Phaser + React boots  │   │
    │  └────────────────────────────────────┘   │
    │  ┌────────────────────────────────────┐   │
    │  │ Socket.IO → wss://app:3001         │   │
    │  └────────────────────────────────────┘   │
    └──────────────┬───────────────────────────┘
                   │ WSS
                   ▼
    ┌──────────────────────────────────────────┐
    │  Railway / Fly.io / VPS                   │
    │  ┌──────────┐ ┌──────────┐ ┌──────────┐ │
    │  │ Node.js  │ │PostgreSQL│ │  Redis   │ │
    │  │ :3001    │ │ :5432    │ │ :6379    │ │
    │  └──────────┘ └──────────┘ └──────────┘ │
    └──────────────────────────────────────────┘
```

对于最便宜可行的方案：单台 VPS 通过 Docker Compose 运行全部三个服务（Node + PG + Redis），用 Nginx 反向代理 `wss://` 连接。Railway 的免费额度也适用，如果更偏好 Docker Compose 的话。

> For the cheapest viable setup: a single VPS running all three (Node + PG + Redis) via Docker Compose, with Nginx reverse-proxying `wss://` connections. Railway's free tier also works if Docker Compose is preferred.

---

## 关键设计决策 · Key Design Decisions

1. **服务器权威位置 · Server-authoritative positions** — 服务器是"谁在哪里"的唯一真相来源。客户端在本地做预测（为了平滑移动），但会根据服务器更新进行修正。这防止了位置作弊。
   > the server is the source of truth for who is where. The client predicts locally (for smooth movement) but corrects on server updates. This prevents position hacking.

2. **基于区域的广播，而非全局广播 · Zone-based broadcast, not global** — 在图书馆的玩家不会收到文山湖的位置更新。区域机制使每个玩家的带宽保持恒定，无论总在线人数如何。
   > a player at the Library does not receive position updates from Wenshan Lake. Zones keep per-player bandwidth constant regardless of total online count.

3. **Phaser 做游戏，React 做 UI · Phaser for game, React for UI** — 游戏引擎擅长渲染；UI 框架擅长表单和列表。结合两者避免了构建两者的劣质模仿。
   > game engines do rendering well; UI frameworks do forms and lists well. Combining them avoids building a poor imitation of either.

4. **无会话持久化 · No session persistence** — 关闭标签页，你就从地图上消失了。好友关系和聊天记录在 PostgreSQL 中保留，但玩家"槽位"是临时的。这极大地简化了状态管理。
   > close the tab, you're gone from the map. Friendships and chat history survive in PostgreSQL, but the player "slot" is ephemeral. This simplifies state management dramatically.
