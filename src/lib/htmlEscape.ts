export function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function sanitizeEmailUrl(value: string) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "#";

  try {
    const url = new URL(trimmed);
    if (url.protocol === "http:" || url.protocol === "https:" || url.protocol === "mailto:") {
      return url.toString();
    }
  } catch {}

  return "#";
}
