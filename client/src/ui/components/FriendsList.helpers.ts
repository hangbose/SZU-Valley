import type { Friend } from "@/network/bridge";

type SetProfileTarget = (id: string | null) => void;
type FocusEntityEmitter = (
  event: "focus-entity",
  payload: { id: string },
) => void;

const friendNameCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function sortFriendsForDisplay(friends: readonly Friend[]): Friend[] {
  return [...friends].sort((a, b) => {
    if (a.isOnline !== b.isOnline) {
      return a.isOnline ? -1 : 1;
    }

    return (
      friendNameCollator.compare(a.name, b.name) ||
      friendNameCollator.compare(a.id, b.id)
    );
  });
}

export function friendFromAcceptedPayload(payload: unknown): Friend | null {
  if (!isRecord(payload)) return null;

  const id = stringValue(payload.id) ?? stringValue(payload.by);
  const name = stringValue(payload.name) ?? stringValue(payload.byName);

  if (!id || !name) return null;

  return {
    id,
    name,
    avatar: stringValue(payload.avatar) ?? "",
    isOnline: booleanValue(payload.isOnline, true),
  };
}

export function focusFriendEntity(
  id: string,
  setProfileTarget: SetProfileTarget,
  emitFocusEntity: FocusEntityEmitter,
): void {
  emitFocusEntity("focus-entity", { id });
  setProfileTarget(id);
}
