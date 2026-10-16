import type { Response, NextFunction } from "express";

import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { z } from "zod";

import type { AuthRequest } from "../../middlewares/auth.middleware.js";

import { EmployeeServiceError } from "./employees.service.js";

import { employeeExportQuerySchema } from "./employees-bulk.schema.js";

import { getEmployeesForExport, type ExportEmployeeRow } from "./employees-export.service.js";

function safeCell(value: string | null): string {
  if (!value) return "-";

  // Cegah input teks dieksekusi sebagai formula spreadsheet.
  return /^[\s]*[=+\-@]/.test(value) ? `'${value}` : value;
}

function formatDate(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value).slice(0, 10);
}

function validateQuery(req: AuthRequest, res: Response) {
  const parsed = employeeExportQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Filter export tidak valid.",
      errors: z.flattenError(parsed.error),
    });

    return null;
  }

  return parsed.data;
}

function handleExportError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof EmployeeServiceError) {
    res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
    return;
  }

  next(error);
}

export async function exportEmployeesExcel(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = validateQuery(req, res);
    if (!query) return;

    const employees = await getEmployeesForExport(query);

    const workbook = new ExcelJS.Workbook();

    workbook.creator = "JMC Kepegawaian";

    const worksheet = workbook.addWorksheet("Data Pegawai");

    worksheet.columns = [
      { header: "NIP", key: "nip", width: 18 },
      { header: "Nama Pegawai", key: "nama", width: 28 },
      { header: "Email", key: "email", width: 32 },
      { header: "Nomor HP", key: "phone", width: 20 },
      { header: "Jabatan", key: "jabatan", width: 24 },
      { header: "Departemen", key: "departemen", width: 24 },
      { header: "Kecamatan", key: "kecamatan", width: 24 },
      { header: "Kabupaten", key: "kabupaten", width: 24 },
      { header: "Provinsi", key: "provinsi", width: 24 },
      { header: "Tanggal Masuk", key: "tanggal", width: 18 },
      { header: "Status", key: "status", width: 15 },
      { header: "Status Kontrak", key: "kontrak", width: 18 },
    ];

    for (const employee of employees) {
      worksheet.addRow({
        nip: safeCell(employee.nip),
        nama: safeCell(employee.nama_pegawai),
        email: safeCell(employee.email),
        phone: safeCell(employee.nomor_hp),
        jabatan: safeCell(employee.nama_jabatan),
        departemen: safeCell(employee.nama_departemen),
        kecamatan: safeCell(employee.kecamatan),
        kabupaten: safeCell(employee.kabupaten),
        provinsi: safeCell(employee.provinsi),
        tanggal: formatDate(employee.tanggal_masuk),
        status: employee.status,
        kontrak: employee.status_kontrak ?? "-",
      });
    }

    const header = worksheet.getRow(1);

    header.font = {
      bold: true,
      color: { argb: "FFFFFFFF" },
    };

    header.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1F4E78" },
    };

    header.alignment = {
      vertical: "middle",
    };

    header.height = 24;

    worksheet.autoFilter = {
      from: "A1",
      to: "L1",
    };

    worksheet.views = [{ state: "frozen", ySplit: 1 }];

    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    res.setHeader("Content-Disposition", 'attachment; filename="data-pegawai.xlsx"');

    res.setHeader("Cache-Control", "no-store");

    res.status(200).send(Buffer.from(buffer));
  } catch (error) {
    handleExportError(error, res, next);
  }
}

function createPdfBuffer(employees: ExportEmployeeRow[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margin: 35,
    });

    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    doc.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    doc.on("error", reject);

    doc.fontSize(16).font("Helvetica-Bold");
    doc.text("Laporan Data Pegawai JMC");

    doc.moveDown(0.4);

    doc.fontSize(9).font("Helvetica");
    doc.text(`Total pegawai: ${employees.length}`);
    doc.text(`Tanggal export: ${new Date().toISOString().slice(0, 10)}`);

    doc.moveDown();

    const columns = [
      { title: "NIP", x: 35, width: 85 },
      { title: "Nama", x: 125, width: 155 },
      { title: "Jabatan", x: 285, width: 125 },
      { title: "Departemen", x: 415, width: 125 },
      { title: "Masuk", x: 545, width: 85 },
      { title: "Kontrak", x: 635, width: 80 },
      { title: "Status", x: 720, width: 75 },
    ];

    const rowHeight = 24;
    const pageBottom = doc.page.height - 45;

    function drawHeader(y: number): number {
      doc.font("Helvetica-Bold").fontSize(8);

      for (const column of columns) {
        doc.text(column.title, column.x, y, {
          width: column.width,
          lineBreak: false,
        });
      }

      doc
        .moveTo(35, y + 17)
        .lineTo(800, y + 17)
        .stroke();

      return y + 24;
    }

    let y = drawHeader(doc.y);

    for (const employee of employees) {
      if (y + rowHeight > pageBottom) {
        doc.addPage();
        y = drawHeader(40);
      }

      const values = [
        employee.nip,
        employee.nama_pegawai,
        employee.nama_jabatan ?? "-",
        employee.nama_departemen ?? "-",
        formatDate(employee.tanggal_masuk),
        employee.status_kontrak ?? "-",
        employee.status,
      ];

      doc.font("Helvetica").fontSize(8);

      columns.forEach((column, index) => {
        doc.text(values[index] ?? "-", column.x, y, {
          width: column.width - 5,
          height: rowHeight - 4,
          ellipsis: true,
          lineBreak: false,
        });
      });

      y += rowHeight;
    }

    doc.end();
  });
}

export async function exportEmployeesPdf(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = validateQuery(req, res);
    if (!query) return;

    const employees = await getEmployeesForExport(query);

    // PDFKit kita gunakan dengan buffer in-memory.
    // Batasi jumlah baris agar konsumsi memori tetap terkendali.
    if (employees.length > 1000) {
      res.status(400).json({
        success: false,
        message: "Export PDF maksimal 1000 pegawai. Gunakan filter.",
      });
      return;
    }

    const buffer = await createPdfBuffer(employees);

    res.setHeader("Content-Type", "application/pdf");

    res.setHeader("Content-Disposition", 'attachment; filename="data-pegawai.pdf"');

    res.setHeader("Cache-Control", "no-store");

    res.status(200).send(buffer);
  } catch (error) {
    handleExportError(error, res, next);
  }
}
