/**
 * FriendsList — Sidebar showing online/offline friends.
 *
 * Online friends show a green dot and their name is clickable to
 * focus the camera on them. Offline friends show a grey dot.
 */

import { useEffect, useMemo, useState } from "react";
import { bridge } from "@/network/bridge";
import { getSocket } from "@/network/socket";
import { useGameStore } from "@/ui/store/gameStore";
import {
  friendFromAcceptedPayload,
  focusFriendEntity,
  sortFriendsForDisplay,
} from "@/ui/components/FriendsList.helpers";

const SIDEBAR_WIDTH = 200;

export function FriendsList() {
  const friends = useGameStore((s) => s.friends);
  const setProfileTarget = useGameStore((s) => s.setProfileTarget);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(
    () => useGameStore.getState().friends.length === 0,
  );
  const [isSkeletonBright, setIsSkeletonBright] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sortedFriends = useMemo(() => sortFriendsForDisplay(friends), [friends]);
  const showLoading = isInitialLoading && friends.length === 0;

  useEffect(() => {
    const socket = getSocket();

    const handleFriendAccepted = (payload: unknown) => {
      const acceptedFriend = friendFromAcceptedPayload(payload);

      if (!acceptedFriend) {
        setError("好友更新失败 · Could not update friends");
        return;
      }

      const { friends: currentFriends, addFriend } = useGameStore.getState();
      const alreadyAdded = currentFriends.some(
        (friend) => friend.id === acceptedFriend.id,
      );

      if (!alreadyAdded) {
        addFriend(acceptedFriend);
      }
      setError(null);
    };

    socket.on("friend.accepted", handleFriendAccepted);
    return () => {
      socket.off("friend.accepted", handleFriendAccepted);
    };
  }, []);

  useEffect(() => {
    if (!showLoading) return;

    const timer = window.setTimeout(() => setIsInitialLoading(false), 500);
    return () => window.clearTimeout(timer);
  }, [showLoading]);

  useEffect(() => {
    if (!showLoading) return;

    const timer = window.setInterval(
      () => setIsSkeletonBright((value) => !value),
      650,
    );
    return () => window.clearInterval(timer);
  }, [showLoading]);

  const focusFriend = (id: string) => {
    focusFriendEntity(id, setProfileTarget, (event, payload) => {
      bridge.emit(event, payload);
    });
  };

  return (
    <div style={styles.shell}>
      <aside
        aria-label="好友列表 · Friends list"
        style={{
          ...styles.sidebar,
          transform: isCollapsed
            ? `translateX(${SIDEBAR_WIDTH}px)`
            : "translateX(0)",
        }}
      >
        <button
          type="button"
          aria-expanded={!isCollapsed}
          aria-label={
            isCollapsed ? "展开好友 · Expand friends" : "收起好友 · Collapse friends"
          }
          title={
            isCollapsed ? "展开好友 · Expand friends" : "收起好友 · Collapse friends"
          }
          onClick={() => setIsCollapsed((value) => !value)}
          style={styles.toggleButton}
        >
          {isCollapsed ? "‹" : "›"}
        </button>

        <div style={styles.header}>
          <h4 style={styles.title}>好友 · Friends ({friends.length})</h4>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <div style={styles.list}>
          {showLoading && (
            <SkeletonRows isBright={isSkeletonBright} />
          )}

          {!showLoading && !error && sortedFriends.length === 0 && (
            <div style={styles.emptyState}>
              <p style={styles.emptyTitle}>还没有好友 · No friends yet</p>
              <p style={styles.emptyHint}>在校园里逛逛，认识新朋友吧！</p>
            </div>
          )}

          {!showLoading &&
            sortedFriends.map((friend) => (
              <button
                key={friend.id}
                type="button"
                onClick={() => focusFriend(friend.id)}
                style={styles.friendRow}
                title={`寻找 ${friend.name} · Find ${friend.name}`}
              >
                <span
                  aria-label={
                    friend.isOnline ? "在线 · Online" : "离线 · Offline"
                  }
                  title={friend.isOnline ? "在线 · Online" : "离线 · Offline"}
                  style={{
                    ...styles.statusDot,
                    color: friend.isOnline ? "#4caf50" : "#666",
                    textShadow: friend.isOnline
                      ? "0 0 10px rgba(76, 175, 80, 0.7)"
                      : "none",
                    transform: friend.isOnline ? "scale(1.08)" : "scale(1)",
                  }}
                >
                  {friend.isOnline ? "●" : "○"}
                </span>
                <span
                  style={{
                    ...styles.friendName,
                    color: friend.isOnline ? "#fff" : "#888",
                  }}
                >
                  {friend.name}
                </span>
              </button>
            ))}
        </div>
      </aside>
    </div>
  );
}

function SkeletonRows({ isBright }: { isBright: boolean }) {
  return (
    <div aria-label="加载好友中 · Loading friends" style={styles.skeletonList}>
      {[0, 1, 2, 3, 4].map((row) => (
        <div key={row} style={styles.skeletonRow}>
          <span
            style={{
              ...styles.skeletonDot,
              opacity: isBright ? 0.62 : 0.28,
            }}
          />
          <span
            style={{
              ...styles.skeletonBar,
              width: `${64 + row * 12}px`,
              opacity: isBright ? 0.72 : 0.34,
            }}
          />
        </div>
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    position: "relative",
    width: SIDEBAR_WIDTH,
    height: "100%",
    pointerEvents: "none",
  },
  sidebar: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    display: "flex",
    flexDirection: "column",
    background: "rgba(26, 26, 46, 0.9)",
    borderRadius: "8px 0 0 8px",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRight: "none",
    boxSizing: "border-box",
    boxShadow: "0 18px 48px rgba(0,0,0,0.32)",
    color: "#fff",
    overflow: "visible",
    pointerEvents: "none",
    transition: "transform 180ms ease",
  },
  toggleButton: {
    position: "absolute",
    left: -24,
    top: 14,
    width: 24,
    height: 48,
    borderRadius: "8px 0 0 8px",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRight: "none",
    background: "rgba(26, 26, 46, 0.94)",
    color: "#4caf50",
    cursor: "pointer",
    fontSize: 22,
    lineHeight: "44px",
    padding: 0,
    pointerEvents: "auto",
  },
  header: {
    flexShrink: 0,
    padding: "14px 12px 10px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  },
  title: {
    color: "#fff",
    fontSize: 13,
    fontWeight: 700,
    lineHeight: 1.25,
    margin: 0,
  },
  list: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    padding: "8px",
    pointerEvents: "auto",
  },
  friendRow: {
    width: "100%",
    minHeight: 34,
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "7px 8px",
    border: "none",
    borderRadius: 6,
    background: "transparent",
    color: "#fff",
    cursor: "pointer",
    textAlign: "left",
    pointerEvents: "auto",
  },
  statusDot: {
    width: 14,
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    lineHeight: 1,
    transition: "color 180ms ease, text-shadow 180ms ease, transform 180ms ease",
  },
  friendName: {
    minWidth: 0,
    flex: 1,
    fontSize: 13,
    lineHeight: 1.35,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    transition: "color 180ms ease",
  },
  emptyState: {
    padding: "18px 8px",
    textAlign: "center",
  },
  emptyTitle: {
    margin: "0 0 6px",
    color: "#fff",
    fontSize: 13,
    fontWeight: 700,
    lineHeight: 1.35,
  },
  emptyHint: {
    margin: 0,
    color: "#888",
    fontSize: 12,
    lineHeight: 1.45,
  },
  error: {
    margin: "8px 8px 0",
    padding: "8px",
    borderRadius: 6,
    background: "rgba(255, 91, 91, 0.12)",
    border: "1px solid rgba(255, 91, 91, 0.22)",
    color: "#ffb3b3",
    fontSize: 12,
    lineHeight: 1.35,
    pointerEvents: "auto",
  },
  skeletonList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    padding: "4px 2px",
  },
  skeletonRow: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    minHeight: 30,
  },
  skeletonDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: "#666",
    transition: "opacity 650ms ease",
  },
  skeletonBar: {
    height: 12,
    borderRadius: 4,
    background: "#666",
    transition: "opacity 650ms ease",
  },
};
