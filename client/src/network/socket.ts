/**
 * socket.ts — Socket.IO client wrapper.
 *
 * Single socket instance; connect once and reuse. Exposes typed send/receive
 * helpers and a connection-status watcher that updates the Zustand store.
 */

import { io, Socket } from "socket.io-client";
import { useGameStore } from "@/ui/store/gameStore";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? "http://localhost:3001";

// ---------------------------------------------------------------------------
// Singleton socket
// ---------------------------------------------------------------------------

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SERVER_URL, {
      autoConnect: false,
      transports: ["websocket"],
    });
    wireConnectionEvents(socket);
  }
  return socket;
}

export function connect(): Socket {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnect(): void {
  socket?.disconnect();
  socket = null;
}

// ---------------------------------------------------------------------------
// Connection lifecycle → Zustand store
// ---------------------------------------------------------------------------

function wireConnectionEvents(s: Socket): void {
  const store = useGameStore.getState;

  s.on("connect", () => {
    store().setConnectionStatus("green");
  });

  s.on("disconnect", () => {
    store().setConnectionStatus("red");
  });

  s.on("connect_error", () => {
    store().setConnectionStatus("yellow");
  });
}
