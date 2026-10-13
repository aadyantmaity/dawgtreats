import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

// The mark is the wordmark's two initials. A favicon file cannot carry a font, so the
// letters are drawn here from the same face the site uses.
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default async function Icon() {
  const font = await readFile(join(process.cwd(), "assets", "shantell-sans-bold.ttf"));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#e6e0d2",
          color: "#15130f",
          fontFamily: "Shantell",
          fontSize: 34,
          letterSpacing: -1,
        }}
      >
        DT
      </div>
    ),
    { ...size, fonts: [{ name: "Shantell", data: font, weight: 700, style: "normal" }] },
  );
}
