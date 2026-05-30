/**
 * Bridge — Typed Event Emitter between Phaser (Game) and React (UI).
 *
 * All Game → UI events and UI → Game commands go through this singleton.
 * Phaser emits events when things happen on the canvas; React subscribes
 * and updates UI. React emits commands; Phaser subscribes and acts.
 */

import mitt from "mitt";

// ---------------------------------------------------------------------------
// Event type definitions
// ---------------------------------------------------------------------------

/** A player or NPC on the map (minimal representation for UI events). */
export interface MapEntity {
  id: string;
  name: string;
  x: number;
  y: number;
  isNPC: boolean;
}

/** Chat message structure (mirrors protocol). */
export interface ChatMessage {
  id: string;
  from: string;
  fromName: string;
  to: string;
  text: string;
  timestamp: number;
}

/** Friend (mirrors server shape). */
export interface Friend {
  id: string;
  name: string;
  avatar: string;
  isOnline: boolean;
}

/** Pending friend request (mirrors server shape). */
export interface FriendRequest {
  from: string;
  fromName: string;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Game → UI events (Phaser emits, React listens)
// ---------------------------------------------------------------------------

export interface GameToUIEvents {
  /** Player clicked on canvas. UI shows ProfileCard. */
  "player-clicked": { playerId: string; screenX: number; screenY: number };

  /** NPC clicked on canvas. UI shows NPC dialogue. */
  "npc-clicked": { npcId: string; screenX: number; screenY: number };

  /** Local player's tile position changed (throttled ~10/s). */
  "position-changed": { x: number; y: number; zoneName: string };

  /** Another entity entered proximity range (≤3 tiles Manhattan). */
  "proximity-enter": MapEntity;

  /** An entity left proximity range. */
  "proximity-exit": { id: string };

  /** Zone changed (crossed zone boundary). */
  "zone-changed": { zoneName: string };
}

// ---------------------------------------------------------------------------
// UI → Game commands (React emits, Phaser listens)
// ---------------------------------------------------------------------------

export interface UIToGameCommands {
  /** Focus the camera on a specific player/NPC. */
  "focus-entity": { id: string };

  /** Show/hide the "Press E to interact" floating indicator. */
  "show-indicator": { visible: boolean; targetName?: string };
}

// ---------------------------------------------------------------------------
// Typed emitter wrapper
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type EventMap = GameToUIEvents & UIToGameCommands;

class Bridge {
  // mitt requires a broader type; we narrow via the public API
  private emitter = mitt<Record<string, unknown>>();

  /** Subscribe to an event. Returns an unsubscribe function. */
  on<E extends keyof EventMap>(
    event: E,
    handler: (payload: EventMap[E]) => void,
  ): () => void {
    const cb = handler as (payload: unknown) => void;
    this.emitter.on(event as string, cb);
    return () => {
      this.emitter.off(event as string, cb);
    };
  }

  /** Emit an event from Game → UI or UI → Game. */
  emit<E extends keyof EventMap>(event: E, payload: EventMap[E]): void {
    this.emitter.emit(event as string, payload);
  }

  /** Remove all listeners for an event. */
  off<E extends keyof EventMap>(event: E): void {
    this.emitter.off(event as string);
  }

  /** Remove all listeners for all events. */
  clear(): void {
    this.emitter.all.clear();
  }
}

/** Singleton bridge instance — the single communication channel between Phaser and React. */
export const bridge = new Bridge();
