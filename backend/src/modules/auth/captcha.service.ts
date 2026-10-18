import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";

import { deflateSync } from "node:zlib";

import { pool } from "../../config/database.js";
import { env } from "../../config/env.js";

const CAPTCHA_TTL_SECONDS = 120;

const DIGITS: Record<string, string[]> = {
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
  "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
};

function answerHash(id: string, answer: string): string {
  return createHmac("sha256", env.CSRF_SECRET).update(`captcha:${id}:${answer}`).digest("hex");
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc ^= byte;

    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  const checksum = Buffer.alloc(4);

  length.writeUInt32BE(data.length);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));

  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function renderCaptcha(answer: string): Buffer {
  const width = 200;
  const height = 64;
  const pixels = Buffer.alloc(width * height * 3, 245);

  function setPixel(x: number, y: number, red: number, green: number, blue: number) {
    if (x < 0 || y < 0 || x >= width || y >= height) {
      return;
    }

    const offset = (y * width + x) * 3;

    pixels[offset] = red;
    pixels[offset + 1] = green;
    pixels[offset + 2] = blue;
  }

  for (let index = 0; index < 350; index++) {
    setPixel(randomInt(width), randomInt(height), 180, 190, 200);
  }

  [...answer].forEach((digit, index) => {
    const glyph = DIGITS[digit]!;
    const left = 12 + index * 30;
    const top = randomInt(12, 21);
    const scale = 4;

    glyph.forEach((row, rowIndex) => {
      [...row].forEach((pixel, columnIndex) => {
        if (pixel !== "1") return;

        for (let dx = 0; dx < scale; dx++) {
          for (let dy = 0; dy < scale; dy++) {
            setPixel(left + columnIndex * scale + dx, top + rowIndex * scale + dy, 30, 55, 85);
          }
        }
      });
    });
  });

  const header = Buffer.alloc(13);

  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;

  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * (stride + 1);

    raw[rowOffset] = 0;

    pixels.copy(raw, rowOffset + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk("IHDR", header), pngChunk("IDAT", deflateSync(raw)), pngChunk("IEND", Buffer.alloc(0))]);
}

export async function createCaptcha() {
  const id = randomUUID();

  const answer = Array.from({ length: 6 }, () => String(randomInt(10))).join("");

  await pool.query(
    `
      DELETE FROM auth_captchas
      WHERE expires_at <= UTC_TIMESTAMP(3)
      LIMIT 500
    `,
  );

  await pool.query(
    `
      INSERT INTO auth_captchas (
        id,
        answer_hash,
        expires_at
      )
      VALUES (
        ?,
        ?,
        DATE_ADD(
          UTC_TIMESTAMP(3),
          INTERVAL ? SECOND
        )
      )
    `,
    [id, answerHash(id, answer), CAPTCHA_TTL_SECONDS],
  );

  return {
    id,
    image: `data:image/png;base64,${renderCaptcha(answer).toString("base64")}`,
    expiresInSeconds: CAPTCHA_TTL_SECONDS,
  };
}

export async function verifyCaptcha(id: string, answer: string): Promise<boolean> {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const rows = await connection.query<
      Array<{
        answer_hash: string;
        valid: number | bigint;
      }>
    >(
      `
        SELECT
          answer_hash,
          (expires_at > UTC_TIMESTAMP(3)) AS valid
        FROM auth_captchas
        WHERE id = ?
        FOR UPDATE
      `,
      [id],
    );

    await connection.query("DELETE FROM auth_captchas WHERE id = ?", [id]);

    await connection.commit();

    const row = rows[0];

    if (!row || Number(row.valid) !== 1) {
      return false;
    }

    const expected = Buffer.from(row.answer_hash, "hex");

    const actual = Buffer.from(answerHash(id, answer), "hex");

    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
