# WebSocket 通信协议 · WebSocket Protocol

客户端与服务器之间的所有实时通信均使用 Socket.IO。每条消息都有一个**类型**（事件名称）和一个**载荷**（JSON 对象）。字段类型使用 TypeScript 风格的符号描述。

> All real-time communication between client and server uses Socket.IO. Every message has a **type** (event name) and a **payload** (JSON object). Field types are described with TypeScript-style notation.

---

## 连接生命周期 · Connection Lifecycle

```
客户端 · Client            服务器 · Server
  │                          │
  │──── connect ────────────►│  TCP + WebSocket 升级 · upgrade
  │◄─── connected ──────────│  Socket.IO 握手成功 · handshake OK
  │                          │
  │──── player.join ────────►│  名字 + 头像 + 出生点 · Name + avatar + spawn
  │◄─── player.joined ──────│  你的玩家 ID + 出生点 · Your player ID + spawn
  │◄─── zone.players ───────│  你所在区域的实体 · Entities in your zone
  │◄─── zone.npcs ──────────│  你所在区域的 NPC · NPCs in your zone
  │                          │
  │  ... 游戏进行中 ...        │
  │  ... gameplay ...        │
  │                          │
  │◄─── player.appeared ────│  新玩家进入你的区域邻域 · New player in your zone neighborhood
  │◄─── player.left ────────│  玩家离开你的区域邻域 · Player left your zone neighborhood
  │                          │
  │──── disconnect ─────────►│  标签页关闭 / 网络断开 · Tab closed / network loss
  │                          │  服务器清理，广播 player.left
```

不需要心跳机制——Socket.IO 内置的 ping 会处理死连接。

> No heartbeat is needed — Socket.IO's built-in ping handles dead connections.

---

## 客户端 → 服务端消息 · Client → Server Messages

### `player.join`

Socket.IO 连接建立后发送一次。请求进入地图。

> Sent once after Socket.IO connection. Requests entry to the map.

```ts
{
  name: string;        // 2–12 字符，显示在精灵上方 · 2–12 chars, displayed above sprite
  avatar: string;      // 预设键值: "avatar_01" … "avatar_08" · preset key: "avatar_01" … "avatar_08"
}
```

服务器响应：`player.joined`（成功）或 `error`（名字已被占用 / 服务器已满）。

> Server response: `player.joined` (success) or `error` (name taken / server full).

### `player.move`

玩家移动时每秒发送约 20 次。客户端限制最小间隔为 50ms。

> Sent ~20 times/second while the player is moving. Throttled to 50ms minimum interval by the client.

```ts
{
  x: number;           // 瓦片精度浮点数（例如 42.3）· tile-precision float (e.g. 42.3)
  y: number;           // 瓦片精度浮点数（例如 17.8）· tile-precision float (e.g. 17.8)
  direction: "up" | "down" | "left" | "right";
  moving: boolean;
}
```

服务器会验证当前位置与上一 tick 的位置增量是否物理可行（不允许瞬移）。无效移动会被静默丢弃；客户端将通过下一次广播自行纠正。

> Server validates that the position delta from the previous tick is physically possible (no teleporting). Invalid moves are silently dropped; the client will self-correct from the next broadcast.

### `chat.send`

向附近玩家发送 1:1 聊天消息。

> Send a 1:1 chat message to a nearby player.

```ts
{
  to: string;          // 目标玩家 ID · target player ID
  text: string;        // 1–500 字符 · 1–500 chars
}
```

如果发送者和目标距离超过 3 格，服务器会拒绝。

> Server rejects if sender and target are > 3 tiles apart.

### `friend.request`

向附近玩家发送好友请求。

> Send a friend request to a nearby player.

```ts
{
  to: string;          // 目标玩家 ID · target player ID
}
```

### `friend.accept`

接受待处理的好友请求。

> Accept a pending friend request.

```ts
{
  from: string;        // 发送请求的玩家 ID · player ID who sent the request
}
```

### `friend.reject`

拒绝待处理的好友请求。

> Reject a pending friend request.

```ts
{
  from: string;        // 发送请求的玩家 ID · player ID who sent the request
}
```

### `profile.view`

请求查看附近玩家的公开资料。

> Request to view a nearby player's public profile.

```ts
{
  playerId: string;    // 目标玩家 ID · target player ID
}
```

服务器响应：`profile.view`（见服务端 → 客户端消息）。

> Server response: `profile.view` (see Server → Client Messages).

### `npc.talk`

请求附近 NPC 的对话。

> Request dialogue from a nearby NPC.

```ts
{
  npcId: string;       // NPC ID（来自 zone.npcs）· NPC ID (from zone.npcs)
}
```

如果玩家距离 NPC 超过 3 格，服务器会拒绝。

> Server rejects if the player is > 3 tiles from the NPC.

### `chat.history`

请求与某玩家的历史聊天记录。用于断线重连后恢复聊天面板。

> Request chat history with a player. Used to restore the chat panel after reconnection.

```ts
{
  with: string;        // 对方玩家 ID · the other player's ID
  before?: number;     // 可选，分页游标（时间戳），不传则取最新一页 · optional cursor for pagination (timestamp)
}
```

服务器响应：`chat.history`（见服务端 → 客户端消息）。

> Server response: `chat.history` (see Server → Client Messages).

---

## 服务端 → 客户端消息 · Server → Client Messages

### `player.joined`

确认玩家成功进入地图。

> Confirmation that the player successfully entered the map.

```ts
{
  playerId: string;    // 分配给你的 ID (UUID) · your assigned ID (UUID)
  spawn: {
    x: number;
    y: number;
  };
  friends: Array<{     // 现有好友列表（客户端恢复 UI 用）
    id: string;        //   existing friend list (for client UI restoration)
    name: string;
    avatar: string;
    isOnline: boolean;
  }>;
}
```

### `zone.players`

玩家所在区域邻域内实体的完整状态快照。在加入和区域变更时发送。

> Full state dump of entities in the player's zone neighborhood. Sent on join and on zone-change.

```ts
{
  players: Array<{
    id: string;
    name: string;
    avatar: string;
    x: number;
    y: number;
    direction: string;
    isFriend: boolean;   // 如果已经是本地玩家的好友则为 true · true if already friends with local player
  }>;
}
```

### `zone.npcs`

玩家所在区域邻域的 NPC 列表。在加入和区域变更时发送。

> NPC list for the player's zone neighborhood. Sent on join and on zone-change.

```ts
{
  npcs: Array<{
    id: string;
    name: string;
    avatar: string;
    x: number;
    y: number;
    description: string;  // 悬停时显示的一句话简介 · one-line blurb shown on hover
  }>;
}
```

### `player.moved`

当你所在区域邻域中的玩家移动时广播。

> Broadcast when a player in your zone neighborhood moves.

```ts
{
  id: string;
  x: number;
  y: number;
  direction: string;
  moving: boolean;
}
```

### `player.appeared`

当新玩家进入你所在区域邻域时广播。（区别于 `player.joined`——后者是自己加入成功的确认，前者是别人出现的通知。）

> Broadcast when a new player enters your zone neighborhood. (Distinct from `player.joined` — the latter confirms your own join, the former notifies you of others appearing.)

```ts
{
  id: string;
  name: string;
  avatar: string;
  x: number;
  y: number;
}
```

### `player.left`

当玩家离开你所在区域邻域或断开连接时广播。

> Broadcast when a player leaves your zone neighborhood or disconnects.

```ts
{
  id: string;
}
```

### `chat.receive`

来自其他玩家的聊天消息。

> A chat message from another player.

```ts
{
  from: string;        // 发送者玩家 ID · sender player ID
  fromName: string;    // 发送者显示名称 · sender display name
  text: string;
  timestamp: number;   // Unix 毫秒 · Unix ms
}
```

### `chat.history`

对 `chat.history` 请求的响应。返回与指定玩家的历史消息列表（按时间升序）。

> Response to a `chat.history` request. Returns the message history with the specified player (ascending by time).

```ts
{
  with: string;        // 对方玩家 ID · the other player's ID
  messages: Array<{
    from: string;      // 发送者 ID · sender ID
    fromName: string;  // 发送者名称 · sender name
    text: string;
    timestamp: number; // Unix 毫秒 · Unix ms
  }>;
  hasMore: boolean;    // 是否还有更早的消息（用于翻页）· whether older messages exist (for pagination)
}
```

### `friend.requested`

有人向你发送好友请求的通知。

> Notification that someone sent you a friend request.

```ts
{
  from: string;
  fromName: string;
}
```

### `friend.accepted`

有人接受了你的好友请求的通知。

> Notification that someone accepted your friend request.

```ts
{
  by: string;          // 接受请求的玩家 ID · player ID who accepted
  byName: string;
}
```

### `profile.view`

点击玩家查看资料时的响应。包含公开信息。

> Response when clicking a player to view their profile. Contains public information.

```ts
{
  id: string;
  name: string;
  avatar: string;
  tags: string[];       // 例如 e.g. ["前端", "找项目队友", "23级计软"]
  friendsCount: number;
  isOnline: boolean;
}
```

### `npc.dialogue`

对 `npc.talk` 的响应。

> Response to `npc.talk`.

```ts
{
  npcId: string;
  npcName: string;
  text: string;          // 预设对话文本 · the seeded dialogue line
}
```

### `error`

服务端错误（名字被占用、服务器已满、超出范围、频率限制）。

> Server-side error (name taken, server full, out of range, rate limited).

```ts
{
  code: string;          // 机器可读: "SERVER_FULL" | "NAME_TAKEN" | "OUT_OF_RANGE" | "INVALID_MOVE"
                         // machine-readable
  message: string;       // 人类可读，可以安全展示 · human-readable, safe to display
}
```

---

## 频率限制 · Rate Limits

| 事件 · Event | 限制 · Limit |
|-------|-------|
| `player.move` | 20/秒（超出丢弃）· 20/sec (drop excess) |
| `chat.send` | 5/秒 每发送者 · 5/sec per sender |
| `friend.request` | 10/分钟 每发送者 · 10/min per sender |
| `npc.talk` | 2/秒 每玩家 · 2/sec per player |

---

## 连接守卫 · Connection Guard

在 `connect` 时，在任何 `player.join` 之前：

> On `connect`, before any `player.join`:

1. 检查 `online_count < 50` · Check `online_count < 50`
2. 如果已满 50：发送 `error { code: "SERVER_FULL" }`，并在 1 秒宽限期后 `disconnect()`
   > If 50: emit `error { code: "SERVER_FULL" }` and `disconnect()` after 1s grace
