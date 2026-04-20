function collectKeys(records) {
  const keySet = new Set();

  for (const record of records) {
    Object.keys(record || {}).forEach((key) => keySet.add(key));
  }

  return Array.from(keySet).sort();
}

function countNonNullValues(records, limit = 25) {
  const counts = new Map();

  for (const record of records) {
    for (const [key, value] of Object.entries(record || {})) {
      if (value !== null && value !== undefined && value !== '') {
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, non_null_count]) => ({ key, non_null_count }));
}

function sampleRecords(records, limit = 2) {
  return records.slice(0, limit);
}

export function buildRawPreviewSummary(sourcePreview, domain) {
  const entities = Object.entries(sourcePreview).map(([entityName, preview]) => ({
    entity: entityName,
    mode: preview.mode,
    count: preview.count,
    selected_fields: preview.selectedFields || [],
    filter: preview.filter || '',
    has_next_page: Boolean(preview.nextLink),
    error: preview.error || null,
    keys: collectKeys(preview.records),
    non_null_leaders: countNonNullValues(preview.records),
    sample_records: sampleRecords(preview.records),
  }));

  return {
    domain,
    inspected_at: new Date().toISOString(),
    entities,
  };
}
