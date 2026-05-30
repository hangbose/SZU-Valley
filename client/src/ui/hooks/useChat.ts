/**
 * useChat — Hook for chat state and operations.
 *
 * Manages active conversation, message sending, and receiving.
 * Wraps socket chat.send / chat.receive events.
 *
 * TODO: Wire to socket events.
 */

import { useCallback } from "react";
import { useGameStore } from "@/ui/store/gameStore";
import { getSocket } from "@/network/socket";

export function useChat() {
  const activeChatId = useGameStore((s) => s.activeChatId);
  const setActiveChatId = useGameStore((s) => s.setActiveChatId);
  const addMessage = useGameStore((s) => s.addMessage);
  const playerId = useGameStore((s) => s.playerId);

  const openChat = useCallback(
    (targetId: string) => {
      setActiveChatId(targetId);
    },
    [setActiveChatId],
  );

  const closeChat = useCallback(() => {
    setActiveChatId(null);
  }, [setActiveChatId]);

  const sendMessage = useCallback(
    (text: string) => {
      if (!activeChatId || !playerId) return;
      const trimmed = text.trim();
      if (!trimmed) return;

      // Optimistic add
      const msg = {
        id: crypto.randomUUID(),
        from: playerId,
        fromName: "You",
        text: trimmed,
        timestamp: Date.now(),
        isOwn: true,
      };
      addMessage(activeChatId, msg);

      // Send via socket
      getSocket().emit("chat.send", { to: activeChatId, text: trimmed });
    },
    [activeChatId, playerId, addMessage],
  );

  return { activeChatId, openChat, closeChat, sendMessage };
}
