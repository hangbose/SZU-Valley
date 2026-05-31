/**
 * HUD — Heads-up display showing online count, zone name, and connection status.
 *
 * Overlaid on top of the Phaser canvas. Reads from Zustand store and keeps
 * pointer events transparent so the game remains clickable under the top bar.
 */

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { bridge } from "@/network/bridge";
import { getSocket } from "@/network/socket";
import { useGameStore } from "@/ui/store/gameStore";
import type { ConnectionStatus } from "@/ui/store/gameStore";

const MAX_PLAYERS = 50;
const DISCONNECTED_DELAY_MS = 2000;
const DEFAULT_ZONE_LABEL = "校园 · Campus";

const STATUS_COLORS: Record<ConnectionStatus, string> = {
  green: "#4caf50",
  yellow: "#ffc107",
  red: "#f44336",
};

const STATUS_LABELS: Record<ConnectionStatus, string> = {
  green: "已连接 · Connected",
  yellow: "重连中 · Reconnecting",
  red: "已断开 · Disconnected",
};

const ZONE_LABELS: Record<string, string> = {
  campus: DEFAULT_ZONE_LABEL,
  library: "图书馆 · Library",
};

export function HUD() {
  const onlineCount = useGameStore((s) => s.onlineCount);
  const zoneName = useGameStore((s) => s.zoneName);
  const connectionStatus = useGameStore((s) => s.connectionStatus);
  const playerId = useGameStore((s) => s.playerId);
  const playerName = useGameStore((s) => s.playerName);
  const setOnlineCount = useGameStore((s) => s.setOnlineCount);
  const setZoneName = useGameStore((s) => s.setZoneName);
  const setProfileTarget = useGameStore((s) => s.setProfileTarget);
  const [displayedStatus, setDisplayedStatus] = useState<ConnectionStatus>(
    connectionStatus === "red" ? "yellow" : connectionStatus,
  );
  const [isNarrow, setIsNarrow] = useState(() => getIsNarrowViewport());

  useEffect(() => {
    return bridge.on("zone-changed", ({ zoneName: nextZoneName }) => {
      setZoneName(nextZoneName);
    });
  }, [setZoneName]);

  useEffect(() => {
    const socket = getSocket();

    const handleZonePlayers = (payload: unknown) => {
      const nextCount = extractOnlineCount(payload);
      if (nextCount !== null) setOnlineCount(nextCount);
    };

    socket.on("zone.players", handleZonePlayers);

    return () => {
      socket.off("zone.players", handleZonePlayers);
    };
  }, [setOnlineCount]);

  useEffect(() => {
    const delay = connectionStatus === "red" ? DISCONNECTED_DELAY_MS : 0;
    const timeoutId = window.setTimeout(() => {
      setDisplayedStatus(connectionStatus);
    }, delay);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [connectionStatus]);

  useEffect(() => {
    const handleResize = () => {
      setIsNarrow(getIsNarrowViewport());
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const zoneLabel = formatZoneName(zoneName);
  const statusLabel = STATUS_LABELS[displayedStatus];

  return (
    <div
      style={{
        ...styles.bar,
        ...(isNarrow ? styles.narrowBar : styles.wideBar),
      }}
      aria-label="状态栏 · Status bar"
    >
      <div style={{ ...styles.section, ...styles.leftSection }} title={zoneLabel}>
        <span aria-hidden="true">📍</span>
        <span style={styles.truncatedText}>{zoneLabel}</span>
      </div>

      <div style={{ ...styles.section, ...styles.centerSection }}>
        <span aria-hidden="true">👥</span>
        <span>
          {onlineCount} / {MAX_PLAYERS}
        </span>
      </div>

      <div
        style={{ ...styles.section, ...styles.rightSection }}
        aria-live="polite"
        title={statusLabel}
      >
        {playerName && (
          <button
            type="button"
            onClick={() => playerId && setProfileTarget(playerId)}
            style={styles.profileBtn}
            title="我的资料 · My Profile"
          >
            {playerName}
          </button>
        )}
        <span
          style={{
            ...styles.statusDot,
            background: STATUS_COLORS[displayedStatus],
            boxShadow: `0 0 8px ${STATUS_COLORS[displayedStatus]}`,
          }}
          aria-hidden="true"
        />
        <span style={styles.truncatedText}>{statusLabel}</span>
      </div>
    </div>
  );
}

function extractOnlineCount(payload: unknown): number | null {
  if (Array.isArray(payload)) return payload.length;
  if (!payload || typeof payload !== "object") return null;

  const record = payload as Record<string, unknown>;
  const explicitCount =
    coerceCount(record.onlineCount) ?? coerceCount(record.count) ?? coerceCount(record.total);

  if (explicitCount !== null) return explicitCount;
  if (Array.isArray(record.players)) return record.players.length;

  return null;
}

function coerceCount(value: unknown): number | null {
  const count = typeof value === "string" ? Number(value.trim()) : value;
  if (typeof count !== "number" || !Number.isFinite(count)) return null;
  return Math.max(0, Math.trunc(count));
}

function formatZoneName(name: string): string {
  const trimmedName = name.trim();
  if (!trimmedName) return DEFAULT_ZONE_LABEL;

  const mappedLabel = ZONE_LABELS[trimmedName.toLowerCase()];
  if (mappedLabel) return mappedLabel;
  if (trimmedName.includes("·")) return trimmedName;

  return `区域 · ${trimmedName}`;
}

function getIsNarrowViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth < 600;
}

const styles: Record<string, CSSProperties> = {
  bar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    boxSizing: "border-box",
    width: "100%",
    background: "rgba(0,0,0,0.7)",
    color: "#ccc",
    fontSize: 14,
    lineHeight: 1.2,
    zIndex: 10,
    pointerEvents: "none",
    backdropFilter: "blur(6px)",
  },
  wideBar: {
    minHeight: 40,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto minmax(0, 1fr)",
    alignItems: "center",
    columnGap: 16,
    padding: "0 16px",
  },
  narrowBar: {
    minHeight: 46,
    display: "grid",
    gridTemplateColumns: "1fr",
    alignItems: "center",
    gap: 1,
    padding: "3px 10px",
    fontSize: 11,
    lineHeight: 1.1,
  },
  section: {
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    gap: 6,
    whiteSpace: "nowrap",
  },
  leftSection: {
    justifyContent: "flex-start",
  },
  centerSection: {
    justifyContent: "center",
    color: "#fff",
    fontWeight: 600,
  },
  rightSection: {
    justifyContent: "flex-end",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    display: "inline-block",
    flexShrink: 0,
  },
  truncatedText: {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  profileBtn: {
    maxWidth: 100,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    border: "1px solid rgba(76, 175, 80, 0.35)",
    borderRadius: 4,
    background: "rgba(76, 175, 80, 0.15)",
    color: "#4caf50",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 700,
    padding: "2px 8px",
    marginRight: 8,
    pointerEvents: "auto",
  },
};
