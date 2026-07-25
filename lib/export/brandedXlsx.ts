import ExcelJS from "exceljs";

const BRAND = "F08A24";

export async function brandedXlsx({
  title, companyName, logo, logoExt, headers, rows, rtl = true,
}: {
  title: string;
  companyName?: string;
  logo?: Buffer | null;
  logoExt?: "png" | "jpeg";
  headers: string[];
  rows: (string | number)[][];
  rtl?: boolean;
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = companyName || "NIQAT CRM";
  wb.created = new Date();
  const ws = wb.addWorksheet("Export", {
    views: [{ rightToLeft: rtl, state: "frozen", ySplit: 4 }],
  });

  const colCount = Math.max(headers.length, 1);
  const lastCol = String.fromCharCode(64 + Math.min(colCount, 26));

  // ===== ترويسة البراند (صفوف 1-3) =====
  ws.mergeCells(`A1:${lastCol}3`);
  const head = ws.getCell("A1");
  head.value = companyName || "NIQAT";
  head.font = { name: "Calibri", size: 20, bold: true, color: { argb: "FF" + BRAND } };
  head.alignment = { vertical: "middle", horizontal: rtl ? "right" : "left", indent: 2 };
  ws.getRow(1).height = 26; ws.getRow(2).height = 26; ws.getRow(3).height = 20;

  // اللوجو (لو موجود) — أعلى الجهة المقابلة
  if (logo && logo.length) {
    try {
      const imgId = wb.addImage({ buffer: logo as any, extension: logoExt || "png" });
      // نضعه في أقصى العمود الأول (يسار في LTR / مننفس المكان بصرياً)
      ws.addImage(imgId, { tl: { col: colCount - 1.9, row: 0.15 }, ext: { width: 120, height: 52 } });
    } catch { /* لو الصورة تعذّرت، نكمّل بدونها */ }
  }

  // سطر العنوان + التاريخ (صف 4)
  ws.mergeCells(`A4:${lastCol}4`);
  const sub = ws.getCell("A4");
  const today = new Date().toISOString().slice(0, 10);
  sub.value = `${title} — ${today}`;
  sub.font = { name: "Calibri", size: 11, italic: true, color: { argb: "FF6B7280" } };
  sub.alignment = { vertical: "middle", horizontal: rtl ? "right" : "left", indent: 2 };
  ws.getRow(4).height = 18;

  // ===== صف رؤوس الأعمدة (صف 5) =====
  const headerRow = ws.getRow(5);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + BRAND } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = { bottom: { style: "thin", color: { argb: "FFEADFD2" } } };
  });
  headerRow.height = 22;
  ws.views = [{ rightToLeft: rtl, state: "frozen", ySplit: 5 }];

  // ===== الصفوف =====
  const widths = headers.map((h) => Math.max(10, Math.min(42, String(h).length + 4)));
  rows.forEach((r, ri) => {
    const row = ws.getRow(6 + ri);
    r.forEach((v, ci) => {
      const cell = row.getCell(ci + 1);
      cell.value = (v === null || v === undefined) ? "" : v;
      cell.alignment = { vertical: "middle", horizontal: typeof v === "number" ? "left" : (rtl ? "right" : "left") };
      cell.font = { size: 10.5 };
      const len = String(v ?? "").length;
      if (len + 2 > widths[ci]) widths[ci] = Math.min(50, len + 2);
    });
    if (ri % 2 === 1) {
      for (let ci = 0; ci < headers.length; ci++) {
        row.getCell(ci + 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFAF7F2" } };
      }
    }
  });
  headers.forEach((_, i) => { ws.getColumn(i + 1).width = widths[i]; });

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}
