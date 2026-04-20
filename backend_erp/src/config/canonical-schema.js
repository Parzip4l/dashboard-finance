export const SCHEMA_VERSION = '1.0.0';

export const CANONICAL_SCHEMA = Object.freeze({
  budgetPlanFact: [
    'source_id',
    'source_table',
    'header_id',
    'document_no',
    'fiscal_year',
    'period_month',
    'company_code',
    'department_code',
    'department_name',
    'division_code',
    'division_name',
    'budget_type',
    'scenario',
    'account_code',
    'account_name',
    'amount',
    'currency',
    'status',
    'approved_at',
    'sync_at',
  ],
  purchaseRequisitionFact: [
    'source_id',
    'source_table',
    'pr_no',
    'line_no',
    'fiscal_year',
    'period_month',
    'company_code',
    'department_code',
    'department_name',
    'division_code',
    'division_name',
    'item_code',
    'item_name',
    'line_amount',
    'status',
    'requested_at',
    'approved_at',
    'sync_at',
  ],
  procurementPlanFact: [
    'source_id',
    'source_table',
    'plan_no',
    'line_no',
    'fiscal_year',
    'period_month',
    'company_code',
    'department_code',
    'department_name',
    'division_code',
    'division_name',
    'hps_amount',
    'committed_po_amount',
    'pr_count',
    'status',
    'sync_at',
  ],
  ledgerActivityFact: [
    'source_id',
    'source_table',
    'voucher_no',
    'fiscal_year',
    'period_month',
    'company_code',
    'department_code',
    'department_name',
    'division_code',
    'division_name',
    'account_code',
    'account_name',
    'budget_type',
    'posting_type',
    'amount',
    'posted_at',
    'sync_at',
  ],
});

export function createEmptyFinanceDashboardContract() {
  return {
    total_lrtj: {},
    category_totals: {
      SUBSIDI: {},
      BUSDEV: {},
      CORPORATE_COST: {},
      OVERALL: {},
    },
    grouped: {
      SUBSIDI: [],
      BUSDEV: [],
      CORPORATE_COST: [],
      OVERALL: [],
    },
    departments: [],
    departmentBudgetData: {
      total: {
        realokasi_2025: {},
        penyerapan: {},
        sisa_anggaran: {},
      },
      departments: [],
    },
  };
}

export function createEmptyProcurementDashboardContract() {
  return {
    dashboardData: {
      data_per_bulan: [],
      total: {},
      summary_box: {},
    },
    divisionalProcurementData: {
      data: [],
    },
    procurementStatusData: {
      pengadaan_status: {
        total: {},
        divisi: [],
      },
    },
  };
}
