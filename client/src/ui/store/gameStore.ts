/**
 * gameStore — Zustand global state for the UI layer.
 *
 * Holds everything React needs to render: join/game phase, player identity,
 * connection status, chat messages, friends, and pending requests.
 * Phaser does NOT read this store directly — it goes through the bridge.
 */

import { create } from "zustand";
import type { Friend, FriendRequest } from "@/network/bridge";

// ---------------------------------------------------------------------------
// Derived types
// ---------------------------------------------------------------------------

export type Phase = "join" | "game";
export type ConnectionStatus = "green" | "yellow" | "red";

/**
 * A chat conversation: all messages with one player.
 * Stored in a Map keyed by the other player's ID.
 */
export interface Message {
  id: string;
  from: string;
  fromName: string;
  text: string;
  timestamp: number;
  isOwn: boolean; // true when `from === local playerId`
}

// ---------------------------------------------------------------------------
// Store shape
// ---------------------------------------------------------------------------

export interface GameState {
  // --- Lifecycle ---
  phase: Phase;
  setPhase: (phase: Phase) => void;

  // --- Local player ---
  playerId: string | null;
  playerName: string;
  playerAvatar: string;
  setPlayer: (id: string, name: string, avatar: string) => void;

  // --- World ---
  onlineCount: number;
  zoneName: string;
  connectionStatus: ConnectionStatus;
  setOnlineCount: (n: number) => void;
  setZoneName: (name: string) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;

  // --- Chat (Map: otherPlayerId → Message[]) ---
  chatMessages: Record<string, Message[]>;
  addMessage: (conversationId: string, msg: Message) => void;
  setMessages: (conversationId: string, msgs: Message[]) => void;
  /** ID of the player whose chat panel is currently open (null if collapsed). */
  activeChatId: string | null;
  setActiveChatId: (id: string | null) => void;

  // --- Friends ---
  friends: Friend[];
  setFriends: (friends: Friend[]) => void;
  addFriend: (friend: Friend) => void;
  removeFriend: (id: string) => void;
  updateFriendOnline: (id: string, isOnline: boolean) => void;

  // --- Friend requests ---
  pendingRequests: FriendRequest[];
  addPendingRequest: (req: FriendRequest) => void;
  removePendingRequest: (from: string) => void;

  // --- NPC dialogue (ephemeral, shown in a toast/modal) ---
  npcDialogue: { npcId: string; npcName: string; text: string } | null;
  setNpcDialogue: (d: { npcId: string; npcName: string; text: string } | null) => void;

  // --- Profile card (which player's profile is currently open) ---
  profileTarget: string | null;
  setProfileTarget: (id: string | null) => void;
}

// ---------------------------------------------------------------------------
// Store creator
// ---------------------------------------------------------------------------

export const useGameStore = create<GameState>((set) => ({
  // Lifecycle
  phase: "join",
  setPhase: (phase) => set({ phase }),

  // Local player
  playerId: null,
  playerName: "",
  playerAvatar: "",
  setPlayer: (id, name, avatar) =>
    set({ playerId: id, playerName: name, playerAvatar: avatar }),

  // World
  onlineCount: 0,
  zoneName: "",
  connectionStatus: "red" as ConnectionStatus,
  setOnlineCount: (n) => set({ onlineCount: n }),
  setZoneName: (name) => set({ zoneName: name }),
  setConnectionStatus: (status) => set({ connectionStatus: status }),

  // Chat
  chatMessages: {},
  addMessage: (conversationId, msg) =>
    set((s) => ({
      chatMessages: {
        ...s.chatMessages,
        [conversationId]: [...(s.chatMessages[conversationId] ?? []), msg],
      },
    })),
  setMessages: (conversationId, msgs) =>
    set((s) => ({
      chatMessages: { ...s.chatMessages, [conversationId]: msgs },
    })),
  activeChatId: null,
  setActiveChatId: (id) => set({ activeChatId: id }),

  // Friends
  friends: [],
  setFriends: (friends) => set({ friends }),
  addFriend: (friend) =>
    set((s) => ({ friends: [...s.friends, friend] })),
  removeFriend: (id) =>
    set((s) => ({ friends: s.friends.filter((f) => f.id !== id) })),
  updateFriendOnline: (id, isOnline) =>
    set((s) => ({
      friends: s.friends.map((f) => (f.id === id ? { ...f, isOnline } : f)),
    })),

  // Friend requests
  pendingRequests: [],
  addPendingRequest: (req) =>
    set((s) => ({ pendingRequests: [...s.pendingRequests, req] })),
  removePendingRequest: (from) =>
    set((s) => ({
      pendingRequests: s.pendingRequests.filter((r) => r.from !== from),
    })),

  // NPC dialogue
  npcDialogue: null,
  setNpcDialogue: (d) => set({ npcDialogue: d }),

  // Profile
  profileTarget: null,
  setProfileTarget: (id) => set({ profileTarget: id }),
}));
