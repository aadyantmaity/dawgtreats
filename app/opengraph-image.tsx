import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

// The picture shown wherever the site is pasted: a message, a chat, a post.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Dawg Treats";

export default async function OpengraphImage() {
  const [font, photo] = await Promise.all([
    readFile(join(process.cwd(), "assets", "shantell-sans-bold.ttf")),
    // Rotation baked in: the camera stores it as metadata, which this renderer ignores.
    readFile(join(process.cwd(), "assets", "og-photo.jpg")),
  ]);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative" }}>
        <img
          alt=""
          src={`data:image/jpeg;base64,${photo.toString("base64")}`}
          width={size.width}
          height={size.height}
          style={{ objectFit: "cover" }}
        />
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            // Explicit size: this renderer sizes an inset overlay to its text, not its parent.
            width: size.width,
            height: size.height,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(21,19,15,0.56)",
            color: "#f6f3ee",
            fontFamily: "Display",
            fontSize: 104,
          }}
        >
          Dawg Treats
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: "Display", data: font, weight: 700, style: "normal" }] },
  );
}
