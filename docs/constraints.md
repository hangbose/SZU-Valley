# V1 约束条件 · V1 Constraints

第一个可交付版本的硬性限制和有意的非目标。此处的每一项都是经过深思熟虑的选择——而非缺失的功能。

> Hard limits and deliberate non-goals for the first shippable version. Every item here was a conscious choice — not a missing feature.

---

## 硬性限制 · Hard Limits

| 约束 · Constraint | 值 · Value | 原因 · Reason |
|-----------|-------|--------|
| 最大并发玩家数 · Max concurrent players | 50 | 单服务器 WebSocket；超过 50 则拒绝新连接 · Single-server WebSocket; beyond 50 close new connections |
| 地图尺寸 · Map size | ~200×150 瓦片 | 覆盖融合的粤海校区体验，避免范围失控 · Covers a fused Yuèhǎi campus experience without scope explosion |
| 瓦片大小 · Tile size | 32×32 px | 适合社交互动的可辨识角色精灵 · Readable character sprites for social interaction |
| 交互范围 · Interaction range | 3 瓦片（曼哈顿距离）· 3 tiles (Manhattan) | 足够近，感觉像"走到某人面前" · Close enough to feel like "walking up to someone" |
| NPC 数量 · NPC count | 8–12 | 足以填充关键地标，又不会超出编写预设对话的工作量 · Enough to populate key landmarks, small enough to write seeded dialogue |
| 聊天消息长度 · Chat message length | 500 字符 | 防止刷屏，同时足够自然对话 · Prevents spam; enough for natural conversation |
| 名字长度 · Name length | 2–12 字符 | 不允许空名字，也不允许超长名字 · No blank names, no novel-length names |
| 头像选项 · Avatar options | 6–8 个预设 | 足够多样，无需完整的角色创建器 · Enough variety without needing a full character creator |

---

## 有意的非目标 · Deliberate Non-Goals

以下是我们明确决定在 v1 中不做的东西：

> These are things we explicitly decided NOT to build in v1:

- **认证 · Authentication** — 没有登录、没有学号验证、没有 OAuth。输入名字就能玩。
  > No login, no student ID verification, no OAuth. Type a name and play.
- **跨会话持久化 · Persistence across sessions** — 玩家状态是临时的。关闭标签页，你就消失了。好友关系和聊天记录可能持久化到数据库，但玩家"槽位"不会。
  > Player state is ephemeral. Close the tab, you're gone. Friendships and chat history may persist to DB, but the player "slot" does not.
- **匹配 / 推荐 · Matchmaking / recommendation** — 没有"帮我找学习伙伴"的算法。发现方式是空间性的：到处走走，看看谁在那里。
  > No "find me a study buddy" algorithm. Discovery is spatial: walk around, see who's there.
- **群聊 / 公共频道 · Group chat / public channel** — 只支持 1:1 近距离聊天。
  > Only 1:1 proximity-based chat.
- **移动端 · Mobile client** — 仅桌面浏览器。移动端响应式是锦上添花，不是必需项。
  > Desktop browser only. Mobile responsive is a nice-to-have, not a requirement.
- **多地图 / 校区切换 · Multiple maps / campus switching** — 只有融合的粤海校区地图。丽湖校区是 v2 的决定。
  > Only the fused Yuèhǎi map. Lìhú is a v2 decision.
- **NPC 任务 / 分支对话 · NPC quests / branching dialogue** — NPC 只有扁平、线性的预设文本。
  > NPCs have flat, linear seeded text.
- **离线消息 · Offline messaging** — 如果收件人不在范围内或不在线，消息不发送。
  > If the recipient isn't in range or online, the message doesn't send.
- **内容审核 · Content moderation** — 没有脏话过滤、没有举报/屏蔽。在这个规模下通过社区规范自行管理。
  > No profanity filter, no report/block. Moderate via community norms at this scale.

---

## V1 "完成"的标准 · What "Done" Looks Like for V1

1. 玩家打开 URL，输入名字，选择头像，按回车
   > A player opens the URL, types a name, picks an avatar, hits Enter
2. 他们出现在校园地图上，镜头跟随他们
   > They appear on the campus map, camera following them
3. 方向键 / WASD 在可行走瓦片上平滑移动角色
   > Arrow keys / WASD move the character smoothly on walkable tiles
4. 其他在线玩家可见并实时移动
   > Other online players are visible and move in real time
5. 走近某人 3 格以内会显示交互提示
   > Walking within 3 tiles of someone shows an interaction prompt
6. 点击某人会打开个人资料卡片（名字 + 标签）
   > Clicking someone opens a profile card (name + tags)
7. "聊天"按钮打开实时 1:1 聊天面板
   > "Chat" button opens a real-time 1:1 chat panel
8. "添加好友"发送请求；被接受的好友在地图上获得高亮标记
   > "Add Friend" sends a request; accepted friends get a map highlight
9. 8–12 个 NPC 站在各地标处；点击它们显示预设对话
   > 8–12 NPCs stand at landmarks; clicking them shows seeded dialogue
10. 如果已连接 50 个玩家，第 51 个玩家会收到"服务器已满"消息
    > If 50 players are connected, player 51 gets a "Server full" message
