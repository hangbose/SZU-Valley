/**
 * ProfileCard — Popup card when a player is clicked.
 *
 * React overlay above Phaser: the wrapper does not capture pointer events,
 * while the card and controls remain interactive.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { getSocket } from "@/network/socket";
import { useGameStore } from "@/ui/store/gameStore";

interface PlayerProfile {
  id: string;
  name: string;
  avatar: string;
  tags: string[];
  friendsCount: number;
  isOnline: boolean;
}

type ViewState = "idle" | "loading" | "ready" | "missing" | "error";

interface RemoteProfileState {
  targetId: string | null;
  viewState: ViewState;
  profile: PlayerProfile | null;
  errorText: string;
}

const PROFILE_TIMEOUT_MS = 5000;
const MAX_TAGS = 10;
const MAX_TAG_LENGTH = 24;

export function ProfileCard() {
  const profileTarget = useGameStore((s) => s.profileTarget);
  const setProfileTarget = useGameStore((s) => s.setProfileTarget);
  const activeChatId = useGameStore((s) => s.activeChatId);
  const setActiveChatId = useGameStore((s) => s.setActiveChatId);
  const setPeerName = useGameStore((s) => s.setPeerName);
  const storeOwnTags = useGameStore((s) => s.ownTags);
  const setOwnTagsStore = useGameStore((s) => s.setOwnTags);
  const friends = useGameStore((s) => s.friends);
  const playerId = useGameStore((s) => s.playerId);
  const playerName = useGameStore((s) => s.playerName);
  const playerAvatar = useGameStore((s) => s.playerAvatar);

  const [remoteState, setRemoteState] = useState<RemoteProfileState>({
    targetId: null,
    viewState: "idle",
    profile: null,
    errorText: "",
  });
  const [avatarFailureTarget, setAvatarFailureTarget] = useState<string | null>(null);
  const [requestSentTarget, setRequestSentTarget] = useState<string | null>(null);
  const [friendError, setFriendError] = useState<string>("");
  const [ownTags, setOwnTags] = useState<string[]>(storeOwnTags);
  const [tagInput, setTagInput] = useState("");
  const cardRef = useRef<HTMLDivElement>(null);

  const isOwnProfile = Boolean(profileTarget && profileTarget === playerId);
  const isAlreadyFriends = useMemo(
    () => Boolean(profileTarget && friends.some((friend) => friend.id === profileTarget)),
    [friends, profileTarget],
  );
  const isChatOpen = Boolean(profileTarget && activeChatId === profileTarget);
  const requestSent = Boolean(profileTarget && requestSentTarget === profileTarget);
  const avatarFailed = Boolean(profileTarget && avatarFailureTarget === profileTarget);

  const ownProfile = useMemo<PlayerProfile | null>(() => {
    if (!profileTarget || profileTarget !== playerId) return null;

    return {
      id: profileTarget,
      name: playerName.trim() || "我 · Me",
      avatar: playerAvatar,
      tags: ownTags,
      friendsCount: friends.length,
      isOnline: true,
    };
  }, [friends.length, ownTags, playerAvatar, playerId, playerName, profileTarget]);

  const remoteStateForTarget = useMemo<RemoteProfileState>(() => {
    if (!profileTarget || profileTarget === playerId) {
      return {
        targetId: profileTarget,
        viewState: "idle",
        profile: null,
        errorText: "",
      };
    }

    if (remoteState.targetId === profileTarget) {
      return remoteState;
    }

    return {
      targetId: profileTarget,
      viewState: "loading",
      profile: null,
      errorText: "",
    };
  }, [playerId, profileTarget, remoteState]);

  const profile = ownProfile ?? remoteStateForTarget.profile;
  const viewState = ownProfile ? "ready" : remoteStateForTarget.viewState;
  const errorText = remoteStateForTarget.errorText;

  const closeProfile = useCallback(() => {
    setProfileTarget(null);
  }, [setProfileTarget]);

  const handleChat = useCallback(() => {
    if (!profileTarget) return;
    setActiveChatId(profileTarget);
  }, [profileTarget, setActiveChatId]);

  const handleAddFriend = useCallback(() => {
    if (!profileTarget || isOwnProfile || isAlreadyFriends || requestSent) return;
    setFriendError("");
    setRequestSentTarget(profileTarget); // optimistic — works with old & new server
    getSocket().emit("friend.request", { to: profileTarget });
  }, [isAlreadyFriends, isOwnProfile, profileTarget, requestSent]);

  useEffect(() => {
    if (!profileTarget || profileTarget === playerId) return;

    let cancelled = false;
    let loaded = false; // guards timeout from overriding a successful load
    const socket = getSocket();

    const updateRemoteState = (state: Omit<RemoteProfileState, "targetId">) => {
      if (cancelled) return;
      setRemoteState({ targetId: profileTarget, ...state });
    };

    const handleProfileView = (payload: unknown) => {
      if (cancelled || !isProfilePayload(payload) || payload.id !== profileTarget) {
        return;
      }

      loaded = true;
      const name = payload.name || `Player ${payload.id.slice(0, 8)}`;
      setPeerName(payload.id, name); // cache for ChatPanel to use

      updateRemoteState({
        viewState: "ready",
        profile: {
          id: payload.id,
          name,
          avatar: payload.avatar || "",
          tags: normaliseTags(payload.tags),
          friendsCount: typeof payload.friendsCount === "number" ? payload.friendsCount : 0,
          isOnline: typeof payload.isOnline === "boolean" ? payload.isOnline : true,
        },
        errorText: "",
      });
    };

    const handleError = (payload: unknown) => {
      if (cancelled || loaded || !isErrorPayload(payload)) return;

      if (payload.code === "PLAYER_NOT_FOUND") {
        updateRemoteState({
          viewState: "missing",
          profile: null,
          errorText: "玩家已离开 · Player has left",
        });
        return;
      }

      if (payload.code === "OUT_OF_RANGE") {
        updateRemoteState({
          viewState: "error",
          profile: null,
          errorText: "距离太远，无法查看资料 · Too far away to view profile",
        });
        return;
      }

      updateRemoteState({
        viewState: "error",
        profile: null,
        errorText: "资料加载失败 · Failed to load profile",
      });
    };

    socket.on("profile.view", handleProfileView);
    socket.on("error", handleError);
    socket.emit("profile.view", { id: profileTarget });

    const timeoutId = window.setTimeout(() => {
      if (loaded) return; // profile already loaded, skip timeout error
      updateRemoteState({
        viewState: "error",
        profile: null,
        errorText: "资料加载超时 · Profile loading timed out",
      });
    }, PROFILE_TIMEOUT_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      socket.off("profile.view", handleProfileView);
      socket.off("error", handleError);
    };
  }, [playerId, profileTarget]);

  // Reset friend request state when target changes
  useEffect(() => {
    setRequestSentTarget(null);
    setFriendError("");
  }, [profileTarget]);

  // Fetch own tags when viewing own profile
  useEffect(() => {
    if (!isOwnProfile || !playerId) return;

    let cancelled = false;
    const socket = getSocket();

    const handleOwnProfile = (payload: unknown) => {
      if (cancelled || !isProfilePayload(payload) || payload.id !== playerId) return;
      const tags = normaliseTags(payload.tags);
      setOwnTags(tags);
    };

    const handleUpdated = (payload: unknown) => {
      if (cancelled || !isRecord(payload)) return;
      const tags = normaliseTags((payload as Record<string, unknown>).tags);
      if (tags.length > 0 || Array.isArray((payload as Record<string, unknown>).tags)) {
        setOwnTags(tags);
      }
    };

    socket.on("profile.view", handleOwnProfile);
    socket.on("profile.updated", handleUpdated);
    socket.emit("profile.view", { id: playerId });

    return () => {
      cancelled = true;
      socket.off("profile.view", handleOwnProfile);
      socket.off("profile.updated", handleUpdated);
    };
  }, [isOwnProfile, playerId]);

  const emitTags = useCallback((next: string[]) => {
    setOwnTags(next);
    setOwnTagsStore(next);
    getSocket().emit("profile.update", { tags: next });
  }, [setOwnTagsStore]);

  const addTag = useCallback(() => {
    const t = tagInput.trim();
    if (!t || t.length > MAX_TAG_LENGTH || ownTags.includes(t) || ownTags.length >= MAX_TAGS) return;
    emitTags([...ownTags, t]);
    setTagInput("");
  }, [tagInput, ownTags, emitTags]);

  const removeTag = useCallback((t: string) => {
    emitTags(ownTags.filter((x) => x !== t));
  }, [ownTags, emitTags]);

  const handleTagKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); addTag(); }
  }, [addTag]);

  // Listen for friend request confirmations (scoped to current profileTarget)
  useEffect(() => {
    if (!profileTarget || profileTarget === playerId) return;

    const socket = getSocket();

    const rollbackRequestSent = (reason: string) => {
      setRequestSentTarget(null); // rollback optimistic update
      setFriendError(reason);
    };

    const handleFriendSent = (data: { to: string }) => {
      if (data.to === profileTarget) {
        setRequestSentTarget(profileTarget);
        setFriendError("");
      }
    };

    const handleFriendError = (data: { code?: string; message?: string }) => {
      rollbackRequestSent(data?.message ?? "好友请求失败 · Friend request failed");
    };

    // Also catch friend errors from old server (which uses 'error' channel)
    const handleLegacyError = (data: { code?: string; message?: string }) => {
      const friendCodes = ["ALREADY_FRIENDS", "RATE_LIMITED", "OUT_OF_RANGE", "PLAYER_NOT_FOUND"];
      if (data?.code && friendCodes.includes(data.code)) {
        rollbackRequestSent(data?.message ?? "好友请求失败 · Friend request failed");
      }
    };

    socket.on("friend.sent", handleFriendSent);
    socket.on("friend.error", handleFriendError);
    socket.on("error", handleLegacyError);

    return () => {
      socket.off("friend.sent", handleFriendSent);
      socket.off("friend.error", handleFriendError);
      socket.off("error", handleLegacyError);
    };
  }, [playerId, profileTarget]);

  useEffect(() => {
    if (!profileTarget) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (
        cardRef.current &&
        target instanceof Node &&
        !cardRef.current.contains(target)
      ) {
        closeProfile();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeProfile();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeProfile, profileTarget]);

  if (!profileTarget) return null;

  return (
    <div style={styles.overlay}>
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="false"
        aria-label="玩家资料 · Player profile"
        style={styles.card}
      >
        <button
          type="button"
          aria-label="关闭资料卡 · Close profile card"
          onClick={closeProfile}
          style={styles.closeButton}
        >
          ×
        </button>

        {viewState === "loading" && <LoadingProfile />}
        {viewState === "missing" && <StateMessage text="玩家已离开 · Player has left" />}
        {viewState === "error" && (
          <StateMessage text={errorText || "资料加载失败 · Failed to load profile"} />
        )}
        {viewState === "ready" && profile && (
          <>
            <Avatar
              profile={profile}
              avatarFailed={avatarFailed}
              onAvatarError={() => setAvatarFailureTarget(profile.id)}
            />

            <h3 style={styles.name}>{profile.name}</h3>
            <StatusIndicator isOnline={profile.isOnline} />

            {isOwnProfile ? (
              <OwnTagsEditor
                selectedTags={ownTags}
                tagInput={tagInput}
                onTagInputChange={setTagInput}
                onAdd={addTag}
                onRemove={removeTag}
                onKeyDown={handleTagKeyDown}
              />
            ) : (
              <Tags tags={profile.tags} />
            )}

            <p style={styles.friendCount}>
              {formatFriendsCount(profile.friendsCount)}
            </p>

            {!isOwnProfile && (
              <div style={styles.actions}>
                <button
                  type="button"
                  aria-pressed={isChatOpen}
                  onClick={handleChat}
                  style={{
                    ...styles.primaryButton,
                    ...(isChatOpen ? styles.primaryButtonActive : {}),
                  }}
                >
                  聊天 · Chat
                </button>
                <button
                  type="button"
                  disabled={isAlreadyFriends || requestSent}
                  onClick={handleAddFriend}
                  style={{
                    ...styles.secondaryButton,
                    ...((isAlreadyFriends || requestSent) ? styles.disabledButton : {}),
                  }}
                >
                  {isAlreadyFriends
                    ? "已是好友 · Already Friends"
                    : requestSent
                      ? "已发送 · Sent"
                      : "添加好友 · Add Friend"}
                </button>
                {friendError && <p style={styles.friendError}>{friendError}</p>}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function LoadingProfile() {
  return (
    <div aria-live="polite" style={styles.stateBlock}>
      <div style={styles.skeletonAvatar} />
      <div style={styles.skeletonLineWide} />
      <div style={styles.skeletonLineNarrow} />
      <p style={styles.stateText}>正在加载资料 · Loading profile</p>
    </div>
  );
}

function StateMessage({ text }: { text: string }) {
  return (
    <div aria-live="polite" style={styles.stateBlock}>
      <div style={styles.emptyAvatar}>?</div>
      <p style={styles.stateText}>{text}</p>
    </div>
  );
}

function Avatar({
  profile,
  avatarFailed,
  onAvatarError,
}: {
  profile: PlayerProfile;
  avatarFailed: boolean;
  onAvatarError: () => void;
}) {
  const canRenderImage = isRenderableAvatar(profile.avatar) && !avatarFailed;

  if (canRenderImage) {
    return (
      <img
        src={profile.avatar}
        alt={`头像 · Avatar: ${profile.name}`}
        onError={onAvatarError}
        style={styles.avatarImage}
      />
    );
  }

  return (
    <div
      aria-label={`头像占位 · Avatar placeholder: ${profile.name}`}
      style={{
        ...styles.avatarFallback,
        background: avatarColor(profile.id),
      }}
    >
      {initialsFor(profile.name)}
    </div>
  );
}

function StatusIndicator({ isOnline }: { isOnline: boolean }) {
  return (
    <p style={styles.status}>
      <span
        aria-hidden="true"
        style={{
          ...styles.statusDot,
          color: isOnline ? "#4caf50" : "#666",
        }}
      >
        ●
      </span>
      {isOnline ? "在线 · Online" : "离线 · Offline"}
    </p>
  );
}

function Tags({ tags }: { tags: string[] }) {
  if (tags.length === 0) {
    return <p style={styles.emptyTags}>暂无标签 · No tags yet</p>;
  }

  return (
    <div aria-label="标签 · Tags" style={styles.tags}>
      {tags.map((tag) => (
        <span key={tag} style={styles.tag}>
          {tag}
        </span>
      ))}
    </div>
  );
}

function OwnTagsEditor({
  selectedTags,
  tagInput,
  onTagInputChange,
  onAdd,
  onRemove,
  onKeyDown,
}: {
  selectedTags: string[];
  tagInput: string;
  onTagInputChange: (v: string) => void;
  onAdd: () => void;
  onRemove: (t: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}) {
  return (
    <div style={styles.ownTagsSection}>
      <p style={styles.ownTagsLabel}>
        编辑标签 · Edit Tags ({selectedTags.length}/{MAX_TAGS})
      </p>
      {selectedTags.length > 0 && (
        <div style={styles.tags}>
          {selectedTags.map((tag) => (
            <span key={tag} style={styles.tagChipSelected}>
              {tag}
              <button
                type="button"
                onClick={() => onRemove(tag)}
                style={styles.tagRemove}
                title={`移除 ${tag}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      {selectedTags.length < MAX_TAGS && (
        <div style={styles.tagInputRow}>
          <input
            style={styles.tagTextInput}
            type="text"
            placeholder="输入标签… · Add a tag..."
            value={tagInput}
            onChange={(e) => onTagInputChange(e.target.value.slice(0, MAX_TAG_LENGTH))}
            onKeyDown={onKeyDown}
            maxLength={MAX_TAG_LENGTH}
          />
          <button
            type="button"
            onClick={onAdd}
            disabled={!tagInput.trim()}
            style={{
              ...styles.tagAddBtn,
              ...(!tagInput.trim() ? styles.tagAddBtnDisabled : {}),
            }}
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}

function formatFriendsCount(count: number): string {
  const safeCount = Math.max(0, count);
  return `${safeCount} 位好友 · ${safeCount} ${safeCount === 1 ? "friend" : "friends"}`;
}

function normaliseTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((tag): tag is string => typeof tag === "string" && tag.trim() !== "");
}

function isProfilePayload(value: unknown): value is {
  id: string;
  name?: string;
  avatar?: string;
  tags?: unknown;
  friendsCount?: unknown;
  isOnline?: unknown;
} {
  return isRecord(value) && typeof value.id === "string";
}

function isErrorPayload(value: unknown): value is { code?: string; message?: string } {
  return isRecord(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isRenderableAvatar(avatar: string): boolean {
  return /^(https?:\/\/|data:image\/|blob:|\/|\.\/|\.\.\/)/.test(avatar);
}

function initialsFor(name: string): string {
  const compactName = name.replace(/\s+/g, "");
  if (!compactName) return "?";

  const latinParts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (latinParts.length > 1 && latinParts.every((part) => /^[a-z]/i.test(part))) {
    return latinParts
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("");
  }

  return compactName.slice(0, 2).toUpperCase();
}

function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `linear-gradient(135deg, hsl(${hue}, 58%, 38%), hsl(${(hue + 36) % 360}, 55%, 26%))`;
}

const styles: Record<string, CSSProperties> = {
  overlay: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
    zIndex: 90,
  },
  card: {
    position: "relative",
    width: "min(340px, calc(100vw - 32px))",
    minHeight: 300,
    padding: "28px 24px 24px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(26, 26, 46, 0.96)",
    boxShadow: "0 18px 50px rgba(0,0,0,0.48)",
    color: "#fff",
    pointerEvents: "auto",
    textAlign: "center",
  },
  closeButton: {
    position: "absolute",
    top: 10,
    right: 12,
    width: 28,
    height: 28,
    border: "none",
    borderRadius: 6,
    background: "rgba(255,255,255,0.06)",
    color: "#888",
    cursor: "pointer",
    fontSize: 20,
    lineHeight: "24px",
    pointerEvents: "auto",
  },
  avatarImage: {
    width: 72,
    height: 72,
    borderRadius: "50%",
    objectFit: "cover",
    display: "block",
    margin: "0 auto 14px",
    border: "2px solid rgba(76, 175, 80, 0.55)",
    background: "rgba(255,255,255,0.08)",
  },
  avatarFallback: {
    width: 72,
    height: 72,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 14px",
    border: "2px solid rgba(76, 175, 80, 0.55)",
    color: "#fff",
    fontSize: 24,
    fontWeight: 800,
    textShadow: "0 1px 2px rgba(0,0,0,0.35)",
  },
  name: {
    margin: "0 24px 6px",
    color: "#fff",
    fontSize: 22,
    lineHeight: 1.2,
    fontWeight: 800,
    overflowWrap: "anywhere",
  },
  status: {
    margin: "0 0 16px",
    color: "#888",
    fontSize: 13,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    fontSize: 12,
    lineHeight: 1,
  },
  tags: {
    display: "flex",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 8,
    minHeight: 28,
    margin: "0 0 14px",
  },
  tag: {
    maxWidth: "100%",
    padding: "5px 10px",
    borderRadius: 6,
    border: "1px solid rgba(76, 175, 80, 0.35)",
    background: "rgba(76, 175, 80, 0.12)",
    color: "#dff7e1",
    fontSize: 12,
    fontWeight: 700,
    overflowWrap: "anywhere",
  },
  emptyTags: {
    minHeight: 28,
    margin: "0 0 14px",
    color: "#888",
    fontSize: 13,
  },
  ownTagsSection: {
    margin: "0 0 14px",
  },
  ownTagsLabel: {
    margin: "0 0 8px",
    color: "#888",
    fontSize: 12,
    fontWeight: 600,
  },
  tagChipSelected: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "4px 8px",
    borderRadius: 6,
    background: "rgba(76, 175, 80, 0.15)",
    border: "1px solid rgba(76, 175, 80, 0.4)",
    color: "#4caf50",
    fontSize: 12,
    fontWeight: 700,
    overflowWrap: "anywhere",
  },
  tagRemove: {
    background: "none",
    border: "none",
    color: "#888",
    cursor: "pointer",
    fontSize: 14,
    lineHeight: "12px",
    padding: "0 2px",
    pointerEvents: "auto",
  },
  tagInputRow: {
    display: "flex",
    gap: 6,
  },
  tagTextInput: {
    flex: 1,
    minWidth: 0,
    padding: "6px 10px",
    fontSize: 13,
    borderRadius: 6,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.08)",
    color: "#fff",
    outline: "none",
    boxSizing: "border-box" as const,
  },
  tagAddBtn: {
    width: 34,
    height: 34,
    borderRadius: 6,
    border: "1px solid rgba(76, 175, 80, 0.35)",
    background: "rgba(76, 175, 80, 0.15)",
    color: "#4caf50",
    cursor: "pointer",
    fontSize: 20,
    fontWeight: 700,
    flexShrink: 0,
    pointerEvents: "auto",
  },
  tagAddBtnDisabled: {
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    color: "#444",
    cursor: "not-allowed",
  },
  friendCount: {
    margin: "0 0 20px",
    color: "#fff",
    fontSize: 14,
    fontWeight: 700,
  },
  actions: {
    display: "flex",
    gap: 10,
    justifyContent: "center",
    flexWrap: "wrap",
  },
  friendError: {
    width: "100%",
    margin: "6px 0 0",
    padding: "6px 10px",
    borderRadius: 6,
    background: "rgba(239, 83, 80, 0.12)",
    border: "1px solid rgba(239, 83, 80, 0.25)",
    color: "#ffb3b3",
    fontSize: 12,
    lineHeight: 1.35,
    textAlign: "center",
  },
  primaryButton: {
    minWidth: 116,
    minHeight: 38,
    padding: "9px 16px",
    borderRadius: 6,
    border: "1px solid #4caf50",
    background: "#4caf50",
    color: "#fff",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 800,
    pointerEvents: "auto",
  },
  primaryButtonActive: {
    boxShadow: "0 0 0 3px rgba(76, 175, 80, 0.22)",
  },
  secondaryButton: {
    minWidth: 138,
    minHeight: 38,
    padding: "9px 16px",
    borderRadius: 6,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.06)",
    color: "#fff",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 800,
    pointerEvents: "auto",
  },
  disabledButton: {
    color: "#888",
    borderColor: "rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.035)",
    cursor: "not-allowed",
  },
  stateBlock: {
    minHeight: 248,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  stateText: {
    margin: 0,
    color: "#888",
    fontSize: 14,
    lineHeight: 1.45,
  },
  emptyAvatar: {
    width: 72,
    height: 72,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "#888",
    fontSize: 26,
    fontWeight: 800,
  },
  skeletonAvatar: {
    width: 72,
    height: 72,
    borderRadius: "50%",
    background: "linear-gradient(90deg, rgba(255,255,255,0.06), rgba(255,255,255,0.13), rgba(255,255,255,0.06))",
  },
  skeletonLineWide: {
    width: 170,
    height: 16,
    borderRadius: 4,
    background: "rgba(255,255,255,0.1)",
  },
  skeletonLineNarrow: {
    width: 112,
    height: 12,
    borderRadius: 4,
    background: "rgba(255,255,255,0.075)",
  },
};
