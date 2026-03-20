import fs from "fs";
import path from "path";
import { CATEGORY_NAME_BY_ID } from "@/lib/catalog";

const CATEGORY_IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"];

export function getCategoryShowcaseImage(categoryId: string) {
  const safeCategoryId = String(categoryId || "").trim();
  const publicRoot = path.join(process.cwd(), "public", "category-showcase");

  for (const extension of CATEGORY_IMAGE_EXTENSIONS) {
    const filename = `${safeCategoryId}${extension}`;
    const absolutePath = path.join(publicRoot, filename);
    if (fs.existsSync(absolutePath)) {
      return `/category-showcase/${filename}`;
    }
  }

  const categoryName = CATEGORY_NAME_BY_ID[safeCategoryId] ?? safeCategoryId;
  return `/api/category-placeholder?category=${encodeURIComponent(safeCategoryId)}&label=${encodeURIComponent(categoryName)}`;
}
