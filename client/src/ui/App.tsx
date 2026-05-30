/**
 * App.tsx — Root React component.
 *
 * Phase machine:
 * - "join" → renders JoinScreen (full-screen, no Phaser)
 * - "game" → renders Phaser canvas + HUD overlay + ChatPanel + FriendsList
 *
 * Phaser is created once on phase transition to "game" and mounted
 * into a dedicated <div ref>.
 */

import { useEffect, useRef, useState } from "react";
import Phaser from "phaser";
import { useGameStore } from "@/ui/store/gameStore";
import { createGame, destroyGame } from "@/game";
import { JoinScreen } from "@/ui/screens/JoinScreen";
import { HUD } from "@/ui/components/HUD";
import { ChatPanel } from "@/ui/components/ChatPanel";
import { ProfileCard } from "@/ui/components/ProfileCard";
import { FriendsList } from "@/ui/components/FriendsList";
import { FriendToast } from "@/ui/components/FriendToast";
import { NPCDialogue } from "@/ui/components/NPCDialogue";

export function App() {
  const phase = useGameStore((s) => s.phase);
  const [game, setGame] = useState<Phaser.Game | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Start Phaser when entering "game" phase
  useEffect(() => {
    if (phase === "game" && containerRef.current && !game) {
      const g = createGame(containerRef.current);
      setGame(g);
    }
    return () => {
      if (game) {
        destroyGame(game);
        setGame(null);
      }
    };
  }, [phase, game]);

  if (phase === "join") {
    return <JoinScreen />;
  }

  return (
    <div style={styles.root}>
      {/* Phaser canvas */}
      <div ref={containerRef} style={styles.canvas} />

      {/* React UI overlay (positioned absolutely on top of canvas) */}
      <div style={styles.overlay}>
        <HUD />
        <div style={styles.sidebar}>
          <FriendsList />
        </div>
        <ChatPanel />
        <ProfileCard />
        <NPCDialogue />
        <FriendToast />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline styles (replaced by CSS modules / palette.css when D delivers)
// ---------------------------------------------------------------------------

const styles: Record<string, React.CSSProperties> = {
  root: {
    position: "relative",
    width: "100vw",
    height: "100vh",
    overflow: "hidden",
    background: "#1a1a2e",
  },
  canvas: {
    position: "absolute",
    inset: 0,
  },
  overlay: {
    position: "absolute",
    inset: 0,
    pointerEvents: "none", // allow clicks to pass through to Phaser canvas
  },
  sidebar: {
    position: "absolute",
    right: 0,
    top: 48,
    bottom: 0,
    width: 200,
    pointerEvents: "none",
  },
};
