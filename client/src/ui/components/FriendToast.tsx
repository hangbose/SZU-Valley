/**
 * FriendToast — Slides in from top-right when someone sends a friend request.
 *
 * Shows sender name, Accept / Reject buttons, auto-dismisses after 3s.
 *
 * TODO: Wire to `friend.requested` socket event. Emit `friend.accept` / `friend.reject`.
 */

import { useEffect } from "react";
import { useGameStore } from "@/ui/store/gameStore";

export function FriendToast() {
  const pendingRequests = useGameStore((s) => s.pendingRequests);
  const removePendingRequest = useGameStore((s) => s.removePendingRequest);

  // Auto-dismiss after 3s
  useEffect(() => {
    if (pendingRequests.length === 0) return;
    const timer = setTimeout(() => {
      pendingRequests.forEach((r) => removePendingRequest(r.from));
    }, 3000);
    return () => clearTimeout(timer);
  }, [pendingRequests, removePendingRequest]);

  if (pendingRequests.length === 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 60,
        right: 220,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        pointerEvents: "auto",
        zIndex: 100,
      }}
    >
      {pendingRequests.map((req) => (
        <div
          key={req.from}
          style={{
            background: "rgba(0,0,0,0.9)",
            borderRadius: 8,
            border: "1px solid rgba(76, 175, 80, 0.3)",
            padding: "12px 16px",
            minWidth: 240,
            animation: "slideIn 0.3s ease-out",
          }}
        >
          <p style={{ color: "#fff", fontSize: 13, margin: "0 0 8px" }}>
            <strong>{req.fromName}</strong> sent a friend request
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => {
                // TODO: Emit friend.accept
                removePendingRequest(req.from);
              }}
              style={{
                padding: "4px 16px",
                borderRadius: 4,
                border: "none",
                background: "#4caf50",
                color: "#fff",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              Accept
            </button>
            <button
              onClick={() => {
                // TODO: Emit friend.reject
                removePendingRequest(req.from);
              }}
              style={{
                padding: "4px 16px",
                borderRadius: 4,
                border: "1px solid rgba(255,255,255,0.15)",
                background: "transparent",
                color: "#888",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
