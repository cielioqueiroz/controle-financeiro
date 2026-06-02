import { todayISO } from "./format.js";

const COLS = ["id", "desc", "amount", "type", "category", "date", "createdAt"];

function download(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function csvCell(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function exportJSON(items) {
  download(`controle-financeiro-${todayISO()}.json`, JSON.stringify(items, null, 2), "application/json");
}

export function exportCSV(items) {
  const rows = [COLS.join(",")];
  for (const t of items) rows.push(COLS.map((c) => csvCell(t[c])).join(","));
  download(`controle-financeiro-${todayISO()}.csv`, rows.join("\n"), "text/csv");
}

export async function parseImport(file) {
  const text = await file.text();
  if (file.name.toLowerCase().endsWith(".csv")) return parseCSV(text);
  const data = JSON.parse(text);
  if (!Array.isArray(data)) throw new Error("JSON não é uma lista de lançamentos.");
  return data;
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = splitCSVLine(lines.shift());
  return lines.filter(Boolean).map((line) => {
    const cells = splitCSVLine(line);
    const obj = {};
    header.forEach((h, i) => (obj[h] = cells[i]));
    obj.amount = Number(obj.amount);
    obj.createdAt = Number(obj.createdAt) || Date.now();
    return obj;
  });
}

function splitCSVLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQ = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQ = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}
