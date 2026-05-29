# WebSocket Protocol

All real-time communication between client and server uses Socket.IO. Every message has a **type** (event name) and a **payload** (JSON object). Field types are described with TypeScript-style notation.

---

## Connection Lifecycle

```
Client                    Server
  │                          │
  │──── connect ────────────►│  TCP + WebSocket upgrade
  │◄─── connected ──────────│  Socket.IO handshake OK
  │                          │
  │──── player.join ────────►│  Name + avatar + spawn
  │◄─── player.joined ──────│  Your player ID + map state
  │◄─── zone.players ───────│  Entities in your zone
  │◄─── zone.npcs ──────────│  NPCs in your zone
  │                          │
  │  ... gameplay ...        │
  │                          │
  │──── disconnect ─────────►│  Tab closed / network loss
  │                          │  Server cleans up, broadcasts player.left
```

No heartbeat is needed — Socket.IO's built-in ping handles dead connections.

---

## Client → Server Messages

### `player.join`

Sent once after Socket.IO connection. Requests entry to the map.

```ts
{
  name: string;        // 2–12 chars, displayed above sprite
  avatar: string;      // preset key: "avatar_01" … "avatar_08"
}
```

Server response: `player.joined` (success) or `error` (name taken / server full).

### `player.move`

Sent ~20 times/second while the player is moving. Throttled to 50ms minimum interval by the client.

```ts
{
  x: number;           // tile-precision float (e.g. 42.3)
  y: number;           // tile-precision float (e.g. 17.8)
  direction: "up" | "down" | "left" | "right";
  moving: boolean;
}
```

Server validates that the position delta from the previous tick is physically possible (no teleporting). Invalid moves are silently dropped; the client will self-correct from the next broadcast.

### `chat.send`

Send a 1:1 chat message to a nearby player.

```ts
{
  to: string;          // target player ID
  text: string;        // 1–500 chars
}
```

Server rejects if sender and target are > 3 tiles apart.

### `friend.request`

Send a friend request to a nearby player.

```ts
{
  to: string;          // target player ID
}
```

### `friend.accept`

Accept a pending friend request.

```ts
{
  from: string;        // player ID who sent the request
}
```

### `friend.reject`

Reject a pending friend request.

```ts
{
  from: string;        // player ID who sent the request
}
```

### `npc.talk`

Request dialogue from a nearby NPC.

```ts
{
  npcId: string;       // NPC ID (from zone.npcs)
}
```

Server rejects if the player is > 3 tiles from the NPC.

---

## Server → Client Messages

### `player.joined`

Confirmation that the player successfully entered the map.

```ts
{
  playerId: string;    // your assigned ID (UUID)
  spawn: {
    x: number;
    y: number;
  };
}
```

### `zone.players`

Full state dump of entities in the player's zone neighborhood. Sent on join and on zone-change.

```ts
{
  players: Array<{
    id: string;
    name: string;
    avatar: string;
    x: number;
    y: number;
    direction: string;
    isFriend: boolean;   // true if already friends with local player
  }>;
}
```

### `zone.npcs`

NPC list for the player's zone neighborhood. Sent on join and on zone-change.

```ts
{
  npcs: Array<{
    id: string;
    name: string;
    avatar: string;
    x: number;
    y: number;
    description: string;  // one-line blurb shown on hover
  }>;
}
```

### `player.moved`

Broadcast when a player in your zone neighborhood moves.

```ts
{
  id: string;
  x: number;
  y: number;
  direction: string;
  moving: boolean;
}
```

### `player.joined`

Broadcast when a new player enters your zone neighborhood. (Different from the join-confirmation above — same event name, different context.)

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

Broadcast when a player leaves your zone neighborhood or disconnects.

```ts
{
  id: string;
}
```

### `chat.receive`

A chat message from another player.

```ts
{
  from: string;        // sender player ID
  fromName: string;    // sender display name
  text: string;
  timestamp: number;   // Unix ms
}
```

### `friend.requested`

Notification that someone sent you a friend request.

```ts
{
  from: string;
  fromName: string;
}
```

### `friend.accepted`

Notification that someone accepted your friend request.

```ts
{
  by: string;          // player ID who accepted
  byName: string;
}
```

### `profile.view`

Response when clicking a player to view their profile. Contains public information.

```ts
{
  id: string;
  name: string;
  avatar: string;
  tags: string[];       // e.g. ["前端", "找项目队友", "23级计软"]
  friendsCount: number;
  isOnline: boolean;
}
```

### `npc.dialogue`

Response to `npc.talk`.

```ts
{
  npcId: string;
  npcName: string;
  text: string;          // the seeded dialogue line
}
```

### `error`

Server-side error (name taken, server full, out of range, rate limited).

```ts
{
  code: string;          // machine-readable: "SERVER_FULL" | "NAME_TAKEN" | "OUT_OF_RANGE" | "INVALID_MOVE"
  message: string;       // human-readable, safe to display
}
```

---

## Rate Limits

| Event | Limit |
|-------|-------|
| `player.move` | 20/sec (drop excess) |
| `chat.send` | 5/sec per sender |
| `friend.request` | 10/min per sender |
| `npc.talk` | 2/sec per player |

---

## Connection Guard

On `connect`, before any `player.join`:

1. Check `online_count < 50`
2. If 50: emit `error { code: "SERVER_FULL" }` and `disconnect()` after 1s grace
