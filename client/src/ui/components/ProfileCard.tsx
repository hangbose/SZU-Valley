/**
 * ProfileCard — Popup card when a player is clicked.
 *
 * Shows avatar, name, tags, friend count, online status, and
 * action buttons ("Chat", "Add Friend").
 *
 * Positioned near the click point via screenX/screenY from bridge.
 *
 * TODO: Wire to bridge events + socket.
 */

import { useGameStore } from "@/ui/store/gameStore";

export function ProfileCard() {
  const profileTarget = useGameStore((s) => s.profileTarget);
  const setProfileTarget = useGameStore((s) => s.setProfileTarget);

  if (!profileTarget) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: 260,
        background: "rgba(0,0,0,0.9)",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.15)",
        padding: 24,
        pointerEvents: "auto",
        textAlign: "center",
      }}
    >
      {/* Avatar placeholder */}
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.1)",
          margin: "0 auto 12px",
        }}
      />

      <h3 style={{ color: "#fff", margin: "0 0 4px", fontSize: 18 }}>
        Player {profileTarget.slice(0, 8)}
      </h3>
      <p style={{ color: "#4caf50", fontSize: 12, margin: "0 0 12px" }}>
        ● Online
      </p>

      {/* TODO: Show tags, friendsCount from server response */}

      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
        <button
          style={{
            padding: "8px 20px",
            borderRadius: 6,
            border: "none",
            background: "#4caf50",
            color: "#fff",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          Chat
        </button>
        <button
          style={{
            padding: "8px 20px",
            borderRadius: 6,
            border: "1px solid rgba(255,255,255,0.2)",
            background: "transparent",
            color: "#ccc",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          Add Friend
        </button>
      </div>

      {/* Close */}
      <button
        onClick={() => setProfileTarget(null)}
        style={{
          position: "absolute",
          top: 8,
          right: 12,
          background: "none",
          border: "none",
          color: "#888",
          cursor: "pointer",
          fontSize: 18,
        }}
      >
        ×
      </button>
    </div>
  );
}
