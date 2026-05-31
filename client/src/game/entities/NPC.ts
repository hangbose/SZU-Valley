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
// Tunables
// ---------------------------------------------------------------------------

/** Name tag text size (world px). Large to stay crisp at ~0.2x zoom. */
const NAMETAG_FONT_SIZE = "60px";

/** Horizontal padding inside the name-tag background (world px). */
const NAMETAG_PAD_X = 40;

/** Vertical padding inside the name-tag background (world px). */
const NAMETAG_PAD_Y = 32;

/** Vertical offset of the name tag above the sprite (world px). */
const NAMETAG_OFFSET_Y = -28;

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
    avatar: string,
    x: number,
    y: number,
    _description: string,
  ) {
    this.id = id;
    this.name = name;

    const px = x * 32 + 16;
    const py = y * 32 + 16;

    // Use NPC's avatar texture, fall back to avatar_02
    const textureKey = scene.textures.exists(avatar) ? avatar : "avatar_02";
    this.sprite = scene.add
      .sprite(px, py, textureKey, 0)
      .setInteractive({ useHandCursor: true })
      .setOrigin(0.5, 0.75)
      .setScale(0.25);

    // --- Pointer / touch → emit bridge event ---
    this.sprite.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      bridge.emit("npc-clicked", {
        npcId: this.id,
        npcName: this.name,
        screenX: pointer.x,
        screenY: pointer.y,
      });
    });

    // --- Name tag (PNG bg behind, text on top — bg scales to fit text) ---
    const tagY = py + NAMETAG_OFFSET_Y;
    const npcText = scene.add.text(px, tagY, name, {
      fontSize: NAMETAG_FONT_SIZE, color: "#2b2b32", fontFamily: "monospace",
    }).setOrigin(0.5, 0.5).setDepth(20);

    const tex = scene.textures.get("ui-nametag");
    const texW = tex.getSourceImage().width;
    const texH = tex.getSourceImage().height;
    // Scale to fit BOTH text width and height — use max so bg fully covers text
    const scaleX = (npcText.width + NAMETAG_PAD_X) / texW;
    const scaleY = (npcText.height + NAMETAG_PAD_Y) / texH;
    const tagScale = Math.max(scaleX, scaleY, 0.08);
    scene.add.sprite(px, tagY, "ui-nametag")
      .setOrigin(0.5, 0.5).setScale(tagScale).setDepth(11);

    void _description;
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
