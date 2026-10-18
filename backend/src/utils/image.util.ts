import { fileTypeFromBuffer } from "file-type";

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png"]);

export async function validateImageBuffer(buffer: Buffer): Promise<boolean> {
  if (buffer.length === 0) {
    return false;
  }

  try {
    const detected = await fileTypeFromBuffer(buffer);

    return detected !== undefined && ALLOWED_MIME_TYPES.has(detected.mime);
  } catch (error) {
    return false;
  }
}
