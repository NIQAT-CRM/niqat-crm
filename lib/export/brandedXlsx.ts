import ExcelJS from "exceljs";

const BRAND = "F08A24";

export async function brandedXlsx({
  title, companyName, logo, logoExt, headers, rows, rtl = false,
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
  const ws = wb.addWorksheet("Export", { views: [{ rightToLeft: rtl }] });

  const colCount = Math.max(headers.length, 1);
  const lastCol = ws.getColumn(Math.min(colCount, 16384)).letter;

  // ===== ترويسة البراند (صفوف 1-3): لوجو شمال + اسم الشركة يمين =====
  ws.mergeCells(`A1:${lastCol}3`);
  const head = ws.getCell("A1");
  head.value = companyName || "NIQAT";
  head.font = { name: "Calibri", size: 20, bold: true, color: { argb: "FF" + BRAND } };
  head.alignment = { vertical: "middle", horizontal: "right", indent: 1 };
  ws.getRow(1).height = 24; ws.getRow(2).height = 24; ws.getRow(3).height = 20;

  if (logo && logo.length) {
    try {
      const imgId = wb.addImage({ buffer: logo as any, extension: logoExt || "png" });
      ws.addImage(imgId, { tl: { col: 0.15, row: 0.2 }, ext: { width: 130, height: 54 } });
    } catch { /* بدون لوجو لو تعذّر */ }
  }

  // سطر العنوان + التاريخ (صف 4)
  ws.mergeCells(`A4:${lastCol}4`);
  const sub = ws.getCell("A4");
  sub.value = `${title} — ${new Date().toISOString().slice(0, 10)}`;
  sub.font = { name: "Calibri", size: 11, italic: true, color: { argb: "FF6B7280" } };
  sub.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(4).height = 18;

  // ===== رؤوس الأعمدة (صف 5) — أفقية نضيفة =====
  const headerRow = ws.getRow(5);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + BRAND } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: false };
    cell.border = { bottom: { style: "thin", color: { argb: "FFEADFD2" } } };
  });
  headerRow.height = 20;

  // عرض الأعمدة: أوسع حاجة بين العنوان والقيم (2..60)
  const widths = headers.map((h) => String(h).length + 3);
  rows.forEach((r) => r.forEach((v, ci) => {
    const len = String(v ?? "").length;
    if (len + 2 > widths[ci]) widths[ci] = len + 2;
  }));
  headers.forEach((_, i) => { ws.getColumn(i + 1).width = Math.max(10, Math.min(60, widths[i])); });

  // ===== الصفوف =====
  rows.forEach((r, ri) => {
    const row = ws.getRow(6 + ri);
    r.forEach((v, ci) => {
      const cell = row.getCell(ci + 1);
      cell.value = (v === null || v === undefined) ? "" : v;
      cell.alignment = { vertical: "middle", horizontal: typeof v === "number" ? "left" : "left" };
      cell.font = { size: 10.5 };
    });
    if (ri % 2 === 1) {
      for (let ci = 0; ci < headers.length; ci++) {
        row.getCell(ci + 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFAF7F2" } };
      }
    }
  });

  // تجميد صف الرؤوس
  ws.views = [{ rightToLeft: rtl, state: "frozen", ySplit: 5 }];

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}
