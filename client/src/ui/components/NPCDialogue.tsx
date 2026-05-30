/**
 * NPCDialogue — Pixel-art dialogue box shown when interacting with an NPC.
 *
 * Styled after PixelDialogBox from the pixel-art UI kit.
 * Listens for `npc-clicked` bridge events, sends `npc.talk` via socket,
 * falls back to hardcoded dialogues when no server is running.
 * Dismiss with click, ESC, Enter, or Space.
 */

import { useCallback, useEffect, useState } from "react";
import { bridge } from "@/network/bridge";
import { getSocket } from "@/network/socket";
import { useGameStore } from "@/ui/store/gameStore";
import { PixelDialogBox, pixelFont } from "@/ui/components/PixelUiParts";

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

const SOCKET_TIMEOUT = 3000;
const FADE_MS = 200;

// ---------------------------------------------------------------------------
// Fallback dialogues
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

      socket.on("npc.talk", handleTalk);
      socket.on("npc.dialogue", handleTalk);

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

      if (socket.connected) {
        socket.emit("npc.talk", { npcId });
      }
    });
  }, [setNpcDialogue]);

  // Fade in
  useEffect(() => {
    if (npcDialogue) {
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    } else {
      setVisible(false);
      setIsFallback(false);
    }
  }, [npcDialogue]);

  const dismiss = useCallback(() => {
    setNpcDialogue(null);
  }, [setNpcDialogue]);

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
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        paddingBottom: 48,
        pointerEvents: "auto",
        zIndex: 200,
        opacity: visible ? 1 : 0,
        transition: `opacity ${FADE_MS}ms ease-out`,
      }}
      onClick={dismiss}
    >
      <div onClick={(e) => e.stopPropagation()}>
        <PixelDialogBox scale={0.55}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: "#415331" }}>
              {npcDialogue.npcName}
            </span>
            {isFallback && (
              <span style={{
                fontSize: 10,
                color: "#8baa54",
                border: "2px solid #6f9045",
                borderRadius: 4,
                padding: "1px 6px",
                background: "#efe5ce",
                fontFamily: pixelFont,
              }}>本地</span>
            )}
          </div>
          <p style={{ margin: "0 0 14px", fontSize: 14, lineHeight: 1.9, color: "#2b2b32" }}>
            {npcDialogue.text}
          </p>
          <p style={{ margin: 0, fontSize: 10, color: "#8baa54", textAlign: "center" }}>
            点击 · ESC · Enter · Space 关闭
          </p>
        </PixelDialogBox>
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
