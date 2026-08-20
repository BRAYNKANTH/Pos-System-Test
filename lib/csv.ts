// Minimal RFC4180-ish CSV parser — no external dependency for a feature
// used in exactly one place (bulk sales import). Handles quoted fields
// (with embedded commas, quotes via `""`, and embedded newlines), bare
// unquoted fields, and both \n and \r\n line endings. Not a full spec
// implementation (no support for e.g. non-comma delimiters), but covers
// what a spreadsheet export (Excel/Google Sheets/LibreOffice) produces.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const len = text.length;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  while (i < len) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      pushField();
      i++;
      continue;
    }
    if (ch === "\r") {
      i++;
      continue;
    }
    if (ch === "\n") {
      pushRow();
      i++;
      continue;
    }
    field += ch;
    i++;
  }

  // Last field/row (file may or may not end with a trailing newline)
  if (field.length > 0 || row.length > 0) {
    pushRow();
  }

  // Drop fully-empty trailing rows (common with a trailing blank line)
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

/** Parses a CSV with a header row into an array of plain objects keyed by
 * (trimmed, lowercased) header name. */
export function parseCsvToObjects(text: string): Record<string, string>[] {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = (r[idx] ?? "").trim();
    });
    return obj;
  });
}
