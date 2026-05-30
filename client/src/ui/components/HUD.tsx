/**
 * HUD — Heads-up display showing online count, zone name, and connection status.
 *
 * Overlaid on top of the Phaser canvas. Reads from Zustand store.
 */

import { useGameStore } from "@/ui/store/gameStore";
import type { ConnectionStatus } from "@/ui/store/gameStore";

const STATUS_COLORS: Record<ConnectionStatus, string> = {
  green: "#4caf50",
  yellow: "#ff9800",
  red: "#ef5350",
};

export function HUD() {
  const onlineCount = useGameStore((s) => s.onlineCount);
  const zoneName = useGameStore((s) => s.zoneName);
  const connectionStatus = useGameStore((s) => s.connectionStatus);

  return (
    <div
      style={{
        position: "absolute",
        top: 8,
        left: 8,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "6px 14px",
        background: "rgba(0,0,0,0.6)",
        borderRadius: 20,
        fontSize: 12,
        color: "#ccc",
        pointerEvents: "auto",
        backdropFilter: "blur(4px)",
      }}
    >
      {/* Connection dot */}
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: STATUS_COLORS[connectionStatus],
          display: "inline-block",
        }}
        title={`Connection: ${connectionStatus}`}
      />

      {/* Online count */}
      <span>
        👥 {onlineCount}/50
      </span>

      {/* Zone name */}
      {zoneName && (
        <span style={{ color: "#888" }}>
          📍 {zoneName}
        </span>
      )}
    </div>
  );
}
