/**
 * Pixel UI Parts — Image-based components from reference designs.
 *
 * PNG assets extracted from the reference mockups, stored in
 * client/public/assets/ui/.  All sizing is pre-cropped to match
 * the original pixel-art proportions.
 */

import React from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PixelStyle = React.CSSProperties;

type BaseProps = {
  className?: string;
  style?: PixelStyle;
  scale?: number;
};

// ---------------------------------------------------------------------------
// Font (from reference file)
// ---------------------------------------------------------------------------

export const pixelFont =
  '"Press Start 2P", "Fusion Pixel", "Zpix", "Microsoft YaHei", monospace';

// ---------------------------------------------------------------------------
// Image assets
// ---------------------------------------------------------------------------

const ASSETS = {
  dialog: "/assets/ui/dialog.png",
  glow: "/assets/ui/glow.png",
  key: "/assets/ui/key.png",
  panel: "/assets/ui/panel.png",
} as const;

// ---------------------------------------------------------------------------
// Original image dimensions (px at 1× scale)
// ---------------------------------------------------------------------------

const SIZE = {
  dialog: { width: 925, height: 375 },
  glow: { width: 410, height: 355 },
  key: { width: 340, height: 245 },
  panel: { width: 830, height: 430 },
} as const;

// ---------------------------------------------------------------------------
// Internal: scaled <img>
// ---------------------------------------------------------------------------

function PixelImage({
  src,
  width,
  height,
  scale = 1,
  className,
  style,
  alt = "",
}: BaseProps & {
  src: string;
  width: number;
  height: number;
  alt?: string;
}) {
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={{
        display: "block",
        width: width * scale,
        height: height * scale,
        imageRendering: "pixelated",
        ...style,
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Exported components
// ---------------------------------------------------------------------------

/**
 * Pixel-art dialog box with a speech-bubble tail.
 * Useful for NPC dialogue, system messages, or long-form text.
 */
export function PixelDialogBox({
  scale = 1,
  className,
  style,
  children,
  contentStyle,
}: BaseProps & {
  children?: React.ReactNode;
  contentStyle?: PixelStyle;
}) {
  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: SIZE.dialog.width * scale,
        height: SIZE.dialog.height * scale,
        ...style,
      }}
    >
      <PixelImage
        src={ASSETS.dialog}
        {...SIZE.dialog}
        scale={scale}
        alt="dialog box"
      />
      {children && (
        <div
          style={{
            position: "absolute",
            left: 70 * scale,
            top: 72 * scale,
            right: 70 * scale,
            bottom: 70 * scale,
            fontFamily: pixelFont,
            fontSize: 18 * scale,
            lineHeight: 1.8,
            color: "#303044",
            overflow: "hidden",
            ...contentStyle,
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * Golden glow ring — indicates an interactable entity nearby.
 */
export function PixelGlowCircle({ scale = 1, className, style }: BaseProps) {
  return (
    <PixelImage
      src={ASSETS.glow}
      {...SIZE.glow}
      scale={scale}
      className={className}
      style={style}
      alt="interaction glow circle"
    />
  );
}

/**
 * "E" key prompt with pixel-art styling.
 */
export function PixelKeyPrompt({
  scale = 1,
  className,
  style,
  keyLabel = "E",
}: BaseProps & { keyLabel?: string }) {
  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: SIZE.key.width * scale,
        height: SIZE.key.height * scale,
        ...style,
      }}
    >
      <PixelImage
        src={ASSETS.key}
        {...SIZE.key}
        scale={scale}
        alt="E key prompt"
      />
      {keyLabel !== "E" && (
        <div
          style={{
            position: "absolute",
            left: 128 * scale,
            top: 50 * scale,
            width: 92 * scale,
            height: 92 * scale,
            display: "grid",
            placeItems: "center",
            fontFamily: pixelFont,
            fontSize: 52 * scale,
            fontWeight: 700,
            color: "#252a3a",
          }}
        >
          {keyLabel}
        </div>
      )}
    </div>
  );
}

/**
 * Dark bottom panel with golden borders, compass badge, and map pin.
 * Useful for zone info, NPC details, or action prompts.
 */
export function PixelBottomPanel({
  scale = 1,
  className,
  style,
  children,
  contentStyle,
}: BaseProps & {
  children?: React.ReactNode;
  contentStyle?: PixelStyle;
}) {
  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: SIZE.panel.width * scale,
        height: SIZE.panel.height * scale,
        ...style,
      }}
    >
      <PixelImage
        src={ASSETS.panel}
        {...SIZE.panel}
        scale={scale}
        alt="info panel"
      />
      {children && (
        <div
          style={{
            position: "absolute",
            left: 90 * scale,
            top: 80 * scale,
            right: 70 * scale,
            bottom: 60 * scale,
            fontFamily: pixelFont,
            fontSize: 16 * scale,
            lineHeight: 1.8,
            color: "#ffe19d",
            overflow: "hidden",
            ...contentStyle,
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
