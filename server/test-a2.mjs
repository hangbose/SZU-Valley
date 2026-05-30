// ============================================================
// A2 自动化测试脚本 · Automated Test Script
// 用法：node test-a2.mjs（服务器需在 localhost:3001 运行）
//
// 测试覆盖：
//   1. 聊天：chat.send → chat.receive，距离校验，频率限制
//   2. 聊天历史：chat.history
//   3. 好友：request → requested → accept → accepted
//   4. 好友：request → reject
//   5. 资料：profile.view 含真实 friendsCount
//   6. zone 快照：isFriend 字段正确

import { io } from "socket.io-client";

const SERVER = "http://localhost:3001";
const PASS = "✅";
const FAIL = "❌";

let passed = 0, failed = 0;

function check(name, condition, detail = "") {
  if (condition) { console.log(`  ${PASS} ${name}`); passed++; }
  else { console.log(`  ${FAIL} ${name} ${detail}`); failed++; }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log("============================================================");
  console.log("  A2 模块自动化测试（聊天 + 好友 + 资料）");
  console.log("============================================================\n");

  // ====== 1. 两人加入 ======
  console.log("── 1. 两人加入 · Two players join ──");

  const alice = io(SERVER);
  let aliceId;
  await new Promise(r => {
    alice.on("connect", () => alice.emit("player.join", { name: "Alice", avatar: "avatar_01" }));
    alice.on("player.joined", d => { aliceId = d.playerId; r(); });
    setTimeout(() => r(), 3000);
  });
  check("Alice 加入成功", !!aliceId);

  const bob = io(SERVER);
  let bobId;
  await new Promise(r => {
    bob.on("connect", () => bob.emit("player.join", { name: "Bob", avatar: "avatar_02" }));
    bob.on("player.joined", d => { bobId = d.playerId; r(); });
    setTimeout(() => r(), 3000);
  });
  check("Bob 加入成功", !!bobId);

  // 等双方互相感知
  await sleep(500);

  // ====== 2. 头像校验 ======
  console.log("\n── 2. 头像校验 · Avatar validation ──");
  const invalidAvatar = io(SERVER);
  let avatarErr;
  await new Promise(r => {
    invalidAvatar.on("connect", () => invalidAvatar.emit("player.join", { name: "TestAvatar", avatar: "avatar_99" }));
    invalidAvatar.on("error", d => { avatarErr = d; r(); });
    setTimeout(() => r(), 2000);
  });
  check("非法头像被拒绝 (avatar_99)", avatarErr?.code === "INVALID_NAME", `code: ${avatarErr?.code}`);
  invalidAvatar.disconnect();

  // ====== 3. 聊天 chat.send → chat.receive ======
  console.log("\n── 3. chat.send → chat.receive ──");
  let bobReceived = false, bobMsg;
  bob.on("chat.receive", d => {
    if (d.from === aliceId) { bobReceived = true; bobMsg = d; }
  });
  alice.emit("chat.send", { to: bobId, text: "你好 Bob！" });
  await sleep(300);
  check("Bob 收到 Alice 的消息", bobReceived);
  check("消息内容正确", bobMsg?.text === "你好 Bob！");
  check("fromName 正确", bobMsg?.fromName === "Alice");
  check("timestamp 存在", typeof bobMsg?.timestamp === "number");

  // ====== 4. 聊天：距离校验 ======
  console.log("\n── 4. 聊天距离校验 · Chat distance check ──");

  // 先加入第三个玩家 Charlie，放在远处
  const charlie = io(SERVER);
  let charlieId;
  await new Promise(r => {
    charlie.on("connect", () => charlie.emit("player.join", { name: "Charlie", avatar: "avatar_03" }));
    charlie.on("player.joined", d => { charlieId = d.playerId; r(); });
    setTimeout(() => r(), 3000);
  });
  check("Charlie 加入成功", !!charlieId);

  // 把 Charlie 移到远处（逐步移动，避免瞬移作弊检测）
  await sleep(1100);
  for (let i = 0; i < 40; i++) {
    charlie.emit("player.move", { x: 150 + i * 0.5, y: 80, direction: "right", moving: true });
    await sleep(60);
  }
  await sleep(300);

  // Alice 从 (100, 75) 给远处的 Charlie (170, 80) 发消息
  // 距离 = |100-170| + |75-80| = 70 + 5 = 75 >> 3
  let distanceRefused = false;
  alice.on("error", e => { if (e.code === "OUT_OF_RANGE") distanceRefused = true; });
  alice.emit("chat.send", { to: charlieId, text: "远距离消息" });
  await sleep(300);
  check("远距离聊天被拒绝 (>3格)", distanceRefused);

  // ====== 5. 聊天：频率限制 ======
  console.log("\n── 5. 聊天频率限制 · Chat rate limit ──");
  let rateLimited = false;
  alice.on("error", e => { if (e.code === "RATE_LIMITED") rateLimited = true; });
  // 一秒内发 6 条（限 5 条/秒）
  for (let i = 0; i < 6; i++) {
    alice.emit("chat.send", { to: bobId, text: `消息 ${i + 1}` });
    await sleep(50);
  }
  await sleep(200);
  check("5条/秒频率限制生效", rateLimited);

  // ====== 6. 聊天：自聊守卫 ======
  console.log("\n── 6. 聊天自聊守卫 · Self-chat guard ──");
  let selfChatBlocked = false;
  alice.on("error", e => { if (e.code === "INVALID_MOVE" && !rateLimited) selfChatBlocked = true; });
  // 先清理 rateLimited 标记
  await sleep(1100);
  alice.emit("chat.send", { to: aliceId, text: "自言自语" });
  await sleep(300);
  // 用另一种方式验证
  alice.removeAllListeners("error");
  let selfChatErr;
  alice.on("error", e => { selfChatErr = e; });
  alice.emit("chat.send", { to: aliceId, text: "自言自语2" });
  await sleep(300);
  check("自聊被拒绝", selfChatErr?.code === "INVALID_MOVE");

  // ====== 7. 聊天历史 ======
  console.log("\n── 7. chat.history · 聊天历史 ──");
  let history;
  bob.on("chat.history", d => { history = d; });
  bob.emit("chat.history", { with: aliceId });
  await sleep(300);
  check("收到聊天历史", !!history);
  check("消息在历史中", history?.messages?.length > 0);
  check("hasMore 字段存在", typeof history?.hasMore === "boolean");

  // ====== 8. 好友：friend.request → friend.requested ======
  console.log("\n── 8. friend.request → friend.requested ──");
  let bobGotRequest;
  bob.on("friend.requested", d => { bobGotRequest = d; });
  alice.emit("friend.request", { to: bobId });
  await sleep(300);
  check("Bob 收到好友请求", !!bobGotRequest);
  check("请求来源正确", bobGotRequest?.from === aliceId);
  check("请求来源名正确", bobGotRequest?.fromName === "Alice");

  // ====== 9. 好友：重复请求被拒 ======
  console.log("\n── 9. 好友重复请求 · Duplicate request guard ──");
  let dupBlocked;
  alice.removeAllListeners("error");
  alice.on("error", e => { if (e.code === "ALREADY_FRIENDS") dupBlocked = e; });
  alice.emit("friend.request", { to: bobId });
  await sleep(300);
  check("重复请求被拒绝", !!dupBlocked, dupBlocked?.message);

  // ====== 10. 好友：friend.accept → friend.accepted ======
  console.log("\n── 10. friend.accept → friend.accepted ──");
  let aliceGotAccepted, bobGotAcceptedConf;
  alice.on("friend.accepted", d => { if (d.by === bobId) aliceGotAccepted = d; });
  bob.on("friend.accepted", d => { if (d.by === bobId) bobGotAcceptedConf = d; });
  bob.emit("friend.accept", { from: aliceId });
  await sleep(300);
  check("Alice 收到好友已接受", !!aliceGotAccepted);
  check("Bob 收到确认", !!bobGotAcceptedConf);
  check("接受者名正确", aliceGotAccepted?.byName === "Bob");

  // ====== 11. 好友：已是好友再请求 ======
  console.log("\n── 11. 已是好友再请求 · Already-friends guard ──");
  let alreadyFriends;
  alice.removeAllListeners("error");
  alice.on("error", e => { alreadyFriends = e; });
  alice.emit("friend.request", { to: bobId });
  await sleep(300);
  check("已是好友时请求被拒", alreadyFriends?.code === "ALREADY_FRIENDS");

  // ====== 12. profile.view 含真实 friendsCount ======
  console.log("\n── 12. profile.view · 资料含好友数 ──");
  let bobProfile;
  alice.on("profile.view", d => { if (d.id === bobId) bobProfile = d; });
  alice.emit("profile.view", { id: bobId });
  await sleep(300);
  check("查看 Bob 资料成功", !!bobProfile);
  check("friendsCount = 1", bobProfile?.friendsCount === 1, `实际: ${bobProfile?.friendsCount}`);
  check("isOnline = true", bobProfile?.isOnline === true);

  // ====== 13. zone.players isFriend 字段 ======
  console.log("\n── 13. zone.players · isFriend 字段 ──");
  // 让 Alice 跨区再回来触发 zone 快照 refresh
  await sleep(1100);
  for (let i = 0; i < 10; i++) {
    alice.emit("player.move", { x: 100 + i * 0.5, y: 75, direction: "right", moving: true });
    await sleep(80);
  }
  await sleep(300);
  // Bob 加入时就收到了 Alice，那时还不是好友，isFriend 应该是 false
  // 现在让 Charlie 查看 Bob（Charlie 不是 Bob 好友）
  let charlieZonePlayers;
  charlie.on("zone.players", d => { charlieZonePlayers = d.players; });
  // 让 Charlie 移回 Alice/Bob 附近触发 snapshot
  await sleep(1100);
  for (let i = 0; i < 40; i++) {
    charlie.emit("player.move", { x: 170 - i * 0.5, y: 80, direction: "left", moving: true });
    await sleep(60);
  }
  await sleep(500);
  // Charlie 不是 Bob 好友，isFriend 应该是 false
  // Alice 和 Bob 是好友，但我们不能直接从 Charlie 的视角验证
  // 验证 Charlie 收到的 snapshot 中包含非好友的 Alice 和 Bob
  if (charlieZonePlayers) {
    const aliceInZone = charlieZonePlayers.find(p => p.id === aliceId);
    const bobInZone = charlieZonePlayers.find(p => p.id === bobId);
    if (aliceInZone) check("Charlie 看到的 Alice isFriend=false", aliceInZone.isFriend === false);
    if (bobInZone) check("Charlie 看到的 Bob isFriend=false", bobInZone.isFriend === false);
  } else {
    check("Charlie 收到 zone.players", false, "未收到 zone.players");
  }

  // ====== 14. friend.reject ======
  console.log("\n── 14. friend.reject · 拒绝好友请求 ──");
  // Alice 给 Charlie 发好友请求
  let charlieGotRequest;
  charlie.on("friend.requested", d => { charlieGotRequest = d; });
  alice.removeAllListeners("error");
  alice.emit("friend.request", { to: charlieId });
  await sleep(300);
  check("Charlie 收到好友请求", !!charlieGotRequest);

  // Charlie 拒绝
  let rejectOk = true;
  charlie.on("error", () => { rejectOk = false; });
  charlie.emit("friend.reject", { from: aliceId });
  await sleep(300);
  check("拒绝成功（无错误）", rejectOk);

  // ====== 汇总 ======
  console.log("\n============================================================");
  console.log(`  结果: ${PASS} ${passed} 通过  ${FAIL} ${failed} 失败`);
  console.log("============================================================");

  alice.disconnect();
  bob.disconnect();
  charlie.disconnect();
  await sleep(500);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => { console.error("异常:", err.message); process.exit(1); });
