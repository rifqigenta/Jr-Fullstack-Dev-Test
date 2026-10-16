import { fileTypeFromBuffer } from "file-type";

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function validateImageBuffer(buffer: Buffer): Promise<boolean> {
  const detected = await fileTypeFromBuffer(buffer);

  if (!detected) {
    return false;
  }

  return ALLOWED_MIME_TYPES.has(detected.mime);
}
