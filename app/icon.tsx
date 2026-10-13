import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { PALETTE } from "@/lib/palette";

// A favicon is read at 16px, where the mark's thin lines close up, so it sits on the
// page colour at full bleed rather than inside a badge that steals half the room.
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default async function Icon() {
  const logo = await readFile(join(process.cwd(), "public", "logo.svg"));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: PALETTE.sand,
        }}
      >
        <img
          width={52}
          height={64}
          src={`data:image/svg+xml;base64,${logo.toString("base64")}`}
          alt=""
        />
      </div>
    ),
    size,
  );
}
