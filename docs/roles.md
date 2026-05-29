# Team Division · 3+1 Model

Three core contributors plus one lighter role for assets and content.

---

## Role A: Backend & Infrastructure

**Scope**: Everything server-side plus deployment.

### Modules

| Module | Description |
|--------|-------------|
| Socket.IO server | Connection lifecycle, event routing, room management |
| Zone Manager | Zone assignment, subscription, neighbor calculation |
| Movement System | Position validation, Redis read/write, broadcast |
| Chat Relay | Range verification, message persistence, delivery |
| Friend System | Request/accept/reject flow, PostgreSQL persistence |
| NPC Engine | Load JSON configs, serve dialogue, broadcast NPC lists |
| Connection Guard | 50-player cap, name uniqueness check |
| PostgreSQL schema | Players, friendships, chat_history tables + migrations |
| Redis schema | Position keys, online set, TTL management |
| Deployment | Docker Compose, Nginx reverse proxy, environment config |

### Key Files

```
server/
├── src/
│   ├── index.ts              # Entry point, Socket.IO init
│   ├── handlers/
│   │   ├── join.ts
│   │   ├── movement.ts
│   │   ├── chat.ts
│   │   ├── friends.ts
│   │   └── npc.ts
│   ├── zone-manager.ts
│   ├── connection-guard.ts
│   ├── db/
│   │   ├── pool.ts           # PG connection
│   │   ├── migrations/
│   │   └── queries/
│   └── redis.ts              # Redis client
├── data/
│   ├── npcs.json
│   └── npc-dialogues.json
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

---

## Role B: Frontend — Game Layer

**Scope**: Phaser.js — the map, the sprites, the movement, the camera.

### Modules

| Module | Description |
|--------|-------------|
| Boot & Preload | Asset loading, splash screen |
| TileMap Scene | Load Tiled `.json` map, render layers, collision tiles |
| Local Player | Sprite animation (idle/walk in 4 directions), keyboard input |
| Remote Players | Spawn/despawn sprites, smooth position interpolation |
| NPC Sprites | Render NPCs at fixed positions, click detection |
| Camera | Follow local player, world bounds clamping |
| Proximity Detection | Emit event when a target enters/exits 3-tile range |
| Interaction Prompt | Show/hide "Press E to interact" indicator |
| Bridge Interface | Emit events to React, accept commands from React |

### Key Files

```
client/src/game/
├── index.ts              # Phaser game config + launch
├── scenes/
│   ├── BootScene.ts
│   ├── GameScene.ts
│   └── HUDScene.ts       # Minimap overlay (Phaser, not React)
├── entities/
│   ├── LocalPlayer.ts
│   ├── RemotePlayer.ts
│   └── NPC.ts
├── map/
│   └── TileMapManager.ts
├── input/
│   └── KeyboardController.ts
└── bridge.ts             # Game ↔ React communication
```

---

## Role C: Frontend — UI Layer

**Scope**: React — all panels, overlays, forms, and screens outside the game canvas.

### Modules

| Module | Description |
|--------|-------------|
| Join Screen | Name input, avatar picker, "Enter Campus" button |
| Chat Panel | Message list, text input, auto-scroll, unread badge |
| Profile Card | Shown on player click: name, avatar, tags, friend button |
| Friend Request Toast | Slide-in notification + accept/reject |
| Friends List | Sidebar showing online/offline friends |
| HUD Overlay | Player count, current zone name, connection status |
| WebSocket Bridge | Socket.IO client wrapper, event → React state |

### Key Files

```
client/src/ui/
├── App.tsx                   # Root component, mounts Phaser
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
    └── gameStore.ts          # Shared state (Zustand or Context)
```

---

## Role D (+1): Content & Assets

**Scope**: All creative assets and data — the "lighter" workload.

### Modules

| Module | Description |
|--------|-------------|
| Pixel Tileset | 32×32 tiles: grass, path, water, building walls/floors |
| Character Sprites | 4-direction walk + idle frames (~4 frames per direction) for 6–8 avatar presets |
| NPC Sprites | 8–12 unique NPC character sprites (can reuse character base with variations) |
| Map Design | Tiled `.tmz`/`.json` map file: fused Yuèhǎi landmarks, walkable layer, collision layer |
| NPC Configuration | `npcs.json`: NPC placement (x, y, name, description, avatar) |
| NPC Dialogue | `npc-dialogues.json`: 3–5 lines per NPC, campus-themed flavor text |
| UI Style | CSS color palette, font choices, panel design (collaborate with Role C) |

### Key Files

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
│   └── yuehai-campus.json       # Tiled export
└── ui/
    └── palette.css

server/data/
├── npcs.json
└── npc-dialogues.json
```

### Dependency: Role D creates assets that Roles B and C consume. They should deliver the tileset + map JSON first (unblocks Role B), then sprites (unblocks Role B fully), then NPC config (unblocks Role A's NPC engine testing).

---

## Dependency Graph

```
Role D (Assets)
  │
  ├── tileset + map JSON ─────► Role B (Game Layer)
  │                                   │
  ├── sprites ───────────────►       │
  │                                   ▼
  ├── NPC config ─────► Role A (Backend)
  │                         │
  └── UI palette ──► Role C (UI)
```

- **Role A** and **Role B** can start in parallel on day 1 (Role A: server scaffold; Role B: Phaser scaffold with placeholder rectangles)
- **Role C** can start day 1 with mock data (hardcoded messages, fake player list)
- **Role D** should deliver tileset first (unblocks B), then sprites, then NPC data

---

## Recommended First Week Sequencing

| Day | Role A | Role B | Role C | Role D |
|-----|--------|--------|--------|--------|
| 1 | Socket.IO scaffold, connection guard | Phaser boot + empty scene | React scaffold + JoinScreen | Sketch campus map layout on paper |
| 2 | Player join/disconnect handlers | TileMap loading (placeholder grid) | WebSocket hook, ChatPanel skeleton | Create tileset spritesheet |
| 3 | Zone manager + movement broadcast | Local player movement + camera | ProfileCard + friend hooks | Build map in Tiled editor |
| 4 | Chat relay + friend system | Remote player spawning + interpolation | Wire UI to real socket events | Character sprites (4 avatars) |
| 5 | NPC engine | NPC rendering + proximity indicator | FriendsList + polish | NPC sprites + dialogue writing |
| 6 | Integration testing | Integration testing | Integration testing | Remaining avatars + map polish |
| 7 | Bug fixes + deploy | Bug fixes | Bug fixes | Final dialogue pass |
