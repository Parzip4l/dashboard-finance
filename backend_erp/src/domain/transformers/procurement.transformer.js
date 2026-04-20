import {
  CANONICAL_SCHEMA,
  SCHEMA_VERSION,
  createEmptyProcurementDashboardContract,
} from '../../config/canonical-schema.js';
import { inferOrg, pickFirst, toInteger, toIsoDate, toNumber } from './shared.js';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
const MONTHS_FULL = [
  'JANUARI',
  'FEBRUARI',
  'MARET',
  'APRIL',
  'MEI',
  'JUNI',
  'JULI',
  'AGUSTUS',
  'SEPTEMBER',
  'OKTOBER',
  'NOVEMBER',
  'DESEMBER',
];

const PR_FINAL_STATUSES = new Set(['closed', 'cancelled', 'canceled', 'rejected']);
const PR_ACTIVE_STATUSES = new Set([
  'draft',
  'approved',
  'open',
  'submitted',
  'pending',
  'inreview',
  'review',
  'confirmation',
  'confirmed',
  'onprocess',
  'inprocess',
  'processing',
]);

function normalizeStatusKey(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function toTitleCode(value, fallback = 'UNKNOWN') {
  const text = String(value || '').trim();
  return text || fallback;
}

function derivePeriodFromDate(value) {
  const isoDate = toIsoDate(value);
  if (!isoDate) {
    return { fiscalYear: null, periodMonth: null };
  }

  const date = new Date(isoDate);
  return {
    fiscalYear: date.getUTCFullYear(),
    periodMonth: date.getUTCMonth() + 1,
  };
}

function derivePeriodFromProcurementPlanNumber(planNo) {
  const text = String(planNo || '').trim();
  const match = /^PP-(\d{2})(\d{2})-/i.exec(text);

  if (!match) {
    return { fiscalYear: null, periodMonth: null };
  }

  return {
    fiscalYear: 2000 + Number.parseInt(match[1], 10),
    periodMonth: Number.parseInt(match[2], 10),
  };
}

function parseDimensionSegments(value) {
  const text = String(value || '').trim().replace(/,+$/, '');
  if (!text) {
    return [];
  }

  return text
    .split('-')
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function deriveOrgFromBudgetDimension(value) {
  const segments = parseDimensionSegments(value);

  return {
    department_code: segments[1] || null,
    division_code: segments[2] || null,
  };
}

function deriveOrgFromLedgerDimension(value) {
  const text = String(value || '').trim();
  const match = text.match(/([A-Z]{2}\d{2})-([A-Z]{2})-([A-Z]\d{3})-([A-Z]\d{3})/);

  if (!match) {
    return {
      department_code: null,
      division_code: null,
    };
  }

  return {
    department_code: match[1] || null,
    division_code: match[2] || null,
  };
}

function choosePrimaryYear(...recordGroups) {
  const counts = new Map();

  for (const records of recordGroups) {
    for (const record of records) {
      const year = toInteger(record?.fiscal_year, null);
      if (!year) {
        continue;
      }

      counts.set(year, (counts.get(year) || 0) + 1);
    }
  }

  if (counts.size === 0) {
    return null;
  }

  return Array.from(counts.entries()).sort((a, b) => {
    if (b[1] !== a[1]) {
      return b[1] - a[1];
    }

    return b[0] - a[0];
  })[0][0];
}

function getProcurementYearScope(selectedYear = null) {
  const currentYear = new Date().getUTCFullYear();
  const previousYear = currentYear - 1;
  const availableYears = [currentYear, previousYear];

  return {
    availableYears,
    selectedYear: availableYears.includes(selectedYear) ? selectedYear : currentYear,
  };
}

function emptyMonthlyTotal() {
  return { HPS: 0, Komitmen_PO: 0, Total_PR: 0 };
}

function ensureMonthMapEntry(map, key) {
  if (!map.has(key)) {
    map.set(key, Array.from({ length: 12 }, () => ({ hps: 0, komitmen_po: 0, prSet: new Set() })));
  }

  return map.get(key);
}

function buildProcurementDashboardContract(prHeaders, prLines, planDetails, options = {}) {
  const dashboard = createEmptyProcurementDashboardContract();
  const { availableYears, selectedYear } = getProcurementYearScope(options.selectedYear);

  if (!selectedYear) {
    return dashboard;
  }

  const monthlyTotals = Array.from({ length: 12 }, () => ({
    HPS: 0,
    Komitmen_PO: 0,
    prSet: new Set(),
  }));
  const divisionBuckets = new Map();
  const statusBuckets = new Map();

  for (const detail of planDetails) {
    if (detail.fiscal_year !== selectedYear) {
      continue;
    }

    const monthIndex = (detail.period_month || 0) - 1;
    if (monthIndex < 0 || monthIndex > 11) {
      continue;
    }

    monthlyTotals[monthIndex].HPS += toNumber(detail.hps_amount, 0);
    monthlyTotals[monthIndex].Komitmen_PO += toNumber(detail.committed_po_amount, 0);

    const divisionCode = toTitleCode(
      detail.department_code || detail.division_code || detail.company_code,
      'UNKNOWN'
    );
    const bucket = ensureMonthMapEntry(divisionBuckets, divisionCode);
    bucket[monthIndex].hps += toNumber(detail.hps_amount, 0);
    bucket[monthIndex].komitmen_po += toNumber(detail.committed_po_amount, 0);
  }

  for (const header of prHeaders) {
    if (header.fiscal_year !== selectedYear) {
      continue;
    }

    const monthIndex = (header.period_month || 0) - 1;
    if (monthIndex < 0 || monthIndex > 11 || !header.pr_no) {
      continue;
    }

    monthlyTotals[monthIndex].prSet.add(header.pr_no);
  }

  for (const line of prLines) {
    if (line.fiscal_year !== selectedYear) {
      continue;
    }

    const divisionCode = toTitleCode(
      line.department_code || line.division_code || line.company_code,
      'UNKNOWN'
    );
    const divisionBucket = ensureMonthMapEntry(divisionBuckets, divisionCode);
    const monthIndex = (line.period_month || 0) - 1;

    if (
      line.fiscal_year === selectedYear &&
      monthIndex >= 0 &&
      monthIndex <= 11 &&
      line.pr_no
    ) {
      monthlyTotals[monthIndex].prSet.add(line.pr_no);
      divisionBucket[monthIndex].prSet.add(line.pr_no);
    }

    const statusKey = normalizeStatusKey(line.status);
    const statusBucket = statusBuckets.get(divisionCode) || {
      divisi: divisionCode,
      kode: divisionCode,
      ongoing_request_set: new Set(),
    };

    if (PR_ACTIVE_STATUSES.has(statusKey)) {
      if (line.pr_no) {
        statusBucket.ongoing_request_set.add(line.pr_no);
      }
    }

    statusBuckets.set(divisionCode, statusBucket);
  }

  const dataPerBulan = monthlyTotals.map((month, index) => ({
    bulan: MONTHS_SHORT[index],
    HPS: month.HPS,
    Komitmen_PO: month.Komitmen_PO,
    PR: month.prSet.size,
  }));

  const total = dataPerBulan.reduce(
    (accumulator, row) => {
      accumulator.HPS += row.HPS;
      accumulator.Komitmen_PO += row.Komitmen_PO;
      accumulator.Total_PR += row.PR;
      return accumulator;
    },
    emptyMonthlyTotal()
  );

  const divisionalData = Array.from(divisionBuckets.entries())
    .map(([divisionCode, months]) => ({
      divisi: divisionCode,
      kode_dept: divisionCode,
      bulan: months.map((month, index) => ({
        nama: MONTHS_FULL[index],
        hps: month.hps,
        komitmen_po: month.komitmen_po,
        pr: month.prSet.size,
      })),
    }))
    .sort((a, b) => a.divisi.localeCompare(b.divisi));

  const statusDivisions = Array.from(statusBuckets.values())
    .map((bucket) => ({
      divisi: bucket.divisi,
      kode: bucket.kode,
      ongoing_request: bucket.ongoing_request_set.size,
      on_proses_pengadaan: 0,
      estimasi_serapan: 0,
    }))
    .filter((item) => item.ongoing_request > 0)
    .sort((a, b) => b.ongoing_request - a.ongoing_request || a.divisi.localeCompare(b.divisi));

  const statusTotal = statusDivisions.reduce(
    (accumulator, item) => {
      accumulator.ongoing_request += item.ongoing_request;
      accumulator.on_proses_pengadaan += item.on_proses_pengadaan;
      accumulator.estimasi_serapan += item.estimasi_serapan;
      return accumulator;
    },
    { ongoing_request: 0, on_proses_pengadaan: 0, estimasi_serapan: 0 }
  );

  const totalHpsBillion = total.HPS / 1_000_000_000;
  const totalCommitmentBillion = total.Komitmen_PO / 1_000_000_000;
  const terserapBillion = 0;
  const estimasiSerapanBillion = totalCommitmentBillion;
  const serapanOnProsesBillion = 0;
  const totalSementaraBillion = totalCommitmentBillion;

  dashboard.dashboardData = {
    data_per_bulan: dataPerBulan,
    total,
    summary_box: {
      terserap_2025: Number(terserapBillion.toFixed(2)),
      komitmen_po_2025: Number(totalCommitmentBillion.toFixed(2)),
      total_hps_2025: Number(totalHpsBillion.toFixed(2)),
      serapan_onproses_2025: Number(serapanOnProsesBillion.toFixed(2)),
      total_sementara: Number(totalSementaraBillion.toFixed(2)),
      persen_terserap:
        totalCommitmentBillion > 0
          ? Number(((terserapBillion / totalCommitmentBillion) * 100).toFixed(2))
          : 0,
      persen_komitmen:
        totalHpsBillion > 0
          ? Number(((totalCommitmentBillion / totalHpsBillion) * 100).toFixed(2))
          : 0,
      persen_selisih_hps:
        totalHpsBillion > 0
          ? Number((100 - (totalCommitmentBillion / totalHpsBillion) * 100).toFixed(2))
          : 0,
      persen_total_serapan:
        totalHpsBillion > 0
          ? Number(((totalSementaraBillion / totalHpsBillion) * 100).toFixed(2))
          : 0,
      estimasi_serapan_2025: Number(estimasiSerapanBillion.toFixed(2)),
      total_persentase_serapan:
        totalHpsBillion > 0 ? Number((totalSementaraBillion / totalHpsBillion).toFixed(4)) : 0,
      carry_over: 0,
      recurring: 0,
      lintastahun2026: 0,
      recurring2026: 0,
      onproses: Number(serapanOnProsesBillion.toFixed(2)),
    },
  };

  dashboard.divisionalProcurementData = {
    data: divisionalData,
  };

  dashboard.procurementStatusData = {
    pengadaan_status: {
      total: {
        ongoing_request: statusTotal.ongoing_request,
        on_proses_pengadaan: Number(statusTotal.on_proses_pengadaan.toFixed(2)),
        estimasi_serapan: Number(statusTotal.estimasi_serapan.toFixed(2)),
      },
      divisi: statusDivisions,
    },
  };
  dashboard.selected_year = selectedYear;
  dashboard.available_years = availableYears;

  return dashboard;
}

function normalizePrHeaders(records, syncAt) {
  return records.map((record) => {
    const org = inferOrg(record);
    const derivedPeriod = derivePeriodFromDate(
      pickFirst(record, ['DefaultAccountingDate', 'DefaultRequestedDate'], null)
    );

    return {
      source_id: pickFirst(
        record,
        ['RecId', 'Id', 'PurchaseRequisitionHeaderId', 'RequisitionNumber'],
        null
      ),
      source_table: 'PurchaseRequisitionHeaders',
      pr_no: pickFirst(
        record,
        ['PurchaseRequisitionNumber', 'PRNumber', 'RequisitionNumber'],
        null
      ),
      line_no: null,
      fiscal_year: toInteger(
        pickFirst(record, ['FiscalYear', 'Year'], derivedPeriod.fiscalYear)
      ),
      period_month: toInteger(
        pickFirst(record, ['PeriodMonth', 'Month'], derivedPeriod.periodMonth)
      ),
      ...org,
      item_code: null,
      item_name: pickFirst(record, ['RequisitionName', 'RequisitionPurpose'], null),
      line_amount: toNumber(pickFirst(record, ['TotalAmount', 'LineAmount'], 0)),
      status: pickFirst(record, ['RequisitionStatus', 'WorkflowStatus', 'Status'], null),
      requested_at: toIsoDate(
        pickFirst(record, ['DefaultRequestedDate', 'RequestedDateTime', 'RequestedDate'], null)
      ),
      approved_at: toIsoDate(
        pickFirst(record, ['ApprovedDateTime', 'ApprovedDate', 'DefaultAccountingDate'], null)
      ),
      sync_at: syncAt,
    };
  });
}

function normalizePrLines(records, syncAt) {
  return records.map((record) => {
    const org = inferOrg(record);
    const derivedOrg = deriveOrgFromLedgerDimension(
      pickFirst(record, ['DefaultLedgerDimensionDisplayValue'], null)
    );
    const derivedPeriod = derivePeriodFromDate(
      pickFirst(record, ['AccountingDate', 'RequestedDate'], null)
    );

    return {
      source_id:
        pickFirst(record, ['RecId', 'Id', 'PurchaseRequisitionLineId'], null) ||
        `${pickFirst(record, ['RequisitionNumber'], 'UNKNOWN')}-${pickFirst(
          record,
          ['RequisitionLineNumber'],
          '0'
        )}`,
      source_table: 'PurchaseRequisitionLinesV2',
      pr_no: pickFirst(
        record,
        ['PurchaseRequisitionNumber', 'PRNumber', 'RequisitionNumber'],
        null
      ),
      line_no: toInteger(
        pickFirst(record, ['RequisitionLineNumber', 'LineNumber', 'LineNum'], null)
      ),
      fiscal_year: toInteger(
        pickFirst(record, ['FiscalYear', 'Year'], derivedPeriod.fiscalYear)
      ),
      period_month: toInteger(
        pickFirst(record, ['PeriodMonth', 'Month'], derivedPeriod.periodMonth)
      ),
      ...org,
      company_code: pickFirst(record, ['BuyingLegalEntityId'], org.company_code),
      department_code: pickFirst(
        record,
        ['ReceivingOperatingUnitNumber'],
        derivedOrg.department_code || org.department_code
      ),
      division_code: derivedOrg.division_code || org.division_code,
      item_code: pickFirst(record, ['ItemNumber', 'ItemId'], null),
      item_name: pickFirst(
        record,
        ['ProductName', 'ProcurementProductCategoryName', 'LineDescription', 'ItemName'],
        null
      ),
      line_amount: toNumber(pickFirst(record, ['LineAmount', 'Amount'], 0)),
      status: pickFirst(record, ['LineStatus', 'WorkflowStatus', 'Status'], null),
      requested_at: toIsoDate(
        pickFirst(record, ['RequestedDate', 'RequestedDateTime', 'RequestedDate'], null)
      ),
      approved_at: toIsoDate(
        pickFirst(record, ['ApprovedDateTime', 'ApprovedDate', 'AccountingDate'], null)
      ),
      sync_at: syncAt,
    };
  });
}

function normalizePlanTables(records, syncAt) {
  return records.map((record) => {
    const org = inferOrg(record);
    const derivedPeriod = derivePeriodFromProcurementPlanNumber(
      pickFirst(record, ['ProcurementPlanNumber'], null)
    );

    return {
      source_id: pickFirst(
        record,
        ['RecId', 'Id', 'ProcurementPlanTableId', 'ProcurementPlanNumber'],
        null
      ),
      source_table: 'ProcurementPlanTables',
      plan_no: pickFirst(record, ['ProcurementPlanNumber', 'ProcurementPlanId', 'PlanNumber'], null),
      line_no: null,
      fiscal_year: toInteger(
        pickFirst(record, ['FiscalYear', 'Year'], derivedPeriod.fiscalYear)
      ),
      period_month: toInteger(
        pickFirst(record, ['PeriodMonth', 'Month'], derivedPeriod.periodMonth)
      ),
      ...org,
      company_code: pickFirst(record, ['dataAreaId', 'DataAreaId'], org.company_code),
      hps_amount: toNumber(pickFirst(record, ['HPSAmount', 'EstimatedAmount'], 0)),
      committed_po_amount: toNumber(pickFirst(record, ['CommittedPOAmount', 'CommittedAmount'], 0)),
      pr_count: toNumber(pickFirst(record, ['PRCount', 'PurchaseRequisitionCount'], 0)),
      status: pickFirst(record, ['Status', 'WorkflowStatus'], null),
      sync_at: syncAt,
    };
  });
}

function normalizePlanDetails(records, syncAt) {
  return records.map((record) => {
    const org = inferOrg(record);
    const derivedOrg = deriveOrgFromBudgetDimension(
      pickFirst(record, ['BudgetDimension'], null)
    );
    const derivedPeriod = derivePeriodFromProcurementPlanNumber(
      pickFirst(record, ['ProcurementPlanNumber'], null)
    );

    return {
      source_id:
        pickFirst(record, ['RecId', 'Id', 'ProcurementPlanDetailId'], null) ||
        `${pickFirst(record, ['ProcurementPlanNumber'], 'UNKNOWN')}-${pickFirst(
          record,
          ['LineNum'],
          '0'
        )}`,
      source_table: 'ProcurementPlanDetails',
      plan_no: pickFirst(
        record,
        ['ProcurementPlanNumber', 'ProcurementPlanId', 'PlanNumber'],
        null
      ),
      line_no: toInteger(pickFirst(record, ['LineNum', 'LineNumber', 'LineNum'], null)),
      fiscal_year: toInteger(
        pickFirst(record, ['FiscalYear', 'Year'], derivedPeriod.fiscalYear)
      ),
      period_month: toInteger(
        pickFirst(record, ['PeriodMonth', 'Month'], derivedPeriod.periodMonth)
      ),
      ...org,
      company_code: pickFirst(record, ['dataAreaId', 'DataAreaId'], org.company_code),
      department_code: derivedOrg.department_code || org.department_code,
      division_code: derivedOrg.division_code || org.division_code,
      department_name: pickFirst(record, ['Description'], org.department_name),
      hps_amount: toNumber(pickFirst(record, ['Amount', 'HPSAmount', 'EstimatedAmount'], 0)),
      committed_po_amount: toNumber(pickFirst(record, ['CommittedPOAmount', 'CommittedAmount'], 0)),
      pr_count: toNumber(pickFirst(record, ['PRCount', 'PurchaseRequisitionCount'], 0)),
      status: pickFirst(record, ['Status', 'WorkflowStatus'], null),
      sync_at: syncAt,
    };
  });
}

export function toProcurementPreviewPayload(sourcePreview, options = {}) {
  const syncAt = new Date().toISOString();
  const prHeaders = normalizePrHeaders(sourcePreview.PurchaseRequisitionHeaders.records, syncAt);
  const prLines = normalizePrLines(sourcePreview.PurchaseRequisitionLinesV2.records, syncAt);
  const planTables = normalizePlanTables(sourcePreview.ProcurementPlanTables.records, syncAt);
  const planDetails = normalizePlanDetails(sourcePreview.ProcurementPlanDetails.records, syncAt);
  const { availableYears, selectedYear } = getProcurementYearScope(options.selectedYear);
  const dashboardContract = buildProcurementDashboardContract(prHeaders, prLines, planDetails, {
    selectedYear,
  });

  return {
    schema_version: SCHEMA_VERSION,
    domain: 'procurement',
    mode: sourcePreview.PurchaseRequisitionHeaders.mode,
    mapping_status: {
      ready_for_dashboard: true,
      note: 'Dashboard contract procurement sudah dibentuk dari normalized facts. Definisi bisnis komitmen PO dan on-process masih best-effort sampai rule final disepakati.',
    },
    slicer: {
      available_years: availableYears,
      selected_year: selectedYear,
    },
    source_counts: {
      PurchaseRequisitionHeaders: sourcePreview.PurchaseRequisitionHeaders.count,
      PurchaseRequisitionLinesV2: sourcePreview.PurchaseRequisitionLinesV2.count,
      ProcurementPlanTables: sourcePreview.ProcurementPlanTables.count,
      ProcurementPlanDetails: sourcePreview.ProcurementPlanDetails.count,
    },
    canonical_schema: {
      purchaseRequisitionFact: CANONICAL_SCHEMA.purchaseRequisitionFact,
      procurementPlanFact: CANONICAL_SCHEMA.procurementPlanFact,
    },
    source_metadata: {
      PurchaseRequisitionHeaders: {
        selected_fields: sourcePreview.PurchaseRequisitionHeaders.selectedFields,
        filter: sourcePreview.PurchaseRequisitionHeaders.filter,
        has_next_page: Boolean(sourcePreview.PurchaseRequisitionHeaders.nextLink),
      },
      PurchaseRequisitionLinesV2: {
        selected_fields: sourcePreview.PurchaseRequisitionLinesV2.selectedFields,
        filter: sourcePreview.PurchaseRequisitionLinesV2.filter,
        has_next_page: Boolean(sourcePreview.PurchaseRequisitionLinesV2.nextLink),
      },
      ProcurementPlanTables: {
        selected_fields: sourcePreview.ProcurementPlanTables.selectedFields,
        filter: sourcePreview.ProcurementPlanTables.filter,
        has_next_page: Boolean(sourcePreview.ProcurementPlanTables.nextLink),
      },
      ProcurementPlanDetails: {
        selected_fields: sourcePreview.ProcurementPlanDetails.selectedFields,
        filter: sourcePreview.ProcurementPlanDetails.filter,
        has_next_page: Boolean(sourcePreview.ProcurementPlanDetails.nextLink),
      },
    },
    data: {
      pr_headers: prHeaders,
      pr_lines: prLines,
      procurement_plan_tables: planTables,
      procurement_plan_details: planDetails,
      dashboard_contract: dashboardContract,
    },
  };
}
