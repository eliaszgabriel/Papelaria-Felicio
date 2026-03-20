function normalizeValue(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatProductVariantTitle(title?: string | null, colorName?: string | null) {
  const baseTitle = String(title || "").trim();
  const color = String(colorName || "").trim();

  if (!baseTitle || !color) return baseTitle;

  const normalizedTitle = normalizeValue(baseTitle);
  const normalizedColor = normalizeValue(color);

  if (normalizedTitle.includes(normalizedColor)) {
    return baseTitle;
  }

  return `${baseTitle} ${color}`;
}
