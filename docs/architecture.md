# Architecture

How the system fits together, what each piece owns, and why we chose it.

---

## System Diagram

```
┌─────────────────────────────────────────────────────┐
│                   Browser                           │
│  ┌───────────────────────────────────────────────┐  │
│  │              React UI Layer                    │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────┐  │  │
│  │  │JoinScreen│ │ChatPanel │ │ProfileCard   │  │  │
│  │  └──────────┘ │          │ │              │  │  │
│  │               │ Messages │ │ Name, Tags   │  │  │
│  │               │ Input    │ │ Add Friend   │  │  │
│  │               └──────────┘ └──────────────┘  │  │
│  │  ┌──────────┐ ┌──────────────────────────┐   │  │
│  │  │FriendsList│ │HUD (minimap, status)     │   │  │
│  │  └──────────┘ └──────────────────────────┘   │  │
│  └───────────────────────────────────────────────┘  │
│                      ▲                               │
│                      │ state                         │
│                      ▼                               │
│  ┌───────────────────────────────────────────────┐  │
│  │            Phaser.js Game Layer                │  │
│  │  ┌──────────┐ ┌────────┐ ┌────────────────┐  │  │
│  │  │TileMap   │ │Player  │ │Camera (follow) │  │  │
│  │  │(Tiled)   │ │Sprite  │ │                │  │  │
│  │  └──────────┘ └────────┘ └────────────────┘  │  │
│  │  ┌──────────┐ ┌────────┐ ┌────────────────┐  │  │
│  │  │NPCSprite │ │Remote  │ │Collision       │  │  │
│  │  │          │ │Players │ │(walkable tiles)│  │  │
│  │  └──────────┘ └────────┘ └────────────────┘  │  │
│  └───────────────────────────────────────────────┘  │
│                      ▲                               │
│                      │ events                        │
│                      ▼                               │
│  ┌───────────────────────────────────────────────┐  │
│  │         WebSocket Client (Socket.IO)           │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                       │
                       │ wss://
                       ▼
┌─────────────────────────────────────────────────────┐
│              Node.js Server (:3001)                   │
│  ┌───────────────────────────────────────────────┐  │
│  │            Socket.IO Server                    │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────┐  │  │
│  │  │Join      │ │Movement  │ │Chat Relay    │  │  │
│  │  │Handler   │ │Broadcast │ │              │  │  │
│  │  └──────────┘ └──────────┘ └──────────────┘  │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────┐  │  │
│  │  │Friend    │ │NPC Talk  │ │Disconnect    │  │  │
│  │  │Handler   │ │Handler   │ │Handler       │  │  │
│  │  └──────────┘ └──────────┘ └──────────────┘  │  │
│  └───────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────┐  │
│  │            Zone Manager                       │  │
│  │  Tracks which player is in which zone         │  │
│  │  On move: computes new zone, re-subscribes    │  │
│  │  Broadcasts only to zone + 8 neighbors        │  │
│  └───────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────┐  │
│  │            NPC Engine                         │  │
│  │  Loads npcs.json + npc-dialogues.json        │  │
│  │  Serves dialogue on npc.talk events           │  │
│  │  Broadcasts NPC list per zone on join         │  │
│  └───────────────────────────────────────────────┘  │
│         │                        │                   │
│         ▼                        ▼                   │
│  ┌────────────┐          ┌────────────┐              │
│  │ PostgreSQL │          │   Redis    │              │
│  │            │          │            │              │
│  │ • players  │          │ • positions│              │
│  │ • friends  │          │   (live)   │              │
│  │ • messages │          │ • online   │              │
│  └────────────┘          │   set      │              │
│                          └────────────┘              │
└─────────────────────────────────────────────────────┘
```

---

## Layer Responsibilities

### Phaser.js (Game Layer)

- Load and render the Tiled `.tmx`/`.json` tilemap
- Animate the local player sprite (idle / walk directions)
- Smoothly interpolate remote player positions between updates
- Enforce tile-based collision (walls, water)
- Follow the local player with the camera
- Emit events upward to React (e.g. `player-clicked`, `npc-clicked`, `position-changed`)

Phaser does NOT know about chat, friends, or profiles. It fires events; React listens.

### React (UI Layer)

- Join screen (name input, avatar picker)
- Chat panel (message list, text input, send button)
- Profile card (shown when clicking a nearby player)
- Friend request toast + friends list sidebar
- HUD overlay (online count, minimap)
- Manages UI state (which panel is open, unread count, etc.)

React does NOT render to the game canvas. It sits in DOM elements positioned above Phaser's canvas.

### Communication Bridge

A shared module (`client/src/network/`) that both layers use:

- **Phaser → Bridge**: `bridge.onMove(x, y)`, `bridge.onClickPlayer(id)`, `bridge.onClickNPC(id)`
- **Bridge → React**: `bridge.onChatReceive(msg)`, `bridge.onProfileView(data)`, `bridge.onFriendRequest(from)`
- **Bridge ↔ Server**: Raw Socket.IO events

### Node.js Server

- **Join Handler**: validate name, assign spawn point, create Player record, broadcast to zone
- **Movement Broadcast**: receive `player.move`, update Redis position, broadcast to zone subscribers
- **Chat Relay**: receive `chat.send`, verify target is in range, deliver
- **Friend Handler**: create/accept friend request, persist to PostgreSQL
- **NPC Engine**: on `npc.talk`, look up NPC dialogue, return line
- **Zone Manager**: track zone memberships, manage subscriptions, handle disconnects
- **Connection Guard**: reject connections when `online_count >= 50`

### Data Stores

| Data | Store | Reason |
|------|-------|--------|
| Player profiles | PostgreSQL | Persistent, relational |
| Friendship edges | PostgreSQL | Needs join queries |
| Chat history | PostgreSQL | Audit trail, scroll-back |
| Live positions | Redis | Volatile, high-write, sub-ms reads |
| Online player set | Redis | `SADD`/`SREM`/`SCARD` for count |
| NPC config | JSON files | Static, no DB needed |
| NPC dialogue | JSON files | Static, easy to edit |

---

## Data Flow: Movement

```
1. Player presses ArrowRight
2. Phaser updates sprite position locally (smooth)
3. Every ~50ms, Phaser sends { x, y, direction } via bridge
4. Bridge emits player.move to server
5. Server updates Redis: SET pos:<playerId> {x, y}
6. Server computes zone for new position
7. Server broadcasts player.moved to all sockets in zone + neighbors
8. Each receiving client's Phaser layer updates remote sprite target position
9. Remote sprites smoothly interpolate toward target
```

## Data Flow: Chat

```
1. Player A clicks Player B (within 3 tiles) → React shows ProfileCard
2. Player A clicks "Chat" → React opens ChatPanel
3. Player A types message, hits Enter
4. Bridge sends chat.send { to: playerBId, text: "hi!" }
5. Server verifies A and B are within range
6. Server persists message to PostgreSQL
7. Server emits chat.receive { from: playerAId, text: "hi!" } to Player B
8. Player B's React ChatPanel appends the message
```

---

## Deployment Topology

```
    ┌──────────────────────────┐
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
    │  User Browser                             │
    │  ┌────────────────────────────────────┐   │
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

For the cheapest viable setup: a single VPS running all three (Node + PG + Redis) via Docker Compose, with Nginx reverse-proxying `wss://` connections. Railway's free tier also works if Docker Compose is preferred.

---

## Key Design Decisions

1. **Server-authoritative positions** — the server is the source of truth for who is where. The client predicts locally (for smooth movement) but corrects on server updates. This prevents position hacking.

2. **Zone-based broadcast, not global** — a player at the Library does not receive position updates from Wenshan Lake. Zones keep per-player bandwidth constant regardless of total online count.

3. **Phaser for game, React for UI** — game engines do rendering well; UI frameworks do forms and lists well. Combining them avoids building a poor imitation of either.

4. **No session persistence** — close the tab, you're gone from the map. Friendships and chat history survive in PostgreSQL, but the player "slot" is ephemeral. This simplifies state management dramatically.
