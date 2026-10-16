import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";

import { pool } from "../../config/database.js";
import { cloudinary } from "../../config/cloudinary.js";

import { EmployeeServiceError } from "./employees.service.js";

type PhotoRow = {
  id: number;
  foto_pegawai: string | null;
};

type UploadResult = {
  secure_url: string;
  public_id: string;
};

function uploadToCloudinary(buffer: Buffer, publicId: string): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "jmc/employees",
        public_id: publicId,
        overwrite: false,
        resource_type: "image",
        transformation: [
          {
            width: 800,
            height: 800,
            crop: "limit",
            quality: "auto",
            fetch_format: "auto",
          },
        ],
      },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error("Upload foto gagal."));
          return;
        }

        resolve({
          secure_url: result.secure_url,
          public_id: result.public_id,
        });
      },
    );

    Readable.from(buffer).pipe(stream);
  });
}

function getCloudinaryPublicId(url: string | null): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);

    const expectedHost = `res.cloudinary.com`;

    if (parsed.hostname !== expectedHost) {
      return null;
    }

    const match = parsed.pathname.match(/\/image\/upload\/(?:v\d+\/)?(.+)\.[a-zA-Z0-9]+$/);

    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

async function deleteCloudinaryPhoto(url: string | null): Promise<void> {
  const publicId = getCloudinaryPublicId(url);

  if (!publicId || !publicId.startsWith("jmc/employees/")) {
    return;
  }

  await cloudinary.uploader.destroy(publicId, {
    resource_type: "image",
    invalidate: true,
  });
}

export async function saveEmployeePhoto(employeeId: number, buffer: Buffer, actorId: number) {
  const connection = await pool.getConnection();

  let newPhoto: UploadResult | null = null;
  let oldPhotoUrl: string | null = null;
  let committed = false;

  try {
    await connection.beginTransaction();

    const rows = await connection.query<PhotoRow[]>(
      `
      SELECT id, foto_pegawai
      FROM pegawai
      WHERE id = ?
        AND deleted_at IS NULL
      FOR UPDATE
      `,
      [employeeId],
    );

    const employee = rows[0];

    if (!employee) {
      throw new EmployeeServiceError("Pegawai tidak ditemukan.", 404);
    }

    oldPhotoUrl = employee.foto_pegawai;

    newPhoto = await uploadToCloudinary(buffer, `${employeeId}-${randomUUID()}`);

    await connection.query(
      `
      UPDATE pegawai
      SET foto_pegawai = ?,
          updated_at = CURRENT_TIMESTAMP()
      WHERE id = ?
      `,
      [newPhoto.secure_url, employeeId],
    );

    await connection.query(
      `
      INSERT INTO activities (
        title,
        content,
        created_by
      )
      VALUES (?, ?, ?)
      `,
      ["UPLOAD_EMPLOYEE_PHOTO", `Upload foto pegawai ID ${employeeId}`, actorId],
    );

    await connection.commit();
    committed = true;

    // Hapus foto lama setelah database berhasil commit.
    // Jika cleanup gagal, URL baru tetap aman tersimpan.
    try {
      await deleteCloudinaryPhoto(oldPhotoUrl);
    } catch (error) {
      console.error("Gagal menghapus foto lama:", error);
    }

    return {
      id: employeeId,
      foto_pegawai: newPhoto.secure_url,
    };
  } catch (error) {
    if (!committed) {
      await connection.rollback();

      // Jika upload berhasil tetapi transaksi DB gagal,
      // bersihkan foto baru agar tidak menjadi orphan.
      if (newPhoto) {
        try {
          await cloudinary.uploader.destroy(newPhoto.public_id);
        } catch (cleanupError) {
          console.error("Gagal membersihkan foto upload:", cleanupError);
        }
      }
    }

    throw error;
  } finally {
    connection.release();
  }
}

export async function removeEmployeePhoto(employeeId: number, actorId: number) {
  const connection = await pool.getConnection();

  let oldPhotoUrl: string | null = null;
  let committed = false;

  try {
    await connection.beginTransaction();

    const rows = await connection.query<PhotoRow[]>(
      `
      SELECT id, foto_pegawai
      FROM pegawai
      WHERE id = ?
        AND deleted_at IS NULL
      FOR UPDATE
      `,
      [employeeId],
    );

    const employee = rows[0];

    if (!employee) {
      throw new EmployeeServiceError("Pegawai tidak ditemukan.", 404);
    }

    if (!employee.foto_pegawai) {
      throw new EmployeeServiceError("Pegawai belum memiliki foto.", 404);
    }

    oldPhotoUrl = employee.foto_pegawai;

    await connection.query(
      `
      UPDATE pegawai
      SET foto_pegawai = NULL,
          updated_at = CURRENT_TIMESTAMP()
      WHERE id = ?
      `,
      [employeeId],
    );

    await connection.query(
      `
      INSERT INTO activities (
        title,
        content,
        created_by
      )
      VALUES (?, ?, ?)
      `,
      ["DELETE_EMPLOYEE_PHOTO", `Menghapus foto pegawai ID ${employeeId}`, actorId],
    );

    await connection.commit();
    committed = true;

    try {
      await deleteCloudinaryPhoto(oldPhotoUrl);
    } catch (error) {
      console.error("Gagal menghapus foto Cloudinary:", error);
    }

    return {
      id: employeeId,
      foto_pegawai: null,
    };
  } catch (error) {
    if (!committed) {
      await connection.rollback();
    }

    throw error;
  } finally {
    connection.release();
  }
}
