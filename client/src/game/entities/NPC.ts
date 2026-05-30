/**
 * NPC — A non-player character sprite on the map.
 *
 * NPCs are static (no movement) and sit at fixed positions.
 * Clicking an NPC triggers proximity check → bridge event → UI dialogue.
 */

import Phaser from "phaser";
import { bridge } from "@/network/bridge";

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

    // TODO: Create sprite from NPC spritesheet
    // Placeholder: a blue rectangle
    const graphics = scene.add.graphics();
    graphics.fillStyle(0x4488ff, 1);
    graphics.fillRect(x * 32 - 8, y * 32 - 16, 16, 32);

    // Name tag
    const nameTag = scene.add.text(x * 32, y * 32 - 24, name, {
      fontSize: "10px",
      color: "#44aaff",
      backgroundColor: "#00000088",
      padding: { x: 2, y: 1 },
    });
    nameTag.setOrigin(0.5, 1);

    // Click → emit bridge event (proximity validation done by caller)
    this.sprite = scene.add
      .sprite(x * 32, y * 32, "__DEFAULT")
      .setInteractive({ useHandCursor: true })
      .setOrigin(0.5, 0.5);
    this.sprite.setVisible(false); // placeholder

    this.sprite.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      bridge.emit("npc-clicked", {
        npcId: this.id,
        screenX: pointer.x,
        screenY: pointer.y,
      });
    });
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
