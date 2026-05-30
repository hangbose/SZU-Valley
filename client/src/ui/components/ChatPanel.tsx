/**
 * ChatPanel — 1:1 chat with nearby players.
 *
 * Shows message bubbles for the currently active conversation. Input box
 * at the bottom. Auto-scrolls to latest message. Shows unread badge when
 * collapsed.
 *
 * TODO: Wire to useChat hook + socket events.
 */

import { useGameStore } from "@/ui/store/gameStore";

export function ChatPanel() {
  const activeChatId = useGameStore((s) => s.activeChatId);
  const messages = useGameStore(
    (s) => (activeChatId ? s.chatMessages[activeChatId] ?? [] : []),
  );
  const setActiveChatId = useGameStore((s) => s.setActiveChatId);

  if (!activeChatId) return null;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 16,
        left: 16,
        width: 320,
        maxHeight: 280,
        background: "rgba(0,0,0,0.85)",
        borderRadius: 8,
        border: "1px solid rgba(255,255,255,0.1)",
        display: "flex",
        flexDirection: "column",
        pointerEvents: "auto",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "8px 12px",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <span style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>
          Chat
        </span>
        <button
          onClick={() => setActiveChatId(null)}
          style={{
            background: "none",
            border: "none",
            color: "#888",
            cursor: "pointer",
            fontSize: 16,
          }}
        >
          ×
        </button>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "8px 12px",
          maxHeight: 180,
        }}
      >
        {messages.length === 0 && (
          <p style={{ color: "#666", fontSize: 12, textAlign: "center" }}>
            No messages yet.
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              marginBottom: 6,
              textAlign: m.isOwn ? "right" : "left",
            }}
          >
            <span
              style={{
                display: "inline-block",
                padding: "6px 10px",
                borderRadius: 8,
                background: m.isOwn
                  ? "rgba(76, 175, 80, 0.3)"
                  : "rgba(255,255,255,0.1)",
                color: "#ddd",
                fontSize: 13,
                maxWidth: "80%",
                wordBreak: "break-word",
              }}
            >
              {m.text}
            </span>
          </div>
        ))}
      </div>

      {/* Input */}
      <div style={{ padding: "8px 12px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
        <input
          type="text"
          placeholder="Type a message..."
          maxLength={500}
          style={{
            width: "100%",
            padding: "8px 10px",
            borderRadius: 6,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.08)",
            color: "#fff",
            fontSize: 13,
            outline: "none",
            boxSizing: "border-box",
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              // TODO: Emit chat.send via socket
              (e.target as HTMLInputElement).value = "";
            }
          }}
        />
      </div>
    </div>
  );
}
