import { toProcurementPreviewPayload } from '../domain/transformers/procurement.transformer.js';
import { getProcurementSourcePreview } from '../services/d365/procurement.repository.js';
import { buildTableSummary, collectColumns } from './table-summary.js';

const PROCUREMENT_CACHE_TTL_MS = 60_000;

const procurementCache = new Map();
const procurementInFlight = new Map();

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

function buildProcurementTableResponse(payload, limit) {
  const data = payload.data || {};
  const tableDefinitions = [
    {
      key: 'pr_headers',
      label: 'PurchaseRequisitionHeaders -> pr_headers',
      rows: data.pr_headers || [],
    },
    {
      key: 'pr_lines',
      label: 'PurchaseRequisitionLinesV2 -> pr_lines',
      rows: data.pr_lines || [],
    },
    {
      key: 'procurement_plan_tables',
      label: 'ProcurementPlanTables -> procurement_plan_tables',
      rows: data.procurement_plan_tables || [],
    },
    {
      key: 'procurement_plan_details',
      label: 'ProcurementPlanDetails -> procurement_plan_details',
      rows: data.procurement_plan_details || [],
    },
  ];

  return {
    domain: 'procurement',
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

async function getProcurementPayload(selectedYear = null) {
  const cacheKey = String(selectedYear || 'default');
  const cached = procurementCache.get(cacheKey);

  if (cached?.payload && cached.expiresAt > Date.now()) {
    return cached.payload;
  }

  const pending = procurementInFlight.get(cacheKey);
  if (pending) {
    return pending;
  }

  const payloadPromise = (async () => {
    try {
      const sourcePreview = await getProcurementSourcePreview(selectedYear);
      const payload = toProcurementPreviewPayload(sourcePreview, { selectedYear });

      procurementCache.set(cacheKey, {
        payload,
        expiresAt: Date.now() + PROCUREMENT_CACHE_TTL_MS,
      });

      return payload;
    } finally {
      procurementInFlight.delete(cacheKey);
    }
  })();

  procurementInFlight.set(cacheKey, payloadPromise);
  return payloadPromise;
}

export const procurementRoutes = [
  {
    method: 'GET',
    path: '/api/erp/procurement/normalized',
    handler: async ({ url }) => {
      return getProcurementPayload(parseSelectedYear(url));
    },
  },
  {
    method: 'GET',
    path: '/api/procurement-data',
    handler: async ({ url }) => {
      const payload = await getProcurementPayload(parseSelectedYear(url));
      const dashboardContract = payload.data.dashboard_contract || {};

      return {
        dashboardData: dashboardContract.dashboardData || {},
        divisionalProcurementData: dashboardContract.divisionalProcurementData || { data: [] },
        procurementStatusData: dashboardContract.procurementStatusData || {
          pengadaan_status: { total: {}, divisi: [] },
        },
        slicer: payload.slicer,
      };
    },
  },
  {
    method: 'GET',
    path: '/api/procurement/summary',
    handler: async ({ url }) => {
      const payload = await getProcurementPayload(parseSelectedYear(url));
      return {
        ...(payload.data.dashboard_contract?.dashboardData?.summary_box || {}),
        slicer: payload.slicer,
      };
    },
  },
  {
    method: 'GET',
    path: '/api/procurement/on-process',
    handler: async ({ url }) => {
      const payload = await getProcurementPayload(parseSelectedYear(url));
      return {
        ...(payload.data.dashboard_contract?.procurementStatusData || {
          pengadaan_status: { total: {}, divisi: [] },
        }),
        slicer: payload.slicer,
      };
    },
  },
  {
    method: 'GET',
    path: '/api/erp/procurement/tables',
    handler: async ({ url }) => {
      const payload = await getProcurementPayload(parseSelectedYear(url));
      return buildProcurementTableResponse(payload, parseLimit(url));
    },
  },
];
