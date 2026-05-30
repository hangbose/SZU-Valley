/**
 * FriendToast — socket-driven friend request notifications above the Phaser canvas.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { FriendRequest } from "@/network/bridge";
import { getSocket } from "@/network/socket";
import { useGameStore } from "@/ui/store/gameStore";
import { pixelFont } from "@/ui/components/PixelUiParts";

const MAX_TOASTS = 3;
const AUTO_DISMISS_MS = 8000;
const CONFIRM_DISMISS_MS = 900;
const SLIDE_MS = 300;

type ToastStatus = "request" | "added" | "exiting";

type FriendRequestToast = FriendRequest & {
  toastId: string;
  status: ToastStatus;
};

export function FriendToast() {
  const pendingRequests = useGameStore((s) => s.pendingRequests);
  const addPendingRequest = useGameStore((s) => s.addPendingRequest);
  const removePendingRequest = useGameStore((s) => s.removePendingRequest);
  const addFriend = useGameStore((s) => s.addFriend);
  const [toasts, setToasts] = useState<FriendRequestToast[]>([]);
  const toastsRef = useRef<FriendRequestToast[]>([]);

  useEffect(() => {
    toastsRef.current = toasts;
  }, [toasts]);

  const updateToastStatus = useCallback((toastId: string, status: ToastStatus) => {
    setToasts((current) =>
      current.map((toast) => (toast.toastId === toastId ? { ...toast, status } : toast)),
    );
  }, []);

  const removeToast = useCallback((toastId: string) => {
    setToasts((current) => current.filter((toast) => toast.toastId !== toastId));
  }, []);

  const showToast = useCallback(
    (request: FriendRequest) => {
      const toastId = getToastId(request);
      const currentToasts = toastsRef.current;
      const duplicate = currentToasts.some((toast) => toast.toastId === toastId);

      if (duplicate) return;

      const toastToDrop =
        currentToasts.length >= MAX_TOASTS ? getOldestToast(currentToasts) : null;

      if (toastToDrop?.status === "request") {
        removePendingRequest(toastToDrop.from);
      }

      setToasts((current) => {
        const next = toastToDrop
          ? current.filter((toast) => toast.toastId !== toastToDrop.toastId)
          : current;

        return [
          ...next,
          {
            ...request,
            toastId,
            status: "request" as const,
          },
        ];
      });
    },
    [removePendingRequest],
  );

  useEffect(() => {
    pendingRequests.forEach(showToast);
  }, [pendingRequests, showToast]);

  useEffect(() => {
    const socket = getSocket();

    const handleFriendRequested = (payload: unknown) => {
      const request = parseFriendRequest(payload);
      if (!request) return;

      const store = useGameStore.getState();
      const isDuplicate = store.pendingRequests.some(
        (pending) => pending.from === request.from,
      );

      if (isDuplicate) return;

      if (store.pendingRequests.length >= MAX_TOASTS) {
        const oldestRequest = getOldestRequest(store.pendingRequests);
        if (oldestRequest) {
          store.removePendingRequest(oldestRequest.from);
        }
      }

      addPendingRequest(request);
    };

    socket.on("friend.requested", handleFriendRequested);

    return () => {
      socket.off("friend.requested", handleFriendRequested);
    };
  }, [addPendingRequest]);

  const handleAccept = useCallback(
    (toast: FriendRequestToast) => {
      getSocket().emit("friend.accept", { from: toast.from });

      const store = useGameStore.getState();
      const friendExists = store.friends.some((friend) => friend.id === toast.from);

      if (!friendExists) {
        addFriend({
          id: toast.from,
          name: toast.fromName,
          avatar: "",
          isOnline: true,
        });
      }

      removePendingRequest(toast.from);
      updateToastStatus(toast.toastId, "added");
    },
    [addFriend, removePendingRequest, updateToastStatus],
  );

  const handleReject = useCallback(
    (toast: FriendRequestToast) => {
      getSocket().emit("friend.reject", { from: toast.from });
      removePendingRequest(toast.from);
      updateToastStatus(toast.toastId, "exiting");
    },
    [removePendingRequest, updateToastStatus],
  );

  const handleAutoDismiss = useCallback(
    (toast: FriendRequestToast) => {
      removePendingRequest(toast.from);
      updateToastStatus(toast.toastId, "exiting");
    },
    [removePendingRequest, updateToastStatus],
  );

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-relevant="additions removals"
      style={styles.stack}
    >
      {toasts.map((toast) => (
        <ToastCard
          key={toast.toastId}
          toast={toast}
          onAccept={handleAccept}
          onReject={handleReject}
          onAutoDismiss={handleAutoDismiss}
          onGone={removeToast}
        />
      ))}
    </div>
  );
}

function ToastCard({
  toast,
  onAccept,
  onReject,
  onAutoDismiss,
  onGone,
}: {
  toast: FriendRequestToast;
  onAccept: (toast: FriendRequestToast) => void;
  onReject: (toast: FriendRequestToast) => void;
  onAutoDismiss: (toast: FriendRequestToast) => void;
  onGone: (toastId: string) => void;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  const closingRef = useRef(false);
  const actionTakenRef = useRef(false);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current === null) return;
    window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  }, []);

  const beginDismiss = useCallback(() => {
    if (closingRef.current) return;

    closingRef.current = true;
    clearCloseTimer();
    setIsVisible(false);
    closeTimerRef.current = window.setTimeout(() => {
      onGone(toast.toastId);
    }, SLIDE_MS);
  }, [clearCloseTimer, onGone, toast.toastId]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setIsVisible(true);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
      clearCloseTimer();
    };
  }, [clearCloseTimer]);

  useEffect(() => {
    if (toast.status !== "request") return;

    const timerId = window.setTimeout(() => {
      onAutoDismiss(toast);
      beginDismiss();
    }, AUTO_DISMISS_MS);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [beginDismiss, onAutoDismiss, toast]);

  useEffect(() => {
    if (toast.status !== "added") return;

    const timerId = window.setTimeout(beginDismiss, CONFIRM_DISMISS_MS);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [beginDismiss, toast.status]);

  const handleAccept = () => {
    if (closingRef.current || actionTakenRef.current || toast.status !== "request") return;
    actionTakenRef.current = true;
    onAccept(toast);
  };

  const handleReject = () => {
    if (closingRef.current || actionTakenRef.current || toast.status !== "request") return;
    actionTakenRef.current = true;
    onReject(toast);
    beginDismiss();
  };

  const isAdded = toast.status === "added";

  return (
    <section
      role="status"
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "translateX(0)" : "translateX(120%)",
        transition: "transform 300ms ease-out, opacity 300ms ease-out",
        pointerEvents: "auto",
      }}
    >
      {isAdded ? (
        <div style={styles.confirmedBox}>已添加 · Added!</div>
      ) : (
        <div style={styles.toastBox}>
          <p style={styles.toastMsg}>
            🔔 <strong style={{ color: "#ffe19d" }}>{toast.fromName}</strong>
            {" "}请求添加你为好友
          </p>
          <p style={styles.toastSub}>wants to add you as a friend</p>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={handleAccept} style={styles.acceptBtn}>
              接受 · Accept
            </button>
            <button type="button" onClick={handleReject} style={styles.rejectBtn}>
              拒绝 · Reject
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function parseFriendRequest(payload: unknown): FriendRequest | null {
  if (!payload || typeof payload !== "object") return null;

  const value = payload as Record<string, unknown>;
  const from = typeof value.from === "string" ? value.from.trim() : "";
  const fromName =
    typeof value.fromName === "string" && value.fromName.trim().length > 0
      ? value.fromName.trim()
      : "未知同学 · Unknown student";

  if (!from) return null;

  return {
    from,
    fromName,
    timestamp: typeof value.timestamp === "number" ? value.timestamp : Date.now(),
  };
}

function getToastId(request: FriendRequest): string {
  return `${request.from}:${request.timestamp}`;
}

function getOldestRequest(requests: FriendRequest[]): FriendRequest | null {
  return requests.reduce<FriendRequest | null>((oldest, request) => {
    if (!oldest) return request;
    return request.timestamp < oldest.timestamp ? request : oldest;
  }, null);
}

function getOldestToast(toasts: FriendRequestToast[]): FriendRequestToast | null {
  const unActionedToasts = toasts.filter((toast) => toast.status === "request");
  const candidates = unActionedToasts.length > 0 ? unActionedToasts : toasts;

  return candidates.reduce<FriendRequestToast | null>((oldest, toast) => {
    if (!oldest) return toast;
    return toast.timestamp < oldest.timestamp ? toast : oldest;
  }, null);
}

const styles: Record<string, CSSProperties> = {
  stack: {
    position: "absolute",
    top: 64,
    right: 16,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    width: "min(300px, calc(100vw - 32px))",
    pointerEvents: "none",
    zIndex: 300,
  },
  toastBox: {
    boxSizing: "border-box",
    padding: "16px 18px",
    borderRadius: 16,
    border: "4px solid #29283a",
    background: "rgba(41, 51, 69, .92)",
    boxShadow: "inset 0 0 0 3px #ddb864, 0 8px 0 rgba(30,28,42,.5)",
    color: "#fff",
    fontFamily: pixelFont,
    fontSize: 12,
    imageRendering: "pixelated",
  },
  toastMsg: {
    margin: "0 0 4px",
    color: "#ffe19d",
    fontSize: 13,
    lineHeight: 1.5,
  },
  toastSub: {
    margin: "0 0 14px",
    color: "#b8a880",
    fontSize: 9,
  },
  acceptBtn: {
    flex: 1,
    height: 40,
    border: "3px solid #ddb864",
    borderRadius: 8,
    background: "#343149",
    color: "#ffe19d",
    cursor: "pointer",
    fontFamily: pixelFont,
    fontSize: 11,
    fontWeight: 700,
    pointerEvents: "auto",
  },
  rejectBtn: {
    flex: 1,
    height: 40,
    border: "3px solid #4a3e5a",
    borderRadius: 8,
    background: "rgba(102,102,102,0.22)",
    color: "#b8a880",
    cursor: "pointer",
    fontFamily: pixelFont,
    fontSize: 11,
    fontWeight: 700,
    pointerEvents: "auto",
  },
  confirmedBox: {
    minHeight: 80,
    boxSizing: "border-box",
    padding: 20,
    borderRadius: 16,
    border: "4px solid #29283a",
    background: "rgba(41, 51, 69, .92)",
    boxShadow: "inset 0 0 0 3px #ddb864, 0 8px 0 rgba(30,28,42,.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#ffe19d",
    fontFamily: pixelFont,
    fontSize: 14,
    fontWeight: 700,
  },
};
