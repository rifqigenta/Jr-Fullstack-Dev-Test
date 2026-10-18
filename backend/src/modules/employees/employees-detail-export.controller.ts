import type { Response, NextFunction } from "express";

import PDFDocument from "pdfkit";

import type { AuthRequest } from "../../middlewares/auth.middleware.js";

import { getEmployeeById } from "./employees.service.js";

type EmployeeDetail = NonNullable<Awaited<ReturnType<typeof getEmployeeById>>>;

function formatDate(value: string): string {
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

function createDetailPdf(employee: EmployeeDetail): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 45,
    });

    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    try {
      doc.font("Helvetica-Bold").fontSize(18);
      doc.text("Detail Data Pegawai");
      doc.moveDown();

      const fields: Array<[string, string | number | null]> = [
        ["NIP", employee.nip],
        ["Nama Pegawai", employee.nama_pegawai],
        ["Email", employee.email],
        ["Nomor HP", employee.nomor_hp],
        ["Tempat Lahir", employee.tempat_lahir],
        ["Tanggal Lahir", formatDate(employee.tanggal_lahir)],
        ["Usia", `${employee.usia} tahun`],
        ["Jenis Kelamin", employee.jenis_kelamin],
        ["Kecamatan", employee.kecamatan],
        ["Kabupaten", employee.kabupaten],
        ["Provinsi", employee.provinsi],
        ["Alamat Lengkap", employee.alamat_lengkap],
        ["Jarak Rumah - Kantor", `${employee.jarak_rumah_kantor} km`],
        ["Status Kawin", employee.status_kawin],
        ["Jumlah Anak", employee.jumlah_anak],
        ["Tanggal Masuk", formatDate(employee.tanggal_masuk)],
        ["Jabatan", employee.nama_jabatan],
        ["Departemen", employee.nama_departemen],
        ["Status", employee.status],
        ["Status Kontrak", employee.status_kontrak],
      ];

      for (const [label, value] of fields) {
        const text = value === null || value === "" ? "-" : String(value);

        doc.font("Helvetica").fontSize(10);

        const requiredHeight =
          doc.heightOfString(`${label}: ${text}`, {
            width: doc.page.width - 90,
          }) + 8;

        if (doc.y + requiredHeight > doc.page.height - doc.page.margins.bottom) {
          doc.addPage();
        }

        doc.text(`${label}: ${text}`);
        doc.moveDown(0.4);
      }

      if (employee.foto_pegawai) {
        doc.moveDown(0.5);
        doc.text("Foto pegawai", {
          link: employee.foto_pegawai,
          underline: true,
        });
      } else {
        doc.text("Foto pegawai: Belum diunggah");
      }

      if (doc.y > doc.page.height - 130) {
        doc.addPage();
      }

      doc.moveDown();
      doc.font("Helvetica-Bold").fontSize(12);
      doc.text("Riwayat Pendidikan");
      doc.moveDown(0.5);
      doc.font("Helvetica").fontSize(10);

      if (!employee.pendidikan.length) {
        doc.text("Belum ada data pendidikan.");
      }

      employee.pendidikan.forEach((item, index) => {
        const text = `${index + 1}. ${item.tingkat_pendidikan} - ` + `${item.nama_sekolah} (${item.tahun_lulus})`;

        const height = doc.heightOfString(text, {
          width: doc.page.width - 90,
        });

        if (doc.y + height + 10 > doc.page.height - 45) {
          doc.addPage();
        }

        doc.text(text);
        doc.moveDown(0.5);
      });

      doc.end();
    } catch (error) {
      doc.destroy();
      reject(error);
    }
  });
}

export async function exportEmployeeDetailPdf(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const value = req.params.id;

    if (typeof value !== "string" || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
      res.status(400).json({
        success: false,
        message: "ID pegawai tidak valid.",
      });
      return;
    }

    const employee = await getEmployeeById(Number(value));

    if (!employee) {
      res.status(404).json({
        success: false,
        message: "Pegawai tidak ditemukan.",
      });
      return;
    }

    const buffer = await createDetailPdf(employee);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="pegawai-${employee.id}.pdf"`);
    res.setHeader("Cache-Control", "no-store");

    res.status(200).send(buffer);
  } catch (error) {
    next(error);
  }
}
