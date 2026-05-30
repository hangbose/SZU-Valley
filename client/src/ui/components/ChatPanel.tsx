/**
 * ChatPanel — Floating 1:1 chat panel for the Phaser overlay.
 *
 * The app-level overlay uses pointer-events: none, so this component keeps
 * pointer-events scoped to the visible panel and its controls.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import type { ChatMessage } from "@/network/bridge";
import { getSocket } from "@/network/socket";
import { useGameStore } from "@/ui/store/gameStore";
import type { Message } from "@/ui/store/gameStore";

const MAX_MESSAGE_LENGTH = 500;
const SCROLL_LOCK_THRESHOLD = 48;
const HISTORY_TIMEOUT_MS = 8000;
const EMPTY_MESSAGES: Message[] = [];

type ParsedHistory =
  | { kind: "messages"; messages: ChatMessage[] }
  | { kind: "error"; error: string };

export function ChatPanel() {
  const activeChatId = useGameStore((s) => s.activeChatId);

  if (!activeChatId) return null;

  return <ActiveChatPanel key={activeChatId} activeChatId={activeChatId} />;
}

function ActiveChatPanel({ activeChatId }: { activeChatId: string }) {
  const playerId = useGameStore((s) => s.playerId);
  const playerName = useGameStore((s) => s.playerName);
  const friends = useGameStore((s) => s.friends);
  const messages = useGameStore((s) => s.chatMessages[activeChatId] ?? EMPTY_MESSAGES);
  const addMessage = useGameStore((s) => s.addMessage);
  const setMessages = useGameStore((s) => s.setMessages);
  const setActiveChatId = useGameStore((s) => s.setActiveChatId);

  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const shouldStickToBottomRef = useRef(true);

  const targetName = useMemo(() => {
    const friend = friends.find((f) => f.id === activeChatId);
    const namedMessage = messages.find((m) => !m.isOwn && m.fromName.trim().length > 0);
    const shortId = activeChatId.slice(0, 8);

    return friend?.name ?? namedMessage?.fromName ?? `玩家 ${shortId} · Player ${shortId}`;
  }, [activeChatId, friends, messages]);

  const sendDisabled = !draft.trim() || !playerId;

  const scrollToBottom = useCallback(() => {
    const node = messageListRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, []);

  const handleScroll = useCallback(() => {
    const node = messageListRef.current;
    if (!node) return;

    const distanceFromBottom = node.scrollHeight - node.scrollTop - node.clientHeight;
    shouldStickToBottomRef.current = distanceFromBottom <= SCROLL_LOCK_THRESHOLD;
  }, []);

  const handleSend = useCallback(() => {
    if (!activeChatId || !playerId) {
      setError("无法发送消息 · Unable to send message");
      return;
    }

    const text = draft.trim().slice(0, MAX_MESSAGE_LENGTH);
    if (!text) return;

    const optimisticMessage: Message = {
      id: crypto.randomUUID(),
      from: playerId,
      fromName: playerName || "我 · Me",
      text,
      timestamp: Date.now(),
      isOwn: true,
    };

    shouldStickToBottomRef.current = true;
    addMessage(activeChatId, optimisticMessage);
    getSocket().emit("chat.send", { to: activeChatId, text });
    setDraft("");
    setError(null);
  }, [activeChatId, addMessage, draft, playerId, playerName]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key !== "Enter" || event.shiftKey) return;
      event.preventDefault();
      handleSend();
    },
    [handleSend],
  );

  useEffect(() => {
    let isCancelled = false;
    let hasHistoryArrived = false;
    const socket = getSocket();

    shouldStickToBottomRef.current = true;

    const finishLoading = () => {
      if (!isCancelled) setIsLoading(false);
    };

    const handleHistoryPayload = (payload: unknown) => {
      if (isCancelled) return;

      const history = parseHistoryPayload(payload, activeChatId);
      if (!history) return;

      if (history.kind === "error") {
        setError(history.error);
        finishLoading();
        return;
      }

      hasHistoryArrived = true;
      setError(null);
      setMessages(
        activeChatId,
        history.messages.map((message) => toStoreMessage(message, playerId)),
      );
      finishLoading();
    };

    const handleHistoryAck = (...args: unknown[]) => {
      if (isCancelled || args.length === 0) return;

      const [possibleError, possiblePayload] = args;
      if (possiblePayload !== undefined && isSocketErrorPayload(possibleError)) {
        setError(formatChatError(possibleError));
        finishLoading();
        return;
      }

      handleHistoryPayload(possiblePayload ?? possibleError);
    };

    const handleReceive = (payload: unknown) => {
      const message = coerceChatMessage(payload);
      if (!message || !matchesConversation(message, activeChatId, playerId)) return;
      addMessage(activeChatId, toStoreMessage(message, playerId));
    };

    const handleChatError = (payload: unknown) => {
      setError(formatChatError(payload));
      finishLoading();
    };

    const timeoutId = window.setTimeout(() => {
      if (isCancelled || hasHistoryArrived) return;
      setError("历史消息加载超时 · History loading timed out");
      setIsLoading(false);
    }, HISTORY_TIMEOUT_MS);

    socket.on("chat.history", handleHistoryPayload);
    socket.on("chat.history.response", handleHistoryPayload);
    socket.on("chat.receive", handleReceive);
    socket.on("chat.error", handleChatError);
    socket.emit("chat.history", { with: activeChatId }, handleHistoryAck);

    return () => {
      isCancelled = true;
      window.clearTimeout(timeoutId);
      socket.off("chat.history", handleHistoryPayload);
      socket.off("chat.history.response", handleHistoryPayload);
      socket.off("chat.receive", handleReceive);
      socket.off("chat.error", handleChatError);
    };
  }, [activeChatId, addMessage, playerId, setMessages]);

  useEffect(() => {
    if (!shouldStickToBottomRef.current) return;
    window.requestAnimationFrame(scrollToBottom);
  }, [activeChatId, isLoading, messages, scrollToBottom]);

  return (
    <div style={styles.shell}>
      <section style={styles.panel} aria-label="聊天面板 · Chat panel">
        <header style={styles.header}>
          <div style={styles.headerText}>
            <strong style={styles.title} title={targetName}>
              {targetName}
            </strong>
            <span style={styles.subtitle}>私聊 · Direct chat</span>
          </div>
          <button
            type="button"
            aria-label="关闭聊天 · Close chat"
            title="关闭聊天 · Close chat"
            onClick={() => setActiveChatId(null)}
            style={styles.closeButton}
          >
            ×
          </button>
        </header>

        <div style={styles.body}>
          {error && <div style={styles.errorBanner}>{error}</div>}

          <div
            ref={messageListRef}
            onScroll={handleScroll}
            role="log"
            aria-live="polite"
            style={styles.messageList}
          >
            {isLoading && messages.length > 0 && (
              <div style={styles.inlineStatus}>正在加载历史消息… · Loading history…</div>
            )}

            {messages.length === 0 ? (
              <div style={styles.emptyState}>
                {isLoading
                  ? "正在加载历史消息… · Loading history…"
                  : "开始聊天吧！· Start chatting!"}
              </div>
            ) : (
              messages.map((message) => (
                <MessageBubble key={message.id} message={message} playerName={playerName} />
              ))
            )}
          </div>
        </div>

        <footer style={styles.footer}>
          <textarea
            value={draft}
            maxLength={MAX_MESSAGE_LENGTH}
            rows={2}
            onChange={(event) => setDraft(event.currentTarget.value.slice(0, MAX_MESSAGE_LENGTH))}
            onKeyDown={handleKeyDown}
            placeholder="输入消息… · Type a message..."
            aria-label="输入消息 · Type a message"
            style={styles.input}
          />
          <button
            type="button"
            disabled={sendDisabled}
            onClick={handleSend}
            style={{
              ...styles.sendButton,
              ...(sendDisabled ? styles.sendButtonDisabled : {}),
            }}
          >
            发送 · Send
          </button>
        </footer>
      </section>
    </div>
  );
}

function MessageBubble({
  message,
  playerName,
}: {
  message: Message;
  playerName: string;
}) {
  const isTruncated = message.text.length > MAX_MESSAGE_LENGTH;
  const displayText = isTruncated
    ? `${message.text.slice(0, MAX_MESSAGE_LENGTH)}…`
    : message.text;
  const senderName = message.isOwn
    ? playerName
      ? `我 · Me (${playerName})`
      : "我 · Me"
    : message.fromName || "对方 · Them";

  return (
    <div
      style={{
        ...styles.messageRow,
        alignItems: message.isOwn ? "flex-end" : "flex-start",
      }}
    >
      <span
        style={{
          ...styles.senderName,
          textAlign: message.isOwn ? "right" : "left",
        }}
        title={senderName}
      >
        {senderName}
      </span>
      <span
        title={isTruncated ? message.text : undefined}
        style={{
          ...styles.bubble,
          ...(message.isOwn ? styles.ownBubble : styles.otherBubble),
        }}
      >
        {displayText}
      </span>
    </div>
  );
}

function parseHistoryPayload(
  payload: unknown,
  activeChatId: string,
): ParsedHistory | null {
  if (Array.isArray(payload)) {
    return { kind: "messages", messages: payload.map(coerceChatMessage).filter(isChatMessage) };
  }

  if (!isRecord(payload)) return null;

  if (typeof payload.error === "string") {
    return { kind: "error", error: `历史消息错误 · History error: ${payload.error}` };
  }

  const conversationId = getString(payload, "conversationId")
    ?? getString(payload, "with")
    ?? getString(payload, "peerId")
    ?? getString(payload, "playerId");

  if (conversationId && conversationId !== activeChatId) return null;

  if (!Array.isArray(payload.messages)) return null;

  return {
    kind: "messages",
    messages: payload.messages.map(coerceChatMessage).filter(isChatMessage),
  };
}

function coerceChatMessage(value: unknown): ChatMessage | null {
  if (!isRecord(value)) return null;

  const from = getString(value, "from");
  const text = getString(value, "text");
  if (!from || text === null) return null;

  const id = getString(value, "id") ?? crypto.randomUUID();
  const fromName = getString(value, "fromName") ?? `玩家 ${from.slice(0, 8)} · Player ${from.slice(0, 8)}`;
  const to = getString(value, "to") ?? "";
  const rawTimestamp = value.timestamp;

  return {
    id,
    from,
    fromName,
    to,
    text,
    timestamp: typeof rawTimestamp === "number" ? rawTimestamp : Date.now(),
  };
}

function toStoreMessage(message: ChatMessage, playerId: string | null): Message {
  return {
    id: message.id,
    from: message.from,
    fromName: message.fromName,
    text: message.text,
    timestamp: message.timestamp,
    isOwn: playerId !== null && message.from === playerId,
  };
}

function matchesConversation(
  message: ChatMessage,
  activeChatId: string,
  playerId: string | null,
): boolean {
  if (!playerId) {
    return message.from === activeChatId || message.to === activeChatId;
  }

  return (
    (message.from === activeChatId && message.to === playerId)
    || (message.from === playerId && message.to === activeChatId)
  );
}

function formatChatError(payload: unknown): string {
  if (typeof payload === "string") return `聊天错误 · Chat error: ${payload}`;
  if (payload instanceof Error) return `聊天错误 · Chat error: ${payload.message}`;
  if (isRecord(payload)) {
    const message = getString(payload, "error") ?? getString(payload, "message");
    if (message) return `聊天错误 · Chat error: ${message}`;
  }
  return "聊天错误 · Chat error";
}

function isSocketErrorPayload(payload: unknown): boolean {
  if (payload === null || payload === undefined) return false;
  if (payload instanceof Error || typeof payload === "string") return true;
  return isRecord(payload)
    && !Array.isArray(payload.messages)
    && (typeof payload.error === "string" || typeof payload.message === "string");
}

function isChatMessage(value: ChatMessage | null): value is ChatMessage {
  return value !== null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" ? value : null;
}

const styles: Record<string, CSSProperties> = {
  shell: {
    position: "absolute",
    bottom: 16,
    left: 16,
    width: 340,
    height: 420,
    pointerEvents: "none",
  },
  panel: {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(26, 26, 46, 0.94)",
    boxShadow: "0 18px 48px rgba(0,0,0,0.42)",
    color: "#fff",
    pointerEvents: "auto",
    backdropFilter: "blur(10px)",
  },
  header: {
    height: 56,
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "10px 12px 10px 14px",
    borderBottom: "1px solid rgba(255,255,255,0.1)",
    boxSizing: "border-box",
  },
  headerText: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  title: {
    display: "block",
    maxWidth: 250,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "#fff",
    fontSize: 15,
    lineHeight: "20px",
    fontWeight: 700,
  },
  subtitle: {
    color: "#888",
    fontSize: 11,
    lineHeight: "14px",
  },
  closeButton: {
    width: 28,
    height: 28,
    flexShrink: 0,
    borderRadius: 6,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.06)",
    color: "#888",
    cursor: "pointer",
    fontSize: 18,
    lineHeight: "24px",
    pointerEvents: "auto",
  },
  body: {
    flex: 1,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
  },
  errorBanner: {
    flexShrink: 0,
    margin: "10px 12px 0",
    padding: "8px 10px",
    borderRadius: 6,
    border: "1px solid rgba(239, 83, 80, 0.35)",
    background: "rgba(239, 83, 80, 0.12)",
    color: "#ffcdd2",
    fontSize: 12,
    lineHeight: "16px",
  },
  messageList: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    padding: "12px",
    boxSizing: "border-box",
  },
  inlineStatus: {
    marginBottom: 10,
    color: "#888",
    fontSize: 12,
    textAlign: "center",
  },
  emptyState: {
    minHeight: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#888",
    fontSize: 13,
    textAlign: "center",
  },
  messageRow: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    marginBottom: 10,
  },
  senderName: {
    maxWidth: "80%",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "#888",
    fontSize: 11,
    lineHeight: "14px",
  },
  bubble: {
    display: "inline-block",
    maxWidth: "80%",
    padding: "8px 10px",
    borderRadius: 8,
    color: "#fff",
    fontSize: 13,
    lineHeight: "18px",
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    boxSizing: "border-box",
  },
  ownBubble: {
    background: "#4caf50",
    borderBottomRightRadius: 3,
  },
  otherBubble: {
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderBottomLeftRadius: 3,
  },
  footer: {
    flexShrink: 0,
    display: "flex",
    gap: 8,
    alignItems: "flex-end",
    padding: 12,
    borderTop: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(0,0,0,0.12)",
    boxSizing: "border-box",
  },
  input: {
    flex: 1,
    height: 56,
    resize: "none",
    borderRadius: 6,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.08)",
    color: "#fff",
    outline: "none",
    padding: "8px 10px",
    fontSize: 13,
    lineHeight: "18px",
    fontFamily: "inherit",
    boxSizing: "border-box",
    pointerEvents: "auto",
  },
  sendButton: {
    height: 56,
    minWidth: 84,
    borderRadius: 6,
    border: "none",
    background: "#4caf50",
    color: "#fff",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 700,
    lineHeight: "16px",
    padding: "0 12px",
    pointerEvents: "auto",
  },
  sendButtonDisabled: {
    background: "#2f5233",
    color: "rgba(255,255,255,0.46)",
    cursor: "not-allowed",
  },
};
