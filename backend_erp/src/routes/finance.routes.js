import { getFinanceSourcePreview } from '../services/d365/finance.repository.js';
import { toFinancePreviewPayload } from '../domain/transformers/finance.transformer.js';
import { buildTableSummary, collectColumns } from './table-summary.js';

const FINANCE_CACHE_TTL_MS = 60_000;

const financeCache = new Map();
const financeInFlight = new Map();

function parseSelectedYear(url) {
  const rawYear = url.searchParams.get('year');
  const parsedYear = Number.parseInt(rawYear || '', 10);
  return Number.isFinite(parsedYear) ? parsedYear : null;
}

function parseLimit(url) {
  const parsed = Number.parseInt(url.searchParams.get('limit') || '50', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 50;
  }

  return Math.min(parsed, 200);
}

function buildFinanceTableResponse(payload, limit) {
  const data = payload.data || {};
  const tableDefinitions = [
    {
      key: 'budget_plan_headers',
      label: 'BudgetPlanningEntries -> budget_plan_headers',
      rows: data.budget_plan_headers || [],
    },
    {
      key: 'budget_plan_lines',
      label: 'KREBudgetPlanningEntriesLines -> budget_plan_lines',
      rows: data.budget_plan_lines || [],
    },
    {
      key: 'ledger_activities',
      label: 'GeneralLedgerActivities -> ledger_activities',
      rows: data.ledger_activities || [],
    },
  ];

  return {
    domain: 'finance',
    slicer: payload.slicer,
    warnings: payload.warnings || [],
    source_metadata: payload.source_metadata || {},
    tables: tableDefinitions.map((table) => ({
      key: table.key,
      label: table.label,
      total_rows: table.rows.length,
      columns: collectColumns(table.rows),
      summary: buildTableSummary(table.rows, limit),
      rows: table.rows.slice(0, limit),
    })),
  };
}

async function getFinancePayload(selectedYear = null) {
  const cacheKey = String(selectedYear || 'default');
  const cached = financeCache.get(cacheKey);

  if (cached?.payload && cached.expiresAt > Date.now()) {
    return cached.payload;
  }

  const pending = financeInFlight.get(cacheKey);
  if (pending) {
    return pending;
  }

  const payloadPromise = (async () => {
    try {
      const sourcePreview = await getFinanceSourcePreview(selectedYear);
      const payload = toFinancePreviewPayload(sourcePreview, { selectedYear });

      financeCache.set(cacheKey, {
        payload,
        expiresAt: Date.now() + FINANCE_CACHE_TTL_MS,
      });

      return payload;
    } finally {
      financeInFlight.delete(cacheKey);
    }
  })();

  financeInFlight.set(cacheKey, payloadPromise);
  return payloadPromise;
}

export const financeRoutes = [
  {
    method: 'GET',
    path: '/api/erp/finance/normalized',
    handler: async ({ url }) => {
      return getFinancePayload(parseSelectedYear(url));
    },
  },
  {
    method: 'GET',
    path: '/api/finance-data',
    handler: async ({ url }) => {
      const payload = await getFinancePayload(parseSelectedYear(url));
      return {
        ...payload.data.dashboard_contract,
        slicer: payload.slicer,
      };
    },
  },
  {
    method: 'GET',
    path: '/api/finance-data-department',
    handler: async ({ url }) => {
      const payload = await getFinancePayload(parseSelectedYear(url));
      const dashboardContract = payload.data.dashboard_contract || {};
      const overallDepartments =
        dashboardContract.grouped?.OVERALL?.length > 0
          ? dashboardContract.grouped.OVERALL
          : dashboardContract.departments || [];

      return {
        overall_departments: overallDepartments,
        slicer: payload.slicer,
      };
    },
  },
  {
    method: 'GET',
    path: '/api/erp/finance/tables',
    handler: async ({ url }) => {
      const payload = await getFinancePayload(parseSelectedYear(url));
      return buildFinanceTableResponse(payload, parseLimit(url));
    },
  },
];
