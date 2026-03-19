import crypto from "crypto";

export function secureCompareText(left: string, right: string) {
  const normalizedLeft = String(left || "");
  const normalizedRight = String(right || "");

  const leftBuffer = Buffer.from(normalizedLeft);
  const rightBuffer = Buffer.from(normalizedRight);

  if (!leftBuffer.length || leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}
