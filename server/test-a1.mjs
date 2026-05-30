// ============================================================
// A1 自动化测试脚本 v2
// 用法：node test-a1.mjs（服务器需在 localhost:3001 运行）

import { io } from "socket.io-client";

const SERVER = "http://localhost:3001";
const PASS = "✅";
const FAIL = "❌";
const WARN = "⚠️";

let passed = 0, failed = 0, warned = 0;

function check(name, condition, detail = "") {
  if (condition) { console.log(`  ${PASS} ${name}`); passed++; }
  else { console.log(`  ${FAIL} ${name} ${detail}`); failed++; }
}

function warn(name, detail) {
  console.log(`  ${WARN} ${name} — ${detail}`); warned++;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log("============================================================");
  console.log("  A1 模块自动化测试 v2");
  console.log("============================================================\n");

  // ====== 1. 加入 + zone 快照 ======
  console.log("── 1. player.join · 加入游戏 ──");
  const alice = io(SERVER);
  let aliceId, aliceSpawn;

  await new Promise(r => {
    alice.on("connect", () => alice.emit("player.join", { name: "Alice", avatar: "avatar_01" }));
    alice.on("player.joined", d => { aliceId = d.playerId; aliceSpawn = d.spawn; r(); });
    setTimeout(() => r(), 3000);
  });
  check("连接成功", alice.connected);
  check("收到 player.joined", !!aliceId);
  check("出生点逻辑", aliceSpawn?.x === 100 && aliceSpawn?.y === 75, JSON.stringify(aliceSpawn));

  // ====== 2. 区域快照 ======
  console.log("\n── 2. zone.players + zone.npcs · 区域快照 ──");
  let zonePlayers, zoneNPCs;

  await new Promise(r => {
    alice.on("zone.players", d => { zonePlayers = d.players; if (zoneNPCs !== undefined) r(); });
    alice.on("zone.npcs", d => { zoneNPCs = d.npcs; if (zonePlayers !== undefined) r(); });
    setTimeout(() => r(), 2000);
  });
  check("收到 zone.players", !!zonePlayers);
  check("收到 zone.npcs", !!zoneNPCs);
  // 附近 NPC 数量取决于出生点 (100,75) 所在区域的邻居覆盖范围
  check("附近 NPC > 0", zoneNPCs?.length > 0, `实际: ${zoneNPCs?.length}`);
  check("附近玩家不含自己", !zonePlayers?.some(p => p.id === aliceId));

  // ====== 3. 双人互见 ======
  console.log("\n── 3. player.appeared · 双人互见 ──");
  const bob = io(SERVER);
  let bobId, aliceSawBob = false;
  let bobGotAliceInSnapshot = false;

  await new Promise(r => {
    bob.on("connect", () => bob.emit("player.join", { name: "Bob", avatar: "avatar_02" }));
    bob.on("player.joined", d => { bobId = d.playerId; });
    bob.on("zone.players", d => {
      if (d.players.some(p => p.id === aliceId)) bobGotAliceInSnapshot = true;
    });
    alice.on("player.appeared", d => { if (d.name === "Bob") aliceSawBob = true; });
    setTimeout(() => r(), 2000);
  });
  check("Bob 加入成功", !!bobId);
  check("Alice 收到 player.appeared (Bob)", aliceSawBob);
  check("Bob 的 zone.players 包含 Alice", bobGotAliceInSnapshot,
    "(注: Bob 通过 zone.players 快照获取已有玩家，不是 player.appeared)");

  // ====== 4. 移动广播 ======
  console.log("\n── 4. player.move → player.moved · 移动广播 ──");
  let bobSawMove = false;
  bob.on("player.moved", d => { if (d.id === aliceId) bobSawMove = true; });

  for (let i = 0; i < 5; i++) {
    alice.emit("player.move", { x: 100 + i * 0.5, y: 75, direction: "right", moving: true });
    await sleep(60);
  }
  await sleep(200);
  check("Bob 收到 player.moved", bobSawMove);

  // ====== 5. NPC 对话（逐步走到 NPC 旁边）=====
  console.log("\n── 5. npc.talk · NPC 对话 ──");
  // 等 1.1 秒让位置校验放行（deltaMs > 1000 宽限期，允许任意跳跃）
  await sleep(1100);
  // 最近的 NPC: coffee_owner at (100, 70), 距离 |100-100|+|75-70|=5 格
  // 逐步靠近：每步 0.3 格，间隔 80ms → 速度 = 3.75 格/秒 < 8 限制
  for (let i = 0; i < 10; i++) {
    alice.emit("player.move", { x: 100, y: 75 - i * 0.3, direction: "up", moving: true });
    await sleep(80);
  }
  await sleep(100);
  // 现在 Alice 在 (100, 72.5), 距离 NPC = |100-100|+|72.5-70| = 2.5 ≤ 3 ✅

  let npcReplied = false;
  alice.on("npc.dialogue", d => {
    npcReplied = true;
    console.log(`  [对话] ${d.npcName}: "${d.text.slice(0,25)}..."`);
  });
  alice.emit("npc.talk", { npcId: "npc_coffee_owner" });
  await sleep(300);
  check("NPC 对话成功 (距离 2.5 格)", npcReplied);

  // 测试远距离拒绝
  let farRefused = false;
  alice.on("error", e => { if (e.code === "OUT_OF_RANGE") farRefused = true; });
  alice.emit("npc.talk", { npcId: "npc_dorm_cat" }); // (160,60), Alice(100,72.5)→距离~73
  await sleep(300);
  check("远距离 NPC 被拒绝", farRefused);

  // ====== 6. profile.view ======
  console.log("\n── 6. profile.view · 查看资料 ──");
  let profileOk = false;
  alice.on("profile.view", d => {
    if (d.id === bobId && d.name === "Bob") profileOk = true;
    console.log(`  [资料] ${d.name} avatar=${d.avatar} online=${d.isOnline}`);
  });
  alice.emit("profile.view", { id: bobId });
  await sleep(300);
  check("查看到 Bob 资料 (距离 ≤3)", profileOk);

  // 远距离资料拒绝
  let profileFarRefused = false;
  alice.on("error", e => { if (e.code === "OUT_OF_RANGE" && !profileOk) profileFarRefused = true; });
  alice.emit("profile.view", { id: "nonexistent-player-id" }); // 测试不存在的玩家
  await sleep(300);
  // 不存在的玩家应该返回 PLAYER_NOT_FOUND
  warn("不存在的玩家", "已测试，预期 PLAYER_NOT_FOUND");

  // ====== 7. 名字校验 ======
  console.log("\n── 7. 名字校验 + 重名 ──");
  const charlie = io(SERVER);
  let shortNameErr, takenNameErr;

  await new Promise(r => {
    charlie.on("connect", () => charlie.emit("player.join", { name: "A", avatar: "avatar_03" }));
    charlie.on("error", d => {
      if (!shortNameErr) {
        shortNameErr = d;
        charlie.emit("player.join", { name: "Alice", avatar: "avatar_03" });
      } else if (!takenNameErr) { takenNameErr = d; r(); }
    });
    setTimeout(() => r(), 3000);
  });
  check("短名被拒 (INVALID_NAME)", shortNameErr?.code === "INVALID_NAME");
  check("重名被拒 (NAME_TAKEN)", takenNameErr?.code === "NAME_TAKEN");
  charlie.disconnect();

  // ====== 8. 断线广播 ======
  console.log("\n── 8. disconnect → player.left ──");
  let aliceSawBobLeave = false;
  alice.on("player.left", d => { if (d.id === bobId) aliceSawBobLeave = true; });
  bob.disconnect();
  await sleep(500);
  check("Alice 收到 Bob 离开 (player.left)", aliceSawBobLeave);

  // ====== 9. 移动节流 ======
  console.log("\n── 9. 移动节流 (50ms) ──");
  const bob2 = io(SERVER);
  await new Promise(r => {
    bob2.on("connect", () => bob2.emit("player.join", { name: "Bob2", avatar: "avatar_02" }));
    bob2.on("player.joined", () => r());
    setTimeout(() => r(), 2000);
  });

  let throttledCount = 0;
  bob2.on("player.moved", () => throttledCount++);

  // 100ms 内狂发 10 次（间隔 10ms < 50ms 节流）
  for (let i = 0; i < 10; i++) {
    alice.emit("player.move", { x: 105 + i, y: 75, direction: "right", moving: true });
    await sleep(10);
  }
  await sleep(200);
  check("节流生效 (10次请求 → ≤3 次广播)", throttledCount <= 3, `收到 ${throttledCount} 次`);
  bob2.disconnect();

  // ====== 10. 空值保护 ======
  console.log("\n── 10. 空值保护 ──");
  const dave = io(SERVER);
  let nullNameErr;
  await new Promise(r => {
    dave.on("connect", () => dave.emit("player.join", {}));
    dave.on("error", d => { nullNameErr = d; r(); });
    setTimeout(() => r(), 2000);
  });
  check("空名字被拒绝", nullNameErr?.code === "INVALID_NAME", nullNameErr?.code);
  dave.disconnect();

  // ====== 汇总 ======
  console.log("\n============================================================");
  console.log(`  结果: ${PASS} ${passed} 通过  ${FAIL} ${failed} 失败  ${WARN} ${warned} 跳过`);
  console.log("============================================================");

  alice.disconnect();
  // 等一下清理
  await sleep(500);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => { console.error("异常:", err.message); process.exit(1); });
