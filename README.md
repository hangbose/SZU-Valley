# SZU Valley · 深大像素校园

A pixel-art multiplayer campus social map for Shenzhen University students. Walk around like Stardew Valley, see other students, chat when you get close.

**Not a game — a game-like social space.** The map makes introducing yourself feel natural instead of transactional.

---

## What it does

- Enter a name, pick a pixel avatar, drop into the campus map
- Walk around a tile-based map fusing real SZU landmarks (Library, Wenshan Lake, Sci-Tech Building…)
- See other players moving in real time
- Walk up to someone (within 3 tiles), click them, view their profile
- Start a 1:1 chat, send a friend request
- If nobody's around, chat with NPCs placed across campus
- Max 50 concurrent players

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Game rendering | Phaser.js 3.x |
| UI overlay | React 18 |
| Bundler | Vite |
| Realtime server | Node.js + Socket.IO |
| Database | PostgreSQL (persistence) |
| Position cache | Redis (in-memory) |
| Deployment (static) | Vercel |
| Deployment (server) | Railway / Fly.io / lightweight VPS |

---

## Quick Start

### Prerequisites

- Node.js ≥ 20
- PostgreSQL 16
- Redis 7

### Setup

```bash
# Clone
git clone <repo-url> && cd SZU-Valley

# Install dependencies
npm install
cd client && npm install && cd ..
cd server && npm install && cd ..

# Set up database
createdb szu_valley
cp server/.env.example server/.env  # edit credentials

# Run migrations
cd server && npm run migrate && cd ..

# Start dev
npm run dev        # starts both client (Vite :5173) and server (Socket.IO :3001)
```

### Project layout

```
SZU-Valley/
├── client/               # Phaser.js + React frontend (Vite)
│   ├── src/
│   │   ├── game/         # Phaser scenes, entities, map
│   │   ├── ui/           # React components (Chat, Profile, Friends)
│   │   └── network/      # WebSocket client wrapper
│   └── public/
│       └── assets/       # Sprites, tilesets, map JSON
├── server/               # Node.js + Socket.IO backend
│   ├── src/
│   │   ├── game/         # Zone manager, NPC engine, movement
│   │   ├── social/       # Chat, friendship, profiles
│   │   └── data/         # NPC configs, dialogue seed data
│   └── data/
│       ├── npcs.json
│       └── npc-dialogues.json
├── docs/                 # Design docs & specs
│   ├── constraints.md
│   ├── architecture.md
│   ├── protocol.md
│   └── roles.md
└── CONTEXT.md            # Domain glossary
```
