export type ProductColorOption = {
  id: string;
  name: string;
  imageUrl: string;
  includeInGallery?: boolean;
  source?: "preset" | "custom";
};

export type ProductImageInput = {
  url?: string | null;
  alt?: string | null;
  sortOrder?: number | null;
};

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-+|-+$)/g, "");
}

export function createColorOptionId(name: string) {
  return slugify(name) || `cor-${Date.now()}`;
}

export function normalizeProductColorOptions(input: unknown): ProductColorOption[] {
  if (!Array.isArray(input)) return [];

  const used = new Set<string>();
  const result: ProductColorOption[] = [];

  for (const raw of input) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;

    const row = raw as Record<string, unknown>;
    const name = String(row.name || "").trim();
    const imageUrl = String(row.imageUrl || row.url || "").trim();
    const includeInGallery =
      typeof row.includeInGallery === "undefined"
        ? true
        : Boolean(row.includeInGallery);
    const source =
      String(row.source || "").trim().toLowerCase() === "custom" ? "custom" : "preset";

    if (!name || !imageUrl) continue;

    const id = String(row.id || "").trim() || createColorOptionId(name);
    const uniqueKey = `${id}::${imageUrl}`.toLowerCase();
    if (used.has(uniqueKey)) continue;
    used.add(uniqueKey);

    result.push({
      id,
      name,
      imageUrl,
      includeInGallery,
      source,
    });
  }

  return result;
}

export function parseProductColorOptionsJson(value: unknown): ProductColorOption[] {
  if (!value) return [];

  try {
    return normalizeProductColorOptions(JSON.parse(String(value)));
  } catch {
    return [];
  }
}

export function serializeProductColorOptions(value: unknown) {
  const normalized = normalizeProductColorOptions(value);
  return normalized.length ? JSON.stringify(normalized) : null;
}

export function mergeProductImagesWithColorOptions(
  images: ProductImageInput[],
  colorOptions: ProductColorOption[],
  fallbackAlt: string,
) {
  const merged: Array<{ url: string; alt: string | null; sortOrder: number }> = [];
  const seen = new Set<string>();

  for (const image of images || []) {
    const url = String(image?.url || "").trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    merged.push({
      url,
      alt: image?.alt ? String(image.alt) : fallbackAlt,
      sortOrder: Number(image?.sortOrder ?? merged.length),
    });
  }

  for (const option of colorOptions) {
    if (!option.includeInGallery) continue;
    const url = String(option.imageUrl || "").trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    merged.push({
      url,
      alt: `${fallbackAlt} - ${option.name}`,
      sortOrder: merged.length,
    });
  }

  return merged;
}
