import type { Response, NextFunction } from "express";

import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { z } from "zod";

import type { AuthRequest } from "../../middlewares/auth.middleware.js";

import { EmployeeServiceError } from "./employees.service.js";

import { employeeExportQuerySchema, jakartaToday } from "./employees-query.js";

import { getEmployeesForExport, type ExportEmployeeRow } from "./employees-export.service.js";

function safeCell(value: string | null): string {
  if (!value) return "-";

  return /^\s*[=+\-@]/.test(value) ? `'${value}` : value;
}

function formatDate(value: Date | string): string {
  const text = value instanceof Date ? [value.getFullYear(), String(value.getMonth() + 1).padStart(2, "0"), String(value.getDate()).padStart(2, "0")].join("-") : String(value).slice(0, 10);

  const [year, month, day] = text.split("-");
  return `${day}/${month}/${year}`;
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

function handleError(error: unknown, res: Response, next: NextFunction): void {
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

    const sheet = workbook.addWorksheet("Data Pegawai");

    sheet.columns = [
      { header: "No", key: "no", width: 8 },
      { header: "NIP", key: "nip", width: 22 },
      { header: "Nama Pegawai", key: "nama", width: 30 },
      { header: "Email", key: "email", width: 32 },
      { header: "Nomor HP", key: "phone", width: 22 },
      { header: "Jabatan", key: "jabatan", width: 22 },
      { header: "Departemen", key: "departemen", width: 22 },
      { header: "Kecamatan", key: "kecamatan", width: 24 },
      { header: "Kabupaten", key: "kabupaten", width: 24 },
      { header: "Provinsi", key: "provinsi", width: 24 },
      { header: "Tanggal Masuk", key: "tanggal", width: 18 },
      { header: "Masa Kerja (Tahun)", key: "masa", width: 20 },
      { header: "Status", key: "status", width: 16 },
      { header: "Status Kontrak", key: "kontrak", width: 18 },
    ];

    employees.forEach((employee, index) => {
      sheet.addRow({
        no: index + 1,
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
        masa: employee.masa_kerja,
        status: safeCell(employee.status),
        kontrak: safeCell(employee.status_kontrak),
      });
    });

    const header = sheet.getRow(1);

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
      wrapText: true,
    };

    header.height = 30;

    sheet.autoFilter = {
      from: "A1",
      to: "N1",
    };

    sheet.views = [{ state: "frozen", ySplit: 1 }];

    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    res.setHeader("Content-Disposition", 'attachment; filename="data-pegawai.xlsx"');

    res.setHeader("Cache-Control", "no-store");
    res.status(200).send(Buffer.from(buffer));
  } catch (error) {
    handleError(error, res, next);
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

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    try {
      doc.font("Helvetica-Bold").fontSize(16);
      doc.text("Laporan Data Pegawai");

      doc.moveDown(0.4);
      doc.font("Helvetica").fontSize(9);
      doc.text(`Total pegawai: ${employees.length}`);
      doc.text(`Tanggal export: ${formatDate(jakartaToday())}`);
      doc.moveDown();

      const columns = [
        { title: "No", width: 30 },
        { title: "NIP", width: 105 },
        { title: "Nama", width: 170 },
        { title: "Jabatan", width: 110 },
        { title: "Tanggal Masuk", width: 90 },
        { title: "Masa Kerja", width: 80 },
        { title: "Kontrak", width: 75 },
        { title: "Status", width: 70 },
      ];

      const contentWidth = doc.page.width - 70;
      const bottom = doc.page.height - 40;

      function header(y: number): number {
        let x = 35;

        doc.font("Helvetica-Bold").fontSize(8);

        for (const column of columns) {
          doc.text(column.title, x, y, {
            width: column.width - 5,
            lineBreak: false,
          });
          x += column.width;
        }

        doc
          .moveTo(35, y + 16)
          .lineTo(35 + contentWidth, y + 16)
          .stroke();

        return y + 24;
      }

      let y = header(doc.y);

      employees.forEach((employee, index) => {
        const values = [
          String(index + 1),
          employee.nip,
          employee.nama_pegawai,
          employee.nama_jabatan || "-",
          formatDate(employee.tanggal_masuk),
          `${employee.masa_kerja} tahun`,
          employee.status_kontrak || "-",
          employee.status,
        ];

        doc.font("Helvetica").fontSize(8);

        const rowHeight = Math.max(
          24,
          ...values.map(
            (value, columnIndex) =>
              doc.heightOfString(value, {
                width: columns[columnIndex]!.width - 8,
              }) + 10,
          ),
        );

        if (y + rowHeight > bottom) {
          doc.addPage();
          y = header(40);
          doc.font("Helvetica").fontSize(8);
        }

        let x = 35;

        columns.forEach((column, columnIndex) => {
          doc.text(values[columnIndex] || "-", x, y, {
            width: column.width - 8,
          });
          x += column.width;
        });

        y += rowHeight;
      });

      if (!employees.length) {
        doc.font("Helvetica").fontSize(10);
        doc.text("Tidak ada data sesuai filter.", 35, y);
      }

      doc.end();
    } catch (error) {
      doc.destroy();
      reject(error);
    }
  });
}

export async function exportEmployeesPdf(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = validateQuery(req, res);
    if (!query) return;

    const employees = await getEmployeesForExport(query);

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
    handleError(error, res, next);
  }
}
