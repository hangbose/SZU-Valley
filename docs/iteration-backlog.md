# 迭代待办 · Iteration Backlog

未来版本的增强功能，不在 v1 范围内。

> Enhancements planned for future versions, out of scope for v1.

---

## IB-001 · AI NPC 对话 · AI-Powered NPC Dialogue

**当前**: NPC 返回预设对话行（`npc-dialogues.json` 中随机抽取）。

**计划**: 接入 LLM（如 GPT-4o-mini），NPC 根据玩家输入进行自由对话。聊天气泡可点击进入深度对话模式。

**依赖**: LLM API 接入、对话历史管理、streaming 支持。

---

## IB-002 · 消息撤回 · Message Recall

**当前**: 消息发送后无法撤回。

**计划**: 2 分钟内可撤回已发送消息。撤回后在聊天记录中显示 "消息已撤回 · Message recalled"。

**协议变更**: 新增 `chat.recall` 事件，携带 `messageId`。服务器校验时间窗口（≤2 分钟），验证发送者身份。

**依赖**: 消息持久化需保留 `createdAt` 字段（已满足）。

---

## IB-003 · 账号系统 · Account System (方案 B)

**当前**: `localStorage` 存 playerId，同一浏览器记住身份。

**计划**: 完整注册登录——邮箱+密码或 OAuth（Google/GitHub），支持多设备登录同一账号。好友关系和聊天记录跨设备同步。

**迁移路径**: 方案 A 的 `playerId` 是主键，DataStore 和数据表结构不变。升级时只需加 `users` 表（email + passwordHash），`players` 表加 `userId` 外键。

---

## IB-004 · 玩家标签编辑 · Profile Tag Editing

**当前**: ProfileCard 显示标签（`tags` 字段），但没有 UI 让玩家设置/编辑自己的标签。服务器 `store.setTags` 方法已有但未接线。

**计划**: 
- 客户端：打开自己资料卡时有"编辑标签"按钮，支持 1-4 个短标签（如"前端""找队友"）
- 服务端：新增 `profile.setTags` socket 事件，调用已有 `store.setTags`

---

## IB-005 · 好友高亮 · Friend Highlight on Map

**当前**: 好友在地图上与其他玩家显示相同。

**计划**: 好友在地图上获得特殊标记（金色边框/星标），远距离可见。从好友列表可直接跳转镜头。

**依赖**: RB-003（好友远距离交互）完成后实现。
