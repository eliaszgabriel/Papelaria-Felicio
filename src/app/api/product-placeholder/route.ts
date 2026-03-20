import { NextResponse } from "next/server";
import { CATEGORY_NAME_BY_ID } from "@/lib/catalog";

export const runtime = "nodejs";

const CATEGORY_THEME: Record<
  string,
  { primary: string; secondary: string; accent: string; label: string }
> = {
  mochilas: {
    primary: "#ffd9ec",
    secondary: "#fff4d6",
    accent: "#8a5772",
    label: "Mochilas",
  },
  cadernos: {
    primary: "#ffe3d6",
    secondary: "#fff4ef",
    accent: "#7d5564",
    label: "Cadernos",
  },
  papeis: {
    primary: "#ecf5ff",
    secondary: "#fff9df",
    accent: "#5d6678",
    label: "Papeis",
  },
  fofuras: {
    primary: "#ffe0f0",
    secondary: "#fff6fb",
    accent: "#874f76",
    label: "Fofuras",
  },
  desenhos: {
    primary: "#e6f2ff",
    secondary: "#fff4de",
    accent: "#556687",
    label: "Desenhos",
  },
  "agendas-planners": {
    primary: "#efe8ff",
    secondary: "#fff4df",
    accent: "#67557d",
    label: "Agendas e planners",
  },
  canetas: {
    primary: "#ffe6f0",
    secondary: "#e5fbff",
    accent: "#7f5a69",
    label: "Canetas",
  },
  "tesouras-reguas": {
    primary: "#e6fff2",
    secondary: "#fff6df",
    accent: "#5b7466",
    label: "Tesouras e Reguas",
  },
  presentes: {
    primary: "#fff0d9",
    secondary: "#ffe7f6",
    accent: "#7d5c4c",
    label: "Presentes",
  },
};

function safeText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function breakIntoLines(value: string, maxChars = 24) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }

    if (current) {
      lines.push(current);
      current = word;
    } else {
      lines.push(word.slice(0, maxChars));
      current = word.slice(maxChars);
    }

    if (lines.length === 2) break;
  }

  if (lines.length < 2 && current) {
    lines.push(current);
  }

  return lines.slice(0, 2);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = String(searchParams.get("name") || "Produto da Papelaria Felicio").trim();
  const categoryId = String(searchParams.get("category") || "presentes").trim();
  const theme = CATEGORY_THEME[categoryId] ?? CATEGORY_THEME.presentes;
  const lines = breakIntoLines(name);
  const categoryLabel = CATEGORY_NAME_BY_ID[categoryId] ?? theme.label;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200" fill="none">
      <defs>
        <linearGradient id="bg" x1="120" y1="100" x2="1080" y2="1100" gradientUnits="userSpaceOnUse">
          <stop stop-color="${theme.primary}"/>
          <stop offset="1" stop-color="${theme.secondary}"/>
        </linearGradient>
        <radialGradient id="glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(930 230) rotate(108.568) scale(507.366 534.647)">
          <stop stop-color="#ffffff" stop-opacity="0.9"/>
          <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="1200" height="1200" rx="88" fill="url(#bg)"/>
      <rect x="72" y="72" width="1056" height="1056" rx="72" fill="rgba(255,255,255,0.45)"/>
      <circle cx="928" cy="226" r="228" fill="url(#glow)"/>
      <circle cx="282" cy="944" r="170" fill="rgba(255,255,255,0.36)"/>
      <circle cx="228" cy="264" r="16" fill="${theme.accent}" fill-opacity="0.2"/>
      <circle cx="1012" cy="900" r="22" fill="${theme.accent}" fill-opacity="0.16"/>
      <circle cx="964" cy="840" r="12" fill="${theme.accent}" fill-opacity="0.26"/>
      <path d="M254 310C254 269.131 287.131 236 328 236H514C554.869 236 588 269.131 588 310V734C588 774.869 554.869 808 514 808H328C287.131 808 254 774.869 254 734V310Z" fill="#fffafc" fill-opacity="0.92"/>
      <path d="M310 308C310 291.431 323.431 278 340 278H502C518.569 278 532 291.431 532 308V736C532 752.569 518.569 766 502 766H340C323.431 766 310 752.569 310 736V308Z" fill="${theme.primary}"/>
      <rect x="344" y="318" width="24" height="408" rx="12" fill="${theme.accent}" fill-opacity="0.75"/>
      <rect x="386" y="362" width="112" height="14" rx="7" fill="${theme.accent}" fill-opacity="0.18"/>
      <rect x="386" y="410" width="96" height="14" rx="7" fill="${theme.accent}" fill-opacity="0.12"/>
      <rect x="386" y="458" width="118" height="14" rx="7" fill="${theme.accent}" fill-opacity="0.12"/>
      <rect x="386" y="506" width="86" height="14" rx="7" fill="${theme.accent}" fill-opacity="0.12"/>
      <rect x="386" y="554" width="124" height="14" rx="7" fill="${theme.accent}" fill-opacity="0.12"/>
      <rect x="386" y="602" width="72" height="14" rx="7" fill="${theme.accent}" fill-opacity="0.12"/>
      <rect x="662" y="280" width="270" height="270" rx="48" fill="#ffffff" fill-opacity="0.82"/>
      <circle cx="797" cy="415" r="92" fill="${theme.primary}"/>
      <path d="M744 476L782 344C786 330 808 330 812 344L850 476" stroke="${theme.accent}" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M740 410H854" stroke="${theme.accent}" stroke-width="20" stroke-linecap="round"/>
      <rect x="660" y="618" width="360" height="84" rx="42" fill="#ffffff" fill-opacity="0.84"/>
      <text x="840" y="671" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="700" fill="${theme.accent}" letter-spacing="4">${safeText(categoryLabel.toUpperCase())}</text>
      <text x="662" y="826" font-family="Arial, Helvetica, sans-serif" font-size="54" font-weight="800" fill="${theme.accent}">${safeText(lines[0] || "Produto")}</text>
      ${
        lines[1]
          ? `<text x="662" y="890" font-family="Arial, Helvetica, sans-serif" font-size="54" font-weight="800" fill="${theme.accent}">${safeText(lines[1])}</text>`
          : ""
      }
      <text x="662" y="998" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="600" fill="${theme.accent}" fill-opacity="0.65">Papelaria Felicio</text>
    </svg>
  `.trim();

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
