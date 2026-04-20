const ERP_SOURCE_TABLES = Object.freeze({
  finance: [
    {
      entity: 'BudgetPlanningEntries',
      envPrefix: 'D365_BUDGET_PLANNING_ENTRIES',
      purpose: 'Header proposal dan perencanaan anggaran.',
    },
    {
      entity: 'KREBudgetPlanningEntriesLines',
      envPrefix: 'D365_KRE_BUDGET_PLANNING_ENTRIES_LINES',
      purpose: 'Detail line budget untuk kebutuhan proposal, realokasi, dan breakdown organisasi.',
    },
    {
      entity: 'GeneralLedgerActivities',
      envPrefix: 'D365_GENERAL_LEDGER_ACTIVITIES',
      purpose: 'Aktivitas ledger untuk rasio penyerapan dan realisasi akuntansi.',
    },
  ],
  procurement: [
    {
      entity: 'PurchaseRequisitionHeaders',
      envPrefix: 'D365_PURCHASE_REQUISITION_HEADERS',
      purpose: 'Header PR untuk status dan tanggal permintaan.',
    },
    {
      entity: 'PurchaseRequisitionLinesV2',
      envPrefix: 'D365_PURCHASE_REQUISITION_LINES_V2',
      purpose: 'Line PR untuk nilai, jumlah, dan rincian item.',
    },
    {
      entity: 'ProcurementPlanTables',
      envPrefix: 'D365_PROCUREMENT_PLAN_TABLES',
      purpose: 'Header procurement plan LRTJ.',
    },
    {
      entity: 'ProcurementPlanDetails',
      envPrefix: 'D365_PROCUREMENT_PLAN_DETAILS',
      purpose: 'Detail procurement plan untuk HPS dan komitmen pengadaan.',
    },
  ],
});

function parseCsv(value) {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseInteger(value, fallback = null) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export function getEntityConfig(entityName) {
  const entry = Object.values(ERP_SOURCE_TABLES)
    .flat()
    .find((item) => item.entity === entityName);

  if (!entry) {
    return { select: [], filter: '' };
  }

  return {
    ...entry,
    select: parseCsv(process.env[`${entry.envPrefix}_SELECT`]),
    filter: process.env[`${entry.envPrefix}_FILTER`] || '',
    top: parseInteger(process.env[`${entry.envPrefix}_TOP`], null),
    timeoutMs: parseInteger(process.env[`${entry.envPrefix}_TIMEOUT_MS`], null),
  };
}

export { ERP_SOURCE_TABLES };
