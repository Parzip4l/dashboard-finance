const EXCLUDED_NUMERIC_COLUMNS = [
  /^fiscal_year$/i,
  /^period_month$/i,
  /^line_no$/i,
  /^year$/i,
  /^month$/i,
  /^day$/i,
];

function shouldSkipNumericColumn(column) {
  return EXCLUDED_NUMERIC_COLUMNS.some((pattern) => pattern.test(column));
}

export function collectColumns(rows) {
  const keySet = new Set();

  rows.forEach((row) => {
    Object.keys(row || {}).forEach((key) => keySet.add(key));
  });

  return Array.from(keySet);
}

export function buildTableSummary(rows, limit) {
  const numericStats = new Map();

  rows.forEach((row) => {
    Object.entries(row || {}).forEach(([key, value]) => {
      if (typeof value !== 'number' || !Number.isFinite(value) || shouldSkipNumericColumn(key)) {
        return;
      }

      const existing = numericStats.get(key) || {
        column: key,
        total: 0,
        populated_rows: 0,
      };

      existing.total += value;
      existing.populated_rows += 1;
      numericStats.set(key, existing);
    });
  });

  const numericTotals = Array.from(numericStats.values())
    .filter((item) => item.populated_rows > 0)
    .sort((left, right) => Math.abs(right.total) - Math.abs(left.total))
    .slice(0, 6);

  return {
    source_row_count: rows.length,
    displayed_row_count: Math.min(rows.length, limit),
    column_count: collectColumns(rows).length,
    numeric_totals: numericTotals,
  };
}
