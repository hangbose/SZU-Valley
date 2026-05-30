/**
 * NPC — A non-player character sprite on the map.
 *
 * NPCs are static (no movement) and sit at fixed positions.
 * Clicking / tapping an NPC emits `npc-clicked` via the bridge.
 * Proximity validation is handled by GameScene before interaction.
 *
 * Uses a generated placeholder texture (blue figure) until D delivers
 * real NPC spritesheets. The pattern matches LocalPlayer.
 */

import Phaser from "phaser";
import { bridge } from "@/network/bridge";

// ---------------------------------------------------------------------------
// Placeholder texture (generated once, reused for all NPCs)
// ---------------------------------------------------------------------------

const TEX_W = 16;
const TEX_H = 20;

let textureGenerated = false;

function ensureNpcTexture(scene: Phaser.Scene): void {
  if (textureGenerated) return;

  const gfx = scene.add.graphics();
  // Body
  gfx.fillStyle(0x4488ff, 1);
  gfx.fillRect(0, 0, TEX_W, TEX_H);
  // Head (slightly different shade)
  gfx.fillStyle(0x5599ff, 1);
  gfx.fillRect(2, 0, TEX_W - 4, 6);
  // Eyes
  gfx.fillStyle(0xffffff, 0.7);
  gfx.fillRect(TEX_W - 7, 2, 2, 2);
  gfx.fillRect(TEX_W - 7, TEX_H - 10, 2, 2);

  gfx.generateTexture("__npc_placeholder", TEX_W, TEX_H);
  gfx.destroy();
  textureGenerated = true;
}

// ---------------------------------------------------------------------------
// NPC
// ---------------------------------------------------------------------------

export class NPC {
  id: string;
  name: string;
  sprite: Phaser.GameObjects.Sprite;

  constructor(
    scene: Phaser.Scene,
    id: string,
    name: string,
    _avatar: string,
    x: number,
    y: number,
    _description: string,
  ) {
    this.id = id;
    this.name = name;

    ensureNpcTexture(scene);

    const px = x * 32 + 16;
    const py = y * 32 + 16;

    // --- Visible sprite (clickable) ---
    this.sprite = scene.add
      .sprite(px, py, "__npc_placeholder")
      .setInteractive({ useHandCursor: true })
      .setOrigin(0.5, 0.5);

    // --- Pointer / touch → emit bridge event ---
    this.sprite.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      bridge.emit("npc-clicked", {
        npcId: this.id,
        npcName: this.name,
        screenX: pointer.x,
        screenY: pointer.y,
      });
    });

    // --- Name tag ---
    const nameTag = scene.add.text(px, py - 16, name, {
      fontSize: "10px",
      color: "#44aaff",
      backgroundColor: "#00000088",
      padding: { x: 2, y: 1 },
    });
    nameTag.setOrigin(0.5, 1);

    void _avatar;
    void _description;
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
