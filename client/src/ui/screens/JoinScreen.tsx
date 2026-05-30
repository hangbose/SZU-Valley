/**
 * JoinScreen — Name input + avatar picker + "Enter Campus" button.
 *
 * Full-screen, shown before the player joins the game world.
 * Validates name length (2–12 chars) and requires an avatar selection.
 */

import { useState } from "react";
import { useGameStore } from "@/ui/store/gameStore";

const AVATARS = Array.from({ length: 8 }, (_, i) => `avatar_${String(i + 1).padStart(2, "0")}`);

export function JoinScreen() {
  const setPhase = useGameStore((s) => s.setPhase);
  const setPlayer = useGameStore((s) => s.setPlayer);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [error, setError] = useState("");

  const isValid = name.trim().length >= 2 && name.trim().length <= 12;

  const handleJoin = () => {
    if (!isValid) {
      setError("Name must be 2–12 characters.");
      return;
    }
    setError("");
    // Placeholder: real join will emit player.join via socket
    // For now, transition directly to game phase.
    setPlayer("local-" + crypto.randomUUID().slice(0, 8), name.trim(), avatar);
    setPhase("game");
  };

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
            ...(!isValid ? styles.joinBtnDisabled : {}),
          }}
          disabled={!isValid}
          onClick={handleJoin}
        >
          Enter Campus
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
