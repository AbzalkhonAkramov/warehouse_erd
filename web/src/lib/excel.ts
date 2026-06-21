// Lightweight, dependency-free Excel export: builds an HTML table and downloads
// it as an .xls file, which Excel opens as a spreadsheet (UTF-8 BOM keeps Cyrillic).

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function exportExcel(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
): void {
  const thead = `<tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr>`;
  const tbody = rows
    .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
    .join("");
  const html =
    `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head>` +
    `<meta charset="utf-8"></head><body><table border="1">${thead}${tbody}</table></body></html>`;

  const blob = new Blob(["﻿" + html], { type: "application/vnd.ms-excel" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".xls") ? filename : `${filename}.xls`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
