import { NextResponse } from "next/server";

export const runtime = "nodejs";

const THEME: Record<string, { primary: string; secondary: string; accent: string }> = {
  mochilas: { primary: "#ffe2ec", secondary: "#fff7df", accent: "#7b5d72" },
  cadernos: { primary: "#ffe9de", secondary: "#fff8f0", accent: "#7a5964" },
  papeis: { primary: "#e7f2ff", secondary: "#fffce9", accent: "#5d6574" },
  fofuras: { primary: "#ffe4f3", secondary: "#fff8fc", accent: "#875471" },
  desenhos: { primary: "#e8f4ff", secondary: "#fff4df", accent: "#576781" },
  "agendas-planners": { primary: "#f0e9ff", secondary: "#fff6e4", accent: "#67597b" },
  canetas: { primary: "#ffe6f3", secondary: "#ebfcff", accent: "#815a68" },
  "tesouras-reguas": { primary: "#e8fff4", secondary: "#fff8de", accent: "#5b7768" },
  presentes: { primary: "#fff0dc", secondary: "#ffe9f6", accent: "#7c5f4c" },
};

function safeText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function breakLabel(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return [value];

  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")].filter(Boolean);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const categoryId = String(searchParams.get("category") || "presentes").trim();
  const label = String(searchParams.get("label") || "Categoria").trim();
  const lines = breakLabel(label);
  const theme = THEME[categoryId] ?? THEME.presentes;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="720" height="720" viewBox="0 0 720 720" fill="none">
      <defs>
        <linearGradient id="bg" x1="80" y1="70" x2="650" y2="660" gradientUnits="userSpaceOnUse">
          <stop stop-color="${theme.primary}" />
          <stop offset="1" stop-color="${theme.secondary}" />
        </linearGradient>
        <radialGradient id="glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(540 180) rotate(122.497) scale(292.559 267.85)">
          <stop stop-color="#ffffff" stop-opacity="0.85" />
          <stop offset="1" stop-color="#ffffff" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect width="720" height="720" rx="160" fill="url(#bg)"/>
      <circle cx="542" cy="176" r="170" fill="url(#glow)"/>
      <circle cx="182" cy="562" r="100" fill="rgba(255,255,255,0.38)"/>
      <circle cx="134" cy="174" r="12" fill="${theme.accent}" fill-opacity="0.18"/>
      <circle cx="608" cy="556" r="16" fill="${theme.accent}" fill-opacity="0.14"/>
      <rect x="160" y="140" width="400" height="280" rx="52" fill="#ffffff" fill-opacity="0.78"/>
      <rect x="210" y="190" width="32" height="180" rx="16" fill="${theme.accent}" fill-opacity="0.8"/>
      <rect x="264" y="214" width="188" height="20" rx="10" fill="${theme.accent}" fill-opacity="0.16"/>
      <rect x="264" y="266" width="164" height="20" rx="10" fill="${theme.accent}" fill-opacity="0.12"/>
      <rect x="264" y="318" width="196" height="20" rx="10" fill="${theme.accent}" fill-opacity="0.12"/>
      <rect x="264" y="370" width="130" height="20" rx="10" fill="${theme.accent}" fill-opacity="0.12"/>
      <text x="360" y="492" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="800" fill="${theme.accent}" letter-spacing="4">CURADORIA</text>
      <text x="360" y="562" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="46" font-weight="800" fill="${theme.accent}">${safeText(lines[0] || label)}</text>
      ${
        lines[1]
          ? `<text x="360" y="614" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="46" font-weight="800" fill="${theme.accent}">${safeText(lines[1])}</text>`
          : ""
      }
    </svg>
  `.trim();

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
