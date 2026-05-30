// ============================================================
// A2 核心逻辑演示脚本 · Core Logic Demo
//
// 直接导入 store 和 friend-state，不依赖 Socket.IO 和 Redis。
// 验证所有数据结构 + 状态机逻辑是否正确运行。
//
// 用法：node demo-a2.mjs
// ============================================================

// ---- 用 tsx 跑 TypeScript 模块 ----
import { DataStore } from "./src/db/store.ts";
import {
  canSendRequest,
  createRequest,
  acceptRequest,
  rejectRequest,
} from "./src/social/friend-state.ts";

const PASS = "✅";
const FAIL = "❌";
let passed = 0, failed = 0;

function check(name, condition, detail = "") {
  if (condition) { console.log(`  ${PASS} ${name}`); passed++; }
  else { console.log(`  ${FAIL} ${name} ${detail}`); failed++; }
}

console.log("╔══════════════════════════════════════════════════════╗");
console.log("║     SZU-Valley · A2 核心逻辑演示                    ║");
console.log("║     Core Logic Demo (store + friend-state)          ║");
console.log("╚══════════════════════════════════════════════════════╝\n");

const store = new DataStore();

// ============================================================
// 1. 玩家创建 · Player Creation
// ============================================================
console.log("── 1. 玩家资料 CRUD · Player Profile CRUD ──");

const alice = store.createPlayer("p1", "Alice", "avatar_01");
const bob   = store.createPlayer("p2", "Bob",   "avatar_02");
const eve   = store.createPlayer("p3", "Eve",   "avatar_03");

check("Alice 创建成功", alice.name === "Alice" && alice.avatar === "avatar_01");
check("Bob 创建成功",   bob.name === "Bob"     && bob.friendsCount === 0);
check("Eve 创建成功",   eve.name === "Eve"     && eve.isOnline === true);
check("tags 默认为空数组", Array.isArray(alice.tags) && alice.tags.length === 0);

// 在线状态切换
store.setOnline("p1", false);
check("Alice 离线", store.getPlayer("p1")?.isOnline === false);
store.setOnline("p1", true);
check("Alice 重新上线", store.getPlayer("p1")?.isOnline === true);

// 标签设置
store.setTags("p1", ["前端", "找项目队友"]);
check("Alice 标签设置", store.getPlayer("p1")?.tags?.join(",") === "前端,找项目队友");

// ============================================================
// 2. 好友状态机 · Friend State Machine
// ============================================================
console.log("\n── 2. 好友请求状态机 · Friend State Machine ──");

// 2a. 正常请求
let check1 = canSendRequest("p1", "p2", store);
check("Alice→Bob: canSend = true", check1.ok === true);

let req = createRequest("p1", "p2", store);
check("请求创建成功", req.status === "pending" && req.from === "p1" && req.to === "p2");
check("请求 ID 存在", typeof req.id === "string" && req.id.startsWith("fr_"));

// 2b. 重复请求被拒
let check2 = canSendRequest("p1", "p2", store);
check("重复请求被拒", check2.ok === false && check2.reason?.includes("已"));

// 2c. 不能加自己
let checkSelf = canSendRequest("p1", "p1", store);
check("不能加自己", checkSelf.ok === false);

// 2d. Bob 接受
let pending = store.getPendingRequests("p2");
check("Bob 有 1 个待处理请求", pending.length === 1 && pending[0].from === "p1");

let accept = acceptRequest("p2", "p1", store);
check("Bob 接受请求成功", accept.ok === true);
check("Alice 和 Bob 成为好友", store.isFriend("p1", "p2") === true);
check("双向好友关系", store.isFriend("p2", "p1") === true);
check("Alice friendsCount=1", store.getFriendsCount("p1") === 1);
check("Bob friendsCount=1", store.getFriendsCount("p2") === 1);

// 2e. 已是好友再请求
let check3 = canSendRequest("p1", "p2", store);
check("已是好友请求被拒", check3.ok === false && check3.reason?.includes("好友"));

// 2f. Bob→Eve 请求，Eve 拒绝
let req2 = createRequest("p2", "p3", store);
check("Bob→Eve 请求创建", req2.status === "pending");

let reject = rejectRequest("p3", "p2", store);
check("Eve 拒绝成功", reject.ok === true);

let check4 = canSendRequest("p2", "p3", store);
check("拒绝后可重新请求", check4.ok === true);

// 2g. 请求过期清理
let req3 = createRequest("p2", "p3", store);
// 手动修改 createdAt 为 10 分钟前（模拟过期）
store.getRequest(req3.id).createdAt = Date.now() - 10 * 60 * 1000;
store.updateRequestStatus(req3.id, "accepted");
let cleaned = store.cleanStaleRequests();
check("过期请求被清理", cleaned === 1);

// ============================================================
// 3. 好友关系 · Friendship Operations
// ============================================================
console.log("\n── 3. 好友关系操作 · Friendship Operations ──");

// Alice 加 Eve 为好友（直接操作 store）
store.addFriendship("p1", "p3");
check("Alice friendsCount=2", store.getFriendsCount("p1") === 2);
check("Eve friendsCount=1", store.getFriendsCount("p3") === 1);

let aliceFriends = store.getFriends("p1");
check("Alice 好友列表=[p2,p3]", aliceFriends.includes("p2") && aliceFriends.includes("p3"));

store.removeFriendship("p1", "p3");
check("解除好友后 Alice friendsCount=1", store.getFriendsCount("p1") === 1);
check("Eve friendsCount=0", store.getFriendsCount("p3") === 0);
check("不再是好友", store.isFriend("p1", "p3") === false);

// ============================================================
// 4. 聊天消息 · Chat Messages
// ============================================================
console.log("\n── 4. 聊天消息存储 · Chat Messages ──");

let m1 = store.saveMessage("p1", "p2", "Hi Bob!");
let m2 = store.saveMessage("p2", "p1", "Hey Alice!");
let m3 = store.saveMessage("p1", "p2", "要不要一起做项目？");
let m4 = store.saveMessage("p2", "p1", "好呀！做什么方向？");

check("4条消息已存储", m1.text === "Hi Bob!" && m4.text === "好呀！做什么方向？");
check("消息有 timestamp", m1.timestamp > 0 && m1.id.startsWith("msg_"));

// 聊天历史查询
let history = store.getChatHistory("p1", "p2");
check("查询到 4 条历史", history.messages.length === 4);
check("消息按时间序", history.messages[0].text === "Hi Bob!" &&
                       history.messages[3].text === "好呀！做什么方向？");
check("hasMore=false", history.hasMore === false);

// 分页查询
let page1 = store.getChatHistory("p1", "p2", undefined, 2);
check("分页(limit=2)返回 2 条", page1.messages.length === 2 && page1.hasMore === true);
check("分页最新 2 条", page1.messages[0].text === "要不要一起做项目？");

// 500 字符限制（store 层不管截断，由 chat handler 负责）
let longMsg = store.saveMessage("p1", "p2", "x".repeat(500));
check("500 字符消息可存储", longMsg.text.length === 500);

// 消息上限测试（500 条）
for (let i = 0; i < 550; i++) {
  store.saveMessage("p1", "p3", `msg ${i}`);
}
let p1p3History = store.getChatHistory("p1", "p3");
check("超 500 条后取最新 50 条", p1p3History.messages.length === 50);
check("hasMore=true", p1p3History.hasMore === true);

// ============================================================
// 5. 边界情况 · Edge Cases
// ============================================================
console.log("\n── 5. 边界情况 · Edge Cases ──");

let noPlayer = store.getPlayer("nonexistent");
check("不存在的玩家→undefined", noPlayer === undefined);

let noRequest = store.getRequest("no_such_request");
check("不存在的请求→undefined", noRequest === undefined);

let emptyHistory = store.getChatHistory("p1", "never_chatted");
check("无对话→空数组", emptyHistory.messages.length === 0 && emptyHistory.hasMore === false);

let fakeAccept = acceptRequest("p2", "nonexistent", store);
check("接受不存在的请求→失败", fakeAccept.ok === false);

let fakeReject = rejectRequest("p3", "nonexistent", store);
check("拒绝不存在的请求→失败", fakeReject.ok === false);

// ============================================================
// 汇总
// ============================================================
console.log("\n╔══════════════════════════════════════════════════════╗");
console.log(`║  结果: ${PASS} ${passed} 通过  ${FAIL} ${failed} 失败              ║`);
console.log("╚══════════════════════════════════════════════════════╝\n");

if (failed > 0) {
  console.log("⚠️  有测试失败，请检查！");
  process.exit(1);
} else {
  console.log("✅ A2 核心逻辑全部通过！\n");
  console.log("数据存储验证:");
  console.log("  • 玩家 CRUD          — 正常");
  console.log("  • 好友状态机 (三态)   — 正常");
  console.log("  • 好友关系 (双向)     — 正常");
  console.log("  • 聊天存储 + 分页     — 正常");
  console.log("  • 边界情况处理        — 正常\n");
  console.log("接下来启动完整服务器测试：npm run dev → node test-a2.mjs\n");
  process.exit(0);
}
