import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { isAdminSession } from "@/lib/adminAuth";
import { validateCsrfRequest } from "@/lib/csrf";

export const runtime = "nodejs";

const MAX_SIZE_BYTES = 3 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function detectImageExtension(buffer: Buffer) {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "jpg";
  }

  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (buffer.length >= 8 && pngSignature.every((value, index) => buffer[index] === value)) {
    return "png";
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }

  return null;
}

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

    const uploadDir = path.join(process.cwd(), "public", "uploads", "products");

    await fs.mkdir(uploadDir, { recursive: true });
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const detectedExt = detectImageExtension(buffer);

    if (!detectedExt) {
      return NextResponse.json(
        { ok: false, error: "Conteudo de imagem invalido." },
        { status: 400 },
      );
    }

    const expectedExt =
      file.type === "image/jpeg"
        ? "jpg"
        : file.type === "image/png"
          ? "png"
          : "webp";

    if (detectedExt !== expectedExt) {
      return NextResponse.json(
        { ok: false, error: "Tipo do arquivo nao confere com o conteudo enviado." },
        { status: 400 },
      );
    }

    const filename = `${crypto.randomUUID()}.${detectedExt}`;
    await fs.writeFile(path.join(uploadDir, filename), buffer);

    return NextResponse.json({
      ok: true,
      url: `/uploads/products/${filename}`,
    });
  } catch (error) {
    console.error("[upload] error", error instanceof Error ? error.message : error);
    return NextResponse.json(
      { ok: false, error: "Falha no upload." },
      { status: 500 },
    );
  }
}
