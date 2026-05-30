// ============================================================
// A1 · 位置校验器 · Position Validator (Anti-Cheat)
// ============================================================
//
// 防止瞬移作弊：检查"给定上次位置，这次位置在物理上是否可能到达？"
// Prevents teleport cheating: "given your last position, is it
// physically possible to reach this new position in the elapsed time?"
//
// 最大速度 = 8 格/秒（远超正常走路速度，留足余量）
// Max speed = 8 tiles/sec (far above normal walking, generous margin)

import { MAX_SPEED } from "../types.js";
import type { ValidationResult } from "../types.js";

/**
 * 校验一次位移是否合法。
 * Validate a single movement delta.
 *
 * @param prevX   上次合法的 X 坐标
 * @param prevY   上次合法的 Y 坐标
 * @param newX    客户端声称的新 X 坐标
 * @param newY    客户端声称的新 Y 坐标
 * @param deltaMs 距离上次更新经过的毫秒数
 * @param maxSpeed 最大允许速度（瓦片/秒），默认 8
 */
export function validateMove(
  prevX: number,
  prevY: number,
  newX: number,
  newY: number,
  deltaMs: number,
  maxSpeed: number = MAX_SPEED
): ValidationResult {
  // ---- 安全检查：NaN / Infinity ----

  if (
    isNaN(newX) ||
    isNaN(newY) ||
    !isFinite(newX) ||
    !isFinite(newY)
  ) {
    return { valid: false, reason: "坐标包含非法值 (NaN/Infinity)" };
  }

  // ---- 如果距离上次更新超过 1 秒，放行（防止网络卡顿后误杀）----
  // If >1s since last update, allow any position (prevent false
  // positives after a network hiccup).

  if (deltaMs > 1000) {
    return { valid: true };
  }

  // ---- 计算实际距离（欧几里得）vs 最大允许距离 ----

  const dx = newX - prevX;
  const dy = newY - prevY;
  const actualDistance = Math.sqrt(dx * dx + dy * dy);

  const maxAllowedDistance = maxSpeed * (deltaMs / 1000);

  if (actualDistance > maxAllowedDistance) {
    return {
      valid: false,
      reason: `移动过快: ${actualDistance.toFixed(2)} 格 / ${deltaMs}ms ` +
        `(最大允许 ${maxAllowedDistance.toFixed(2)} 格)`,
    };
  }

  return { valid: true };
}
