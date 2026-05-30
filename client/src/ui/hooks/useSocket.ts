/**
 * useSocket — Hook for Socket.IO lifecycle.
 *
 * Connects on mount, exposes the socket instance + connection status,
 * and disconnects on unmount.
 *
 * TODO: Wire real event handlers (player.joined, zone.players, etc.)
 */

import { useEffect, useState } from "react";
import { connect, disconnect, getSocket } from "@/network/socket";
import type { Socket } from "socket.io-client";

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const s = connect();
    setSocket(s);

    // TODO: Register event handlers
    // s.on("player.joined", handleJoined);
    // s.on("zone.players", handleZonePlayers);
    // s.on("zone.npcs", handleZoneNPCs);
    // s.on("player.moved", handlePlayerMoved);
    // s.on("player.appeared", handlePlayerAppeared);
    // s.on("player.left", handlePlayerLeft);
    // s.on("chat.receive", handleChatReceive);
    // s.on("friend.requested", handleFriendRequested);
    // s.on("friend.accepted", handleFriendAccepted);

    return () => {
      disconnect();
      setSocket(null);
    };
  }, []);

  /** Send a typed event to the server. */
  const emit = <T extends Record<string, unknown>>(event: string, payload: T) => {
    getSocket().emit(event, payload);
  };

  return { socket, emit };
}
