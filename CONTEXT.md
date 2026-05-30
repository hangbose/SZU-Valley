# SZU Valley — 领域上下文 · Domain Context

SZU Valley 的权威术语表。当某个术语出现在代码、文档或对话中时，它的含义必须与此文件完全一致。

> The canonical glossary for SZU Valley. When a term appears in code, docs, or conversation, it must mean exactly what this file says.

---

## 核心实体 · Core Entities

### 玩家 · Player

一个由真人控制、在校园地图上的角色。玩家拥有一个显示名称、一个头像（加入时从预设中选择）以及一个以瓦片坐标表示的 `(x, y)` 位置。玩家通过方向输入持续移动，并对附近的其他玩家可见。

与 NPC 不同。一个玩家占用 50 个服务器槽位之一。

> A human-controlled character on the campus map. A Player has a display name, an avatar (chosen from presets at join time), and a position `(x, y)` measured in tile coordinates. Players move continuously via directional input and are visible to other nearby players.
>
> Distinct from NPC. A Player occupies one of the 50 server slots.

### NPC

一个由服务器控制、放置在地图固定位置的角色。NPC 拥有名称、头像和预设对话——当玩家点击它们时返回的预设文本。NPC 永远在线，不能移动，不占用玩家槽位。

NPC 的存在是为了让地图永远不会感到空荡：如果附近没有真实玩家，玩家仍然可以走到 NPC 面前聊天。

> A server-controlled character placed at fixed positions on the map. NPCs have a name, an avatar, and seeded dialogue — preset text responses returned when a Player clicks on them. NPCs are always online, cannot move, and do not consume player slots.
>
> NPCs exist so that the map never feels empty: if no real players are nearby, a Player can still walk up to an NPC and chat.

### 瓦片 · Tile

地图的原子空间单元。一个 **32×32 像素**的正方形。每个实体的位置以瓦片坐标表示，其中 `(0, 0)` 是地图的左上角。瓦片有一个 `walkable` 标志；不可行走的瓦片（墙壁、水面、尚未实现的建筑内部）会阻挡移动。

> The atomic spatial unit of the map. A square of **32×32 pixels**. Every entity's position is expressed in tile coordinates, where `(0, 0)` is the top-left corner of the map. Tiles have a `walkable` flag; non-walkable tiles (walls, water, building interiors not yet implemented) block movement.

### 区域 · Zone

用于网络兴趣管理的矩形瓦片分组。地图被划分为多个区域（例如每个区域 16×12 瓦片）。玩家只接收自己所在区域及其 8 个紧邻区域（摩尔邻域）内的实体的位置更新。这限制了每个玩家的消息速率，无论总在线人数如何。

> A rectangular grouping of tiles used for network-interest management. The map is partitioned into zones (e.g. 16×12 tiles each). A Player receives position updates only for entities in their own zone and the 8 immediately adjacent zones (Moore neighborhood). This bounds the per-player message rate regardless of total online count.

### 近距离交互 · Proximity Interaction

当两个玩家（或一个玩家与一个 NPC）处于 **3 个瓦片**（曼哈顿距离）以内时，玩家可以发起交互：查看个人资料、开始聊天，或（仅限真实玩家）发送好友请求。当目标在范围内时，UI 会显示交互提示。

> When two Players (or a Player and an NPC) are within **3 tiles** (Manhattan distance), the Player may initiate interaction: view profile, start chat, or (for real Players only) send a friend request. The UI shows an interaction prompt when a target is in range.

### 好友关系 · Friendship

两个玩家之间的双向关系。好友在线时会在地图上显示高亮标记。好友关系通过请求/接受握手建立。

> A bidirectional relationship between two Players. Friends appear with a highlight marker on the map when online. Friendship is established via request/accept handshake.

### 预设对话 · Seeded Dialogue

存储在 `server/data/npc-dialogues.json` 中的预写文本。每个 NPC 有一行或多行对话。服务器选择一行（随机或按简单规则）并在收到 `npc.talk` 时返回。第一版中对话为纯文本；后续可能添加富文本格式或条件判断。

> Pre-authored text stored in `server/data/npc-dialogues.json`. Each NPC has one or more dialogue lines. The server selects a line (randomly, or by a simple rule) and returns it when `npc.talk` is received. Dialogue is plain text in the first version; rich formatting or conditionals may be added later.

---

## V1 产品边界 · Product Boundaries (v1)

| 范围内 · In scope | 范围外 · Out of scope |
|----------|-------------|
| 输入名字 → 选择头像 → 加入地图 | 邮箱 / 学号 / OAuth 登录 |
| Enter name → pick avatar → join map | Email / student-ID / OAuth login |
| 在瓦片地图上连续行走 | 载具、奔跑、传送 |
| Walk continuously on tile map | Vehicles, running, teleport |
| 查看附近玩家资料 | 全局玩家搜索 |
| View nearby player profiles | Global player search |
| 与附近玩家进行 1:1 实时聊天 | 群聊、公共喊话、离线消息 |
| 1:1 real-time chat with nearby players | Group chat, public shout, offline messages |
| 发送 / 接受好友请求 | 屏蔽 / 静音 / 举报 |
| Send / accept friend requests | Block / mute / report |
| 与 NPC 进行预设对话 | NPC 任务、分支对话、AI 生成聊天 |
| Talk to NPCs with seeded dialogue | NPC quests, branching dialogue, AI-generated chat |
| 最多 50 个并发玩家 | 水平扩展、多服务器 |
| Max 50 concurrent players | Horizontal scaling, multiple servers |
| 粤海校区地标融合为一张地图 | 独立丽湖校区地图、真实地理精度 |
| Yuèhǎi campus landmarks fused into one map | Separate Lìhú campus map, real-world geo accuracy |

---

## 明确排除的概念 · Explicit Non-Concepts

以下术语不应出现在代码或文档中——它们描述的是我们在 v1 中有意不建模的东西：

> These terms should NOT appear in code or docs — they describe things we are deliberately NOT modelling in v1:

- **账户 / 认证 · Account / Auth** — 没有登录。玩家是临时的；你输入的名字就是你当次会话的身份。
  > no login. A Player is ephemeral; the name you type is who you are for that session.
- **匹配系统 · Matchmaking** — 没有算法配对。找人完全是空间驱动的（到处走走，看看谁在那里）。
  > no algorithmic pairing. Finding people is entirely spatial (walk around, see who's there).
- **背包 / 道具 · Inventory / Items** — 没有游戏道具。这是一个社交空间，不是 RPG。
  > no game items. This is a social space, not an RPG.
