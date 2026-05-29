# SZU Valley — Domain Context

The canonical glossary for SZU Valley. When a term appears in code, docs, or conversation, it must mean exactly what this file says.

---

## Core Entities

### Player

A human-controlled character on the campus map. A Player has a display name, an avatar (chosen from presets at join time), and a position `(x, y)` measured in tile coordinates. Players move continuously via directional input and are visible to other nearby players.

Distinct from NPC. A Player occupies one of the 50 server slots.

### NPC

A server-controlled character placed at fixed positions on the map. NPCs have a name, an avatar, and seeded dialogue — preset text responses returned when a Player clicks on them. NPCs are always online, cannot move, and do not consume player slots.

NPCs exist so that the map never feels empty: if no real players are nearby, a Player can still walk up to an NPC and chat.

### Tile

The atomic spatial unit of the map. A square of **32×32 pixels**. Every entity's position is expressed in tile coordinates, where `(0, 0)` is the top-left corner of the map. Tiles have a `walkable` flag; non-walkable tiles (walls, water, building interiors not yet implemented) block movement.

### Zone

A rectangular grouping of tiles used for network-interest management. The map is partitioned into zones (e.g. 16×12 tiles each). A Player receives position updates only for entities in their own zone and the 8 immediately adjacent zones (Moore neighborhood). This bounds the per-player message rate regardless of total online count.

### Proximity Interaction

When two Players (or a Player and an NPC) are within **3 tiles** (Manhattan distance), the Player may initiate interaction: view profile, start chat, or (for real Players only) send a friend request. The UI shows an interaction prompt when a target is in range.

### Friendship

A bidirectional relationship between two Players. Friends appear with a highlight marker on the map when online. Friendship is established via request/accept handshake.

### Seeded Dialogue

Pre-authored text stored in `server/data/npc-dialogues.json`. Each NPC has one or more dialogue lines. The server selects a line (randomly, or by a simple rule) and returns it when `npc.talk` is received. Dialogue is plain text in the first version; rich formatting or conditionals may be added later.

---

## Product Boundaries (v1)

| In scope | Out of scope |
|----------|-------------|
| Enter name → pick avatar → join map | Email / student-ID / OAuth login |
| Walk continuously on tile map | Vehicles, running, teleport |
| View nearby player profiles | Global player search |
| 1:1 real-time chat with nearby players | Group chat, public shout, offline messages |
| Send / accept friend requests | Block / mute / report |
| Talk to NPCs with seeded dialogue | NPC quests, branching dialogue, AI-generated chat |
| Max 50 concurrent players | Horizontal scaling, multiple servers |
| Yuèhǎi campus landmarks fused into one map | Separate Lìhú campus map, real-world geo accuracy |

---

## Explicit Non-Concepts

These terms should NOT appear in code or docs — they describe things we are deliberately NOT modelling in v1:

- **Account / Auth** — no login. A Player is ephemeral; the name you type is who you are for that session.
- **Matchmaking** — no algorithmic pairing. Finding people is entirely spatial (walk around, see who's there).
- **Inventory / Items** — no game items. This is a social space, not an RPG.
