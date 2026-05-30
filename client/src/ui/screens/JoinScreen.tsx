/**
 * JoinScreen — Name input + avatar picker + "Enter Campus" button.
 *
 * Full-screen, shown before the player joins the game world.
 * Validates name length (2–12 chars) and requires an avatar selection.
 */

import { useCallback, useEffect, useState } from "react";
import { useGameStore } from "@/ui/store/gameStore";
import { connect } from "@/network/socket";

const AVATARS = Array.from({ length: 8 }, (_, i) => `avatar_${String(i + 1).padStart(2, "0")}`);

const JOIN_TIMEOUT = 8000; // 8 秒超时

// localStorage keys for session persistence (方案 A)
const LS_PLAYER_ID = "szu_valley_playerId";
const LS_PLAYER_NAME = "szu_valley_playerName";
const LS_PLAYER_AVATAR = "szu_valley_playerAvatar";

export function JoinScreen() {
  const setPhase = useGameStore((s) => s.setPhase);
  const setPlayer = useGameStore((s) => s.setPlayer);
  const setSpawn = useGameStore((s) => s.setSpawn);

  // Restore saved identity on first visit
  const [name, setName] = useState(() => {
    try { return localStorage.getItem(LS_PLAYER_NAME) ?? ""; } catch { return ""; }
  });
  const [avatar, setAvatar] = useState(() => {
    try { return localStorage.getItem(LS_PLAYER_AVATAR) ?? AVATARS[0]; } catch { return AVATARS[0]; }
  });
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);

  const isValid = name.trim().length >= 2 && name.trim().length <= 12;

  const handleJoin = useCallback(() => {
    if (!isValid || joining) return;
    setError("");
    setJoining(true);

    const socket = connect();
    let done = false;

    const cleanup = () => {
      done = true;
      socket.off("player.joined");
      socket.off("error");
    };

    // Success: server assigned us an ID and spawn point
    socket.on("player.joined", (data: { playerId: string; spawn: { x: number; y: number } }) => {
      if (done) return;
      cleanup();

      // Save identity to localStorage for next visit
      try {
        localStorage.setItem(LS_PLAYER_ID, data.playerId);
        localStorage.setItem(LS_PLAYER_NAME, name.trim());
        localStorage.setItem(LS_PLAYER_AVATAR, avatar);
      } catch { /* localStorage unavailable */ }

      setPlayer(data.playerId, name.trim(), avatar);
      setSpawn(data.spawn.x, data.spawn.y);
      setPhase("game");
    });

    // Error: name taken, invalid, server full, etc.
    socket.on("error", (err: { code?: string; message?: string }) => {
      if (done) return;
      cleanup();

      const msg = err?.message ?? formatErrorCode(err?.code);
      setError(msg);
      setJoining(false);
    });

    // Timeout
    setTimeout(() => {
      if (done) return;
      cleanup();
      setError("连接服务器超时，请确认服务器已启动 · Server connection timed out");
      setJoining(false);
    }, JOIN_TIMEOUT);

    // Fire (include saved playerId for session restoration)
    const savedPlayerId = (() => {
      try { return localStorage.getItem(LS_PLAYER_ID)?.trim() || undefined; } catch { return undefined; }
    })();
    socket.emit("player.join", { name: name.trim(), avatar, playerId: savedPlayerId });
  }, [isValid, joining, name, avatar, setPlayer, setPhase]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && isValid) handleJoin();
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>SZU Valley</h1>
        <p style={styles.subtitle}>深大像素校园</p>

        {/* Name input */}
        <div style={styles.field}>
          <label style={styles.label}>Your Name</label>
          <input
            style={styles.input}
            type="text"
            placeholder="Enter your name (2–12 chars)"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
            onKeyDown={handleKeyDown}
            maxLength={12}
            autoFocus
          />
          {error && <p style={styles.error}>{error}</p>}
        </div>

        {/* Avatar picker */}
        <div style={styles.field}>
          <label style={styles.label}>Pick an Avatar</label>
          <div style={styles.avatarGrid}>
            {AVATARS.map((a) => (
              <button
                key={a}
                style={{
                  ...styles.avatarBtn,
                  ...(avatar === a ? styles.avatarSelected : {}),
                }}
                onClick={() => setAvatar(a)}
                title={a}
              >
                {a.replace("avatar_", "")}
              </button>
            ))}
          </div>
        </div>

        {/* Join button */}
        <button
          style={{
            ...styles.joinBtn,
            ...(!isValid || joining ? styles.joinBtnDisabled : {}),
          }}
          disabled={!isValid || joining}
          onClick={handleJoin}
        >
          {joining ? "连接中… · Connecting…" : "Enter Campus"}
        </button>

        <p style={styles.hint}>No account needed — just pick a name and join.</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100vw",
    height: "100vh",
    background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
  },
  card: {
    background: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    padding: "48px 40px",
    width: 400,
    textAlign: "center",
    backdropFilter: "blur(10px)",
    border: "1px solid rgba(255,255,255,0.1)",
  },
  title: {
    fontSize: 36,
    fontWeight: 700,
    color: "#4caf50",
    margin: 0,
  },
  subtitle: {
    fontSize: 16,
    color: "#888",
    marginTop: 4,
    marginBottom: 32,
  },
  field: {
    marginBottom: 24,
    textAlign: "left",
  },
  label: {
    display: "block",
    fontSize: 13,
    color: "#aaa",
    marginBottom: 8,
    fontWeight: 600,
  },
  input: {
    width: "100%",
    padding: "10px 14px",
    fontSize: 16,
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(255,255,255,0.08)",
    color: "#fff",
    outline: "none",
    boxSizing: "border-box",
  },
  error: {
    color: "#ef5350",
    fontSize: 12,
    marginTop: 6,
    marginBottom: 0,
  },
  avatarGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 8,
  },
  avatarBtn: {
    width: "100%",
    aspectRatio: "1",
    borderRadius: 8,
    border: "2px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.05)",
    color: "#ccc",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
  },
  avatarSelected: {
    border: "2px solid #4caf50",
    background: "rgba(76, 175, 80, 0.15)",
    color: "#4caf50",
  },
  joinBtn: {
    width: "100%",
    padding: "14px",
    fontSize: 18,
    fontWeight: 700,
    borderRadius: 8,
    border: "none",
    background: "#4caf50",
    color: "#fff",
    cursor: "pointer",
    marginTop: 8,
  },
  joinBtnDisabled: {
    background: "#333",
    color: "#666",
    cursor: "not-allowed",
  },
  hint: {
    fontSize: 12,
    color: "#555",
    marginTop: 16,
    marginBottom: 0,
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatErrorCode(code?: string): string {
  switch (code) {
    case "NAME_TAKEN":
      return "这个名字已被使用，换一个吧 · Name already taken";
    case "INVALID_NAME":
      return "名字需要 2–12 个字符 · Name must be 2–12 characters";
    case "SERVER_FULL":
      return "服务器已满，请稍后再试 · Server is full";
    default:
      return "连接失败，请重试 · Connection failed, try again";
  }
}
