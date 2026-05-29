# V1 Constraints

Hard limits and deliberate non-goals for the first shippable version. Every item here was a conscious choice — not a missing feature.

---

## Hard Limits

| Constraint | Value | Reason |
|-----------|-------|--------|
| Max concurrent players | 50 | Single-server WebSocket; beyond 50 close new connections |
| Map size | ~200×150 tiles | Covers a fused Yuèhǎi campus experience without scope explosion |
| Tile size | 32×32 px | Readable character sprites for social interaction |
| Interaction range | 3 tiles (Manhattan) | Close enough to feel like "walking up to someone" |
| NPC count | 8–12 | Enough to populate key landmarks, small enough to write seeded dialogue |
| Chat message length | 500 chars | Prevents spam; enough for natural conversation |
| Name length | 2–12 chars | No blank names, no novel-length names |
| Avatar options | 6–8 presets | Enough variety without needing a full character creator |

---

## Deliberate Non-Goals

These are things we explicitly decided NOT to build in v1:

- **Authentication** — No login, no student ID verification, no OAuth. Type a name and play.
- **Persistence across sessions** — Player state is ephemeral. Close the tab, you're gone. Friendships and chat history may persist to DB, but the player "slot" does not.
- **Matchmaking / recommendation** — No "find me a study buddy" algorithm. Discovery is spatial: walk around, see who's there.
- **Group chat / public channel** — Only 1:1 proximity-based chat.
- **Mobile client** — Desktop browser only. Mobile responsive is a nice-to-have, not a requirement.
- **Multiple maps / campus切换** — Only the fused Yuèhǎi map. Lìhú is a v2 decision.
- **NPC quests / branching dialogue** — NPCs have flat, linear seeded text.
- **Offline messaging** — If the recipient isn't in range or online, the message doesn't send.
- **Content moderation** — No profanity filter, no report/block. Moderate via community norms at this scale.

---

## What "Done" Looks Like for V1

1. A player opens the URL, types a name, picks an avatar, hits Enter
2. They appear on the campus map, camera following them
3. Arrow keys / WASD move the character smoothly on walkable tiles
4. Other online players are visible and move in real time
5. Walking within 3 tiles of someone shows an interaction prompt
6. Clicking someone opens a profile card (name + tags)
7. "Chat" button opens a real-time 1:1 chat panel
8. "Add Friend" sends a request; accepted friends get a map highlight
9. 8–12 NPCs stand at landmarks; clicking them shows seeded dialogue
10. If 50 players are connected, player 51 gets a "Server full" message
