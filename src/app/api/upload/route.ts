import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { isAdminSession } from "@/lib/adminAuth";
import { validateCsrfRequest } from "@/lib/csrf";

export const runtime = "nodejs";

const MAX_SIZE_BYTES = 3 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(req: Request) {
  const csrfError = validateCsrfRequest(req);
  if (csrfError) {
    return csrfError;
  }

  if (!(await isAdminSession())) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "Arquivo ausente (campo 'file')." },
        { status: 400 },
      );
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { ok: false, error: "Tipo invalido. Use JPG, PNG ou WEBP." },
        { status: 400 },
      );
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { ok: false, error: "Arquivo muito grande (max 3MB)." },
        { status: 400 },
      );
    }

    const ext =
      file.type === "image/jpeg"
        ? "jpg"
        : file.type === "image/png"
          ? "png"
          : "webp";

    const filename = `${crypto.randomUUID()}.${ext}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads", "products");

    await fs.mkdir(uploadDir, { recursive: true });
    const bytes = await file.arrayBuffer();
    await fs.writeFile(path.join(uploadDir, filename), Buffer.from(bytes));

    return NextResponse.json({
      ok: true,
      url: `/uploads/products/${filename}`,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { ok: false, error: "Falha no upload." },
      { status: 500 },
    );
  }
}
