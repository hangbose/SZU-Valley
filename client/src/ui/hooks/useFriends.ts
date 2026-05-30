/**
 * useFriends — Hook for friend list state and operations.
 *
 * Manages friend requests (send, accept, reject) and syncs with
 * the Zustand store + socket events.
 *
 * TODO: Wire to socket events (friend.request, friend.accept, friend.reject,
 * friend.requested, friend.accepted).
 */

import { useCallback } from "react";
import { useGameStore } from "@/ui/store/gameStore";
import { getSocket } from "@/network/socket";

export function useFriends() {
  const friends = useGameStore((s) => s.friends);
  const pendingRequests = useGameStore((s) => s.pendingRequests);
  const addPendingRequest = useGameStore((s) => s.addPendingRequest);
  const removePendingRequest = useGameStore((s) => s.removePendingRequest);
  const addFriend = useGameStore((s) => s.addFriend);

  const sendRequest = useCallback((targetId: string) => {
    getSocket().emit("friend.request", { to: targetId });
  }, []);

  const acceptRequest = useCallback(
    (from: string) => {
      getSocket().emit("friend.accept", { from });
      removePendingRequest(from);
    },
    [removePendingRequest],
  );

  const rejectRequest = useCallback(
    (from: string) => {
      getSocket().emit("friend.reject", { from });
      removePendingRequest(from);
    },
    [removePendingRequest],
  );

  return {
    friends,
    pendingRequests,
    sendRequest,
    acceptRequest,
    rejectRequest,
    addPendingRequest,
    addFriend,
  };
}
