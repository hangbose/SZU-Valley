/**
 * NPCDialogue — RPG-style dialogue box shown when interacting with an NPC.
 *
 * Listens for `npc-clicked` bridge events, sends `npc.talk` via socket,
 * and falls back to hardcoded dialogues when no server is running.
 * Dismiss with click, ESC, Enter, or Space.
 */

import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { bridge } from "@/network/bridge";
import { getSocket } from "@/network/socket";
import { useGameStore } from "@/ui/store/gameStore";

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How long to wait for a server response before using fallback (ms). */
const SOCKET_TIMEOUT = 3000;

/** Fade-in duration for the dialogue box (ms). */
const FADE_MS = 200;

// ---------------------------------------------------------------------------
// Hardcoded fallback dialogues (used when no server is running)
// ---------------------------------------------------------------------------

const FALLBACK_DIALOGUES: Record<string, string[]> = {
  npc_librarian: [
    "欢迎来到图书馆！这里有从文学到计算机科学的各种书籍。",
    "嘘——请保持安静。",
    "想找什么书？我可以帮你查。",
  ],
  npc_barista: [
    "要来一杯拿铁吗？学生卡可以打八折哦。",
    "今天的美式特别香，试试看？",
    "期末周我们开到凌晨两点。",
  ],
  npc_student_a: [
    "别打扰我，明天就要考高数了……",
    "这道题我已经算了三遍了。",
    "你也是来复习的吗？",
  ],
  npc_guard: [
    "出入请出示校园卡。哦，是新生啊，欢迎欢迎！",
    "注意安全，晚上别在外面待太晚。",
    "校门口有共享单车可以骑。",
  ],
};

/** Pick a random line from a dialogue array. */
function randomLine(lines: string[]): string {
  return lines[Math.floor(Math.random() * lines.length)] ?? "...";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NPCDialogue() {
  const npcDialogue = useGameStore((s) => s.npcDialogue);
  const setNpcDialogue = useGameStore((s) => s.setNpcDialogue);
  const [visible, setVisible] = useState(false);
  const [isFallback, setIsFallback] = useState(false);

  // Listen for NPC click events from Phaser
  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | null = null;

    return bridge.on("npc-clicked", ({ npcId, npcName }) => {
      if (cancelled) return;

      // Try the server first
      let resolved = false;
      const socket = getSocket();

      const handleTalk = (payload: unknown) => {
        if (cancelled || resolved) return;
        const text = extractDialogueText(payload);
        if (text === null) return;

        resolved = true;
        if (timeoutId !== null) window.clearTimeout(timeoutId);
        socket.off("npc.talk", handleTalk);
        socket.off("npc.dialogue", handleTalk);
        setNpcDialogue({ npcId, npcName, text });
        setIsFallback(false);
      };

      // The server may respond on either event
      socket.on("npc.talk", handleTalk);
      socket.on("npc.dialogue", handleTalk);

      // Fallback if no server response
      timeoutId = window.setTimeout(() => {
        if (cancelled || resolved) return;
        resolved = true;
        socket.off("npc.talk", handleTalk);
        socket.off("npc.dialogue", handleTalk);

        const fallback = FALLBACK_DIALOGUES[npcId];
        const text = fallback
          ? randomLine(fallback)
          : `你好！我是${npcName}。· Hello! I'm ${npcName}.`;

        setNpcDialogue({ npcId, npcName, text });
        setIsFallback(true);
      }, SOCKET_TIMEOUT);

      // Emit the request (fire-and-forget — might not reach if no server)
      if (socket.connected) {
        socket.emit("npc.talk", { npcId });
      }
    });
  }, [setNpcDialogue]);

  // Fade in when dialogue appears
  useEffect(() => {
    if (npcDialogue) {
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    } else {
      setVisible(false);
      setIsFallback(false);
    }
  }, [npcDialogue]);

  // Dismiss handlers
  const dismiss = useCallback(() => {
    setNpcDialogue(null);
  }, [setNpcDialogue]);

  // Keyboard dismiss
  useEffect(() => {
    if (!npcDialogue) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        dismiss();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [dismiss, npcDialogue]);

  if (!npcDialogue) return null;

  return (
    <div
      style={{
        ...styles.overlay,
        opacity: visible ? 1 : 0,
        transition: `opacity ${FADE_MS}ms ease-out`,
      }}
      onClick={dismiss}
    >
      <div style={styles.box} onClick={(e) => e.stopPropagation()}>
        {/* NPC name header */}
        <div style={styles.header}>
          <span style={styles.npcIcon}>💬</span>
          <span style={styles.npcName}>{npcDialogue.npcName}</span>
          {isFallback && <span style={styles.fallbackBadge}>本地 · Local</span>}
        </div>

        {/* Dialogue text */}
        <p style={styles.text}>{npcDialogue.text}</p>

        {/* Hint */}
        <p style={styles.hint}>
          点击任意处 · 按 ESC/Enter/Space 关闭 · Click or press key to close
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractDialogueText(payload: unknown): string | null {
  if (typeof payload === "string" && payload.trim().length > 0) {
    return payload.trim();
  }

  if (!payload || typeof payload !== "object") return null;

  const record = payload as Record<string, unknown>;
  const text = record.text ?? record.dialogue ?? record.message ?? record.line;

  return typeof text === "string" && text.trim().length > 0
    ? text.trim()
    : null;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles: Record<string, CSSProperties> = {
  overlay: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    paddingBottom: 32,
    pointerEvents: "auto",
    zIndex: 200,
    background:
      "linear-gradient(to top, rgba(0,0,0,0.35) 0%, transparent 40%)",
  },
  box: {
    width: "min(600px, calc(100vw - 48px))",
    minHeight: 120,
    borderRadius: 8,
    border: "2px solid rgba(76, 175, 80, 0.45)",
    background: "rgba(20, 20, 40, 0.96)",
    boxShadow: "0 18px 50px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,0,0,0.3)",
    padding: "18px 22px 14px",
    color: "#fff",
    cursor: "pointer",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  npcIcon: {
    fontSize: 18,
    lineHeight: 1,
  },
  npcName: {
    fontSize: 16,
    fontWeight: 700,
    color: "#4caf50",
  },
  fallbackBadge: {
    marginLeft: "auto",
    fontSize: 10,
    fontWeight: 700,
    color: "#888",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 4,
    padding: "1px 6px",
    background: "rgba(255,255,255,0.06)",
  },
  text: {
    margin: "0 0 14px",
    fontSize: 15,
    lineHeight: 1.7,
    color: "#e0e0e0",
  },
  hint: {
    margin: 0,
    fontSize: 10,
    color: "#555",
    textAlign: "center",
  },
};
