/**
 * FriendsList — Sidebar showing online/offline friends.
 *
 * Online friends show a green dot and their name is clickable to
 * focus the camera on them. Offline friends show a grey dot.
 *
 * TODO: Wire to useFriends hook + socket events.
 */

import { useGameStore } from "@/ui/store/gameStore";

export function FriendsList() {
  const friends = useGameStore((s) => s.friends);

  return (
    <div
      style={{
        background: "rgba(0,0,0,0.7)",
        borderRadius: "8px 0 0 8px",
        padding: "12px",
        height: "100%",
        boxSizing: "border-box",
        overflowY: "auto",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRight: "none",
      }}
    >
      <h4
        style={{
          color: "#aaa",
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: 1,
          margin: "0 0 8px",
        }}
      >
        Friends ({friends.length})
      </h4>

      {friends.length === 0 && (
        <p style={{ color: "#555", fontSize: 12 }}>
          No friends yet. Walk up to someone and send a request!
        </p>
      )}

      {friends.map((f) => (
        <div
          key={f.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 4px",
            cursor: "pointer",
            borderRadius: 4,
          }}
          title={`Click to find ${f.name}`}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: f.isOnline ? "#4caf50" : "#555",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              color: f.isOnline ? "#ddd" : "#666",
              fontSize: 13,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {f.name}
          </span>
        </div>
      ))}
    </div>
  );
}
