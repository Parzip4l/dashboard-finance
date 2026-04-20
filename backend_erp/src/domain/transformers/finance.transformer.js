import {
  CANONICAL_SCHEMA,
  SCHEMA_VERSION,
  createEmptyFinanceDashboardContract,
} from '../../config/canonical-schema.js';
import { env } from '../../config/env.js';
import { inferOrg, pickFirst, toInteger, toIsoDate, toNumber } from './shared.js';

const FINANCE_CATEGORIES = ['SUBSIDI', 'BUSDEV', 'CORPORATE_COST'];
const DISALLOWED_FINANCE_ORG_TOKENS = ['jakpro'];
const FINANCE_CATEGORY_BY_DIVISION = new Map([
  ['business development division', 'BUSDEV'],
  ['operation & services division', 'SUBSIDI'],
  ['infrastructure division', 'SUBSIDI'],
  ['rolling stock division', 'SUBSIDI'],
  ['quality, safety, health & environment division', 'SUBSIDI'],
  ['quality, safety, health & environment department', 'SUBSIDI'],
  ['lrtj project for construction 2 & 3 division', 'SUBSIDI'],
  ['corporate secretary division', 'CORPORATE_COST'],
  ['corporate strategy & risk management division', 'CORPORATE_COST'],
  ['finance & accounting division', 'CORPORATE_COST'],
  ['human capital & general affair division', 'CORPORATE_COST'],
  ['information technology division', 'CORPORATE_COST'],
  ['internal audit division', 'CORPORATE_COST'],
  ['supply chain management division', 'CORPORATE_COST'],
]);
const FINANCE_CATEGORY_BY_DEPARTMENT = new Map([
  ['business development department (departemen pengembangan bisnis)', 'BUSDEV'],
  ['business expansion department (departemen ekspansi bisnis)', 'BUSDEV'],
  ['commercial department (departemen komersial)', 'BUSDEV'],
  ['customer engagement department (departemen keterlibatan pelanggan)', 'BUSDEV'],
  ['services department (departemen pelayanan)', 'SUBSIDI'],
  ['operation control department (departemen pengendali operasi)', 'SUBSIDI'],
  ['train crew department (departemen awak sarana perkeretaapian)', 'SUBSIDI'],
  ['rolling stock maintenance department (departemen perawatan sarana)', 'SUBSIDI'],
  ['infrastructure engineering & quality department (departemen rekayasa dan mutu prasarana)', 'SUBSIDI'],
  ['infrastructure operation facility department (departemen fasilitas operasi prasarana)', 'SUBSIDI'],
  ['track & building department (departemen jalur dan bangunan)', 'SUBSIDI'],
  ['maintenance facility department (departemen fasilitas perawatan)', 'SUBSIDI'],
  ['warehouse department (departemen pergudangan)', 'SUBSIDI'],
  ['security department (departemen keamanan)', 'SUBSIDI'],
  ['quality, safety, health & environment department (departemen mutu, keselamatan & kesehatan lingkungan)', 'SUBSIDI'],
  ['safety, health & environment department (departemen keselamatan & kesehatan lingkungan)', 'SUBSIDI'],
  ['quality assurances department (departemen jaminan mutu)', 'SUBSIDI'],
  ['procurement department (departemen pengadaan)', 'CORPORATE_COST'],
  ['legal department (departemen hukum)', 'CORPORATE_COST'],
  ['corporate communication department (departemen komunikasi perusahaan)', 'CORPORATE_COST'],
  ['corporate planning department (departemen perencanaan perusahaan)', 'CORPORATE_COST'],
  ['finance & revenue settlement department (departemen keuangan dan pendapatan)', 'CORPORATE_COST'],
  ['finance & treasury department (departemen keuangan dan perbendaharaan)', 'CORPORATE_COST'],
  ['accounting & taxation department (departemen akuntansi dan perpajakan)', 'CORPORATE_COST'],
  ['general affair department (departemen bagian umum)', 'CORPORATE_COST'],
  ['human capital development department (departemen pengembangan sdm)', 'CORPORATE_COST'],
  ['human capital services department (departemen layanan sdm)', 'CORPORATE_COST'],
  ['it infrastructure & security department (departemen infrastruktur & keamanan ti)', 'CORPORATE_COST'],
  ['it system development departemen (departemen pengembangan sistem teknologi informasi)', 'CORPORATE_COST'],
  ['it system operation & services department (departemen operasi sistem & layanan teknologi informasi)', 'CORPORATE_COST'],
  ['risk management & compliance department (departemen manajemen resiko dan kepatuhan)', 'CORPORATE_COST'],
  ['secretariat & administration department (departemen kesekretariatan dan administrasi)', 'CORPORATE_COST'],
  ['subsidy & budgeting department (departemen subsidi dan anggaran)', 'CORPORATE_COST'],
]);

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function yearFromOffset(value) {
  const parsed = toInteger(value, null);
  if (parsed === null) {
    return null;
  }

  return new Date().getUTCFullYear() + parsed;
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

function parseDimensionSegments(value) {
  const text = String(value || '').trim().replace(/,+$/, '');
  if (!text) {
    return [];
  }

  return text
    .split(/[-|/]/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function guessOrgFromDimensions(record) {
  const rawDimension = pickFirst(
    record,
    [
      'BudgetDimension',
      'DefaultLedgerDimensionDisplayValue',
      'LedgerDimensionDisplayValue',
      'DefaultDimensionDisplayValue',
      'FinancialDimensionDisplayValue',
      'DimensionDisplayValue',
    ],
    null
  );
  const segments = parseDimensionSegments(rawDimension);

  if (segments.length < 2) {
    return {
      department_code: null,
      division_code: null,
    };
  }

  return {
    department_code: segments[1] || segments[0] || null,
    division_code: segments[2] || null,
  };
}

function inferFinanceOrg(record) {
  const baseOrg = inferOrg(record);
  const dimensionOrg = guessOrgFromDimensions(record);

  return {
    company_code: pickFirst(
      record,
      ['DataAreaId', 'dataAreaId', 'Company', 'LegalEntityId', 'LegalEntity', 'CompanyCode'],
      baseOrg.company_code
    ),
    department_code: pickFirst(
      record,
      [
        'DepartmentCode',
        'departmentCode',
        'DepartmentValue',
        'Department',
        'ActDepartmentCode',
        'CostCenter',
        'CostCenterValue',
        'OperatingUnitNumber',
      ],
      dimensionOrg.department_code || baseOrg.department_code
    ),
    department_name: pickFirst(
      record,
      [
        'DepartmentName',
        'departmentName',
        'ActDepartment',
        'DepartmentDescription',
        'CostCenterName',
        'OperatingUnitName',
        'BusinessUnitName',
      ],
      baseOrg.department_name
    ),
    division_code: pickFirst(
      record,
      [
        'DivisionCode',
        'divisionCode',
        'Division',
        'BusinessUnitCode',
        'DirectorateCode',
        'DirectoratID',
        'DepartmentGroup',
      ],
      dimensionOrg.division_code || baseOrg.division_code
    ),
    division_name: pickFirst(
      record,
      ['DivisionName', 'divisionName', 'ActDivision', 'BusinessUnitName', 'DirectorateName', 'DirectoratName'],
      baseOrg.division_name
    ),
  };
}

function getFinanceYearScope(selectedYear = null) {
  const currentYear = new Date().getUTCFullYear();
  const previousYear = currentYear - 1;
  const availableYears = [currentYear, previousYear];

  return {
    availableYears,
    selectedYear: availableYears.includes(selectedYear) ? selectedYear : currentYear,
  };
}

function createZeroFinanceTotal() {
  return {
    anggaran_proposal_capex: 0,
    anggaran_proposal_opex: 0,
    anggaran_proposal_total: 0,
    anggaran_realokasi_2025_capex: 0,
    anggaran_realokasi_2025_opex: 0,
    anggaran_realokasi_2025_total: 0,
    realisasi_capex_total: 0,
    opex_verifikasi_total: 0,
    opex_ppa_spuk_kk_total: 0,
    proforma_total: 0,
    penyerapan_total: 0,
    penyerapan_persen: 0,
    sisa_anggaran_total: 0,
  };
}

function addToFinanceTotal(target, source) {
  target.anggaran_proposal_capex += source.anggaran_proposal_capex;
  target.anggaran_proposal_opex += source.anggaran_proposal_opex;
  target.anggaran_proposal_total += source.anggaran_proposal_total;
  target.anggaran_realokasi_2025_capex += source.anggaran_realokasi_2025_capex;
  target.anggaran_realokasi_2025_opex += source.anggaran_realokasi_2025_opex;
  target.anggaran_realokasi_2025_total += source.anggaran_realokasi_2025_total;
  target.realisasi_capex_total += source.realisasi_capex_total;
  target.opex_verifikasi_total += source.opex_verifikasi_total;
  target.opex_ppa_spuk_kk_total += source.opex_ppa_spuk_kk_total;
  target.proforma_total += source.proforma_total;
  target.penyerapan_total += source.penyerapan_total;
  target.sisa_anggaran_total += source.sisa_anggaran_total;
}

function finalizeFinanceTotal(total) {
  total.penyerapan_persen =
    total.anggaran_realokasi_2025_total > 0
      ? Number(((total.penyerapan_total / total.anggaran_realokasi_2025_total) * 100).toFixed(2))
      : 0;

  return total;
}

function buildDepartmentKey(record) {
  const departmentName = record.department_name || record.account_name || record.document_no || 'Unknown Department';
  const departmentCode = record.department_code || record.division_code || record.account_code || 'UNK';

  return `${departmentCode}::${departmentName}`;
}

function isAllowedFinanceOrg(record) {
  const text = [
    record.company_code,
    record.department_code,
    record.department_name,
    record.division_code,
    record.division_name,
  ]
    .map(normalizeText)
    .join(' ');

  return !DISALLOWED_FINANCE_ORG_TOKENS.some((token) => text.includes(token));
}

function classifyFinanceCategory(record) {
  const divisionName = normalizeText(record.division_name || record.direktorat);
  const departmentName = normalizeText(record.department_name || record.departemen);

  return (
    FINANCE_CATEGORY_BY_DIVISION.get(divisionName) ||
    FINANCE_CATEGORY_BY_DEPARTMENT.get(departmentName) ||
    null
  );
}

function pickBudgetHeaderAmount(record) {
  const adjusted = toNumber(pickFirst(record, ['TotalBudgetAdjust', 'TotalCapexAdjust', 'TotalOpexAdjust'], null), 0);
  if (adjusted !== 0) {
    return adjusted;
  }

  return toNumber(
    pickFirst(record, ['TotalBudget', 'TotalCapex', 'TotalOpex', 'Amount', 'BudgetAmount', 'TotalAmount'], 0)
  );
}

function normalizeBudgetHeaders(records, syncAt) {
  return records.map((record) => {
    const org = inferFinanceOrg(record);
    const derivedPeriod = derivePeriodFromDate(
      pickFirst(record, ['AccountingDate', 'BudgetDate', 'CreatedDateTime', 'ApprovedDateTime'], null)
    );

    return {
      source_id: pickFirst(record, ['RecId', 'Id', 'BudgetPlanningEntryId'], null),
      source_table: 'BudgetPlanningEntries',
      header_id: pickFirst(
        record,
        ['BudgetPlanningId', 'BudgetPlanId', 'EntryNumber', 'BudgetPlanningEntryNumber'],
        null
      ),
      document_no: pickFirst(
        record,
        ['BudgetPlanningId', 'DocumentNumber', 'EntryNumber', 'BudgetPlanningEntryNumber'],
        null
      ),
      fiscal_year: toInteger(
        pickFirst(record, ['FiscalYear', 'BudgetYear', 'Year'], derivedPeriod.fiscalYear)
      ),
      period_month: toInteger(
        pickFirst(record, ['PeriodMonth', 'Month'], derivedPeriod.periodMonth)
      ),
      ...org,
      budget_type: pickFirst(record, ['BudgetType', 'budgetType', 'BudgetModelType', 'Type', 'BudgetModel'], 'UNKNOWN'),
      scenario: pickFirst(record, ['Scenario', 'BudgetScenario', 'VersionType', 'Version', 'TransType'], 'PROPOSAL'),
      account_code: pickFirst(record, ['MainAccountId', 'AccountCode', 'MainAccount', 'BudgetCode'], null),
      account_name: pickFirst(
        record,
        ['MainAccountName', 'AccountName', 'MainAccountDescription', 'DepartmentName', 'DivisionName'],
        null
      ),
      amount: pickBudgetHeaderAmount(record),
      proposal_capex_amount: toNumber(pickFirst(record, ['TotalCapex'], 0)),
      proposal_opex_amount: toNumber(pickFirst(record, ['TotalOpex'], 0)),
      proposal_total_amount: toNumber(pickFirst(record, ['TotalBudget'], 0)),
      adjusted_capex_amount: toNumber(pickFirst(record, ['TotalCapexAdjust'], 0)),
      adjusted_opex_amount: toNumber(pickFirst(record, ['TotalOpexAdjust'], 0)),
      adjusted_total_amount: toNumber(pickFirst(record, ['TotalBudgetAdjust'], 0)),
      difference_amount: toNumber(pickFirst(record, ['Difference'], 0)),
      currency: pickFirst(record, ['CurrencyCode', 'AccountingCurrencyCode'], 'IDR'),
      status: pickFirst(record, ['ApprovalStatus', 'WorkflowStatus', 'Status', 'RecordStatus'], null),
      approved_at: toIsoDate(
        pickFirst(record, ['ApprovedDateTime', 'ApprovedDate', 'WorkflowCompletedDateTime'], null)
      ),
      sync_at: syncAt,
    };
  });
}

function normalizeBudgetLines(records, syncAt) {
  return records.map((record) => {
    const org = inferFinanceOrg(record);
    const derivedPeriod = derivePeriodFromDate(
      pickFirst(record, ['AccountingDate', 'BudgetDate', 'CreatedDateTime', 'ApprovedDateTime'], null)
    );

    return {
      source_id: pickFirst(record, ['RecId', 'Id', 'BudgetPlanningLineId'], null),
      source_table: 'KREBudgetPlanningEntriesLines',
      header_id: pickFirst(
        record,
        ['BudgetPlanningId', 'BudgetPlanId', 'EntryNumber', 'BudgetPlanningEntryNumber'],
        null
      ),
      document_no: pickFirst(
        record,
        ['BudgetPlanningId', 'DocumentNumber', 'EntryNumber', 'BudgetPlanningEntryNumber'],
        null
      ),
      fiscal_year: toInteger(
        pickFirst(record, ['FiscalYear', 'BudgetYear', 'Year'], derivedPeriod.fiscalYear)
      ),
      period_month: toInteger(
        pickFirst(record, ['PeriodMonth', 'Month'], derivedPeriod.periodMonth)
      ),
      ...org,
      department_name: pickFirst(record, ['ActDepartment'], org.department_name),
      division_name: pickFirst(record, ['ActDivision'], org.division_name),
      budget_type: pickFirst(record, ['BudgetType', 'LineType', 'BudgetModelType', 'Type', 'CalcType'], 'UNKNOWN'),
      scenario: pickFirst(record, ['Scenario', 'BudgetScenario', 'VersionType', 'Version'], 'PROPOSAL'),
      account_code: pickFirst(record, ['BudgetCode', 'MainAccountId', 'AccountCode', 'MainAccount'], null),
      account_name: pickFirst(
        record,
        ['CodeName', 'Descriptions', 'MainAccountName', 'AccountName', 'MainAccountDescription'],
        null
      ),
      amount: toNumber(
        pickFirst(record, ['TotalPrice', 'TotalPeriod', 'Amount', 'LineAmount', 'BudgetAmount'], 0)
      ),
      currency: pickFirst(record, ['CurrencyCode', 'AccountingCurrencyCode'], 'IDR'),
      status: pickFirst(record, ['ApprovalStatus', 'WorkflowStatus', 'Status', 'RecordStatus', 'Posted'], null),
      approved_at: toIsoDate(
        pickFirst(record, ['ApprovedDateTime', 'ApprovedDate', 'WorkflowCompletedDateTime'], null)
      ),
      sync_at: syncAt,
    };
  });
}

function buildLookupMap(records, keyField) {
  const map = new Map();
  (records || []).forEach((record) => {
    const key = record?.[keyField];
    if (key !== null && key !== undefined && key !== '') {
      map.set(String(key), record);
    }
  });
  return map;
}

function pickFirstNonEmpty(values) {
  for (const value of values) {
    if (value !== null && value !== undefined && value !== '') {
      return value;
    }
  }

  return null;
}

function normalizeLedgerActivities(records, syncAt, lookups = {}) {
  const mainAccountMap = buildLookupMap(lookups.mainAccounts, 'MainAccountRecId');
  const dimensionCombinationMap = buildLookupMap(lookups.dimensionCombinations, 'RecordId');
  const ledgerMap = buildLookupMap(lookups.ledgers, 'LedgerRecId');

  return records.map((record, index) => {
    const mainAccount = mainAccountMap.get(String(record.MainAccountRecId || '')) || null;
    const dimension = dimensionCombinationMap.get(String(record.LedgerDimension || '')) || null;
    const ledger = ledgerMap.get(String(record.Ledger || '')) || null;
    const fiscalYear = yearFromOffset(record.YearOffset);
    const org = {
      ...inferFinanceOrg(record),
      company_code: pickFirstNonEmpty([ledger?.LegalEntityId, env.d365Company ? String(env.d365Company).toUpperCase() : null]),
      department_code: pickFirstNonEmpty([
        dimension?.J01_Department,
        dimension?.P01_Departemen,
        dimension?.I03_Department,
      ]),
      department_name: null,
      division_code: pickFirstNonEmpty([
        dimension?.D02_Divisi,
        dimension?.L01_Division,
        dimension?.I01_BusinessUnit,
        dimension?.P02_SBU,
      ]),
      division_name: null,
    };
    const debit = toNumber(pickFirst(record, ['DebitAmount', 'AmountDebit', 'AccountingCurrencyDebitAmount'], null), 0);
    const credit = toNumber(pickFirst(record, ['CreditAmount', 'AmountCredit', 'AccountingCurrencyCreditAmount'], null), 0);
    const signedAmount =
      debit || credit
        ? debit - credit
        : toNumber(
            pickFirst(record, ['AccountingCurrencyAmount', 'AmountMST', 'TransactionAmount'], 0)
          );

    return {
      source_id:
        pickFirst(record, ['RecId', 'Id', 'GeneralLedgerActivityId'], null) ||
        `${record.Ledger || 'ledger'}:${record.LedgerDimension || 'dim'}:${record.MainAccountRecId || 'acct'}:${record.YearOffset || 'year'}:${index + 1}`,
      source_table: 'GeneralLedgerActivities',
      voucher_no: pickFirst(
        record,
        ['Voucher', 'VoucherNumber', 'JournalNumber', 'JournalBatchNumber'],
        dimension?.DisplayValue || null
      ),
      fiscal_year: toInteger(
        pickFirst(record, ['FiscalYear', 'AccountingYear', 'Year'], fiscalYear)
      ),
      period_month: toInteger(
        pickFirst(record, ['FiscalPeriod', 'PeriodMonth', 'Month'], null)
      ),
      ...org,
      account_code: pickFirst(
        record,
        ['MainAccountId', 'AccountCode', 'MainAccount'],
        mainAccount?.MainAccountId || dimension?.MainAccount || null
      ),
      account_name: pickFirst(
        record,
        ['MainAccountName', 'AccountName', 'MainAccountDescription'],
        mainAccount?.Name || null
      ),
      budget_type: pickFirst(record, ['BudgetType', 'PostingCategory', 'AccountCategory'], 'UNKNOWN'),
      posting_type: pickFirst(
        record,
        ['PostingType', 'AccountingSourceExplore', 'JournalCategory', 'TransactionType'],
        'ACTUAL'
      ),
      amount: signedAmount,
      posted_at: toIsoDate(pickFirst(record, ['AccountingDate', 'PostingDate', 'TransactionDate'], null)),
      posting_layer: record.PostingLayer || null,
      year_offset: toInteger(record.YearOffset, null),
      ledger_dimension: record.LedgerDimension || null,
      ledger_dimension_display: dimension?.DisplayValue || null,
      ledger_rec_id: record.Ledger || null,
      legal_entity_id: ledger?.LegalEntityId || null,
      main_account_rec_id: record.MainAccountRecId || null,
      sync_at: syncAt,
    };
  });
}

function buildFinanceDashboardContract(budgetHeaders, budgetLines, ledgerActivities, options = {}) {
  const dashboard = createEmptyFinanceDashboardContract();
  const { availableYears, selectedYear } = getFinanceYearScope(options.selectedYear);

  if (!selectedYear) {
    return dashboard;
  }

  const departmentMap = new Map();

  for (const record of budgetHeaders) {
    if (record.fiscal_year !== selectedYear || !isAllowedFinanceOrg(record)) {
      continue;
    }

    const key = buildDepartmentKey(record);
    const row =
      departmentMap.get(key) ||
      {
        department_code: record.department_code || record.division_code || record.company_code || 'UNK',
        department_name:
          record.department_name || record.division_name || record.document_no || 'Unknown Department',
        division_code: record.division_code || record.company_code || 'UNK',
        division_name: record.division_name || record.company_code || 'UNKNOWN',
        kode: record.department_code || record.division_code || record.company_code || 'UNK',
        div: record.division_code || record.company_code || 'UNK',
        direktorat: record.division_name || record.company_code || 'UNKNOWN',
        departemen:
          record.department_name || record.division_name || record.document_no || 'Unknown Department',
        anggaran_proposal_capex: 0,
        anggaran_proposal_opex: 0,
        anggaran_proposal_total: 0,
        anggaran_realokasi_2025_capex: 0,
        anggaran_realokasi_2025_opex: 0,
        anggaran_realokasi_2025_total: 0,
        realisasi_capex_total: 0,
        opex_verifikasi_total: 0,
        opex_ppa_spuk_kk_total: 0,
        proforma_total: 0,
        penyerapan_total: 0,
        penyerapan_persen: 0,
        sisa_anggaran_total: 0,
      };

    const proposalCapex = toNumber(record.proposal_capex_amount, 0);
    const proposalOpex = toNumber(record.proposal_opex_amount, 0);
    const proposalTotal =
      toNumber(record.proposal_total_amount, 0) || proposalCapex + proposalOpex || toNumber(record.amount, 0);
    const adjustedCapex = toNumber(record.adjusted_capex_amount, 0);
    const adjustedOpex = toNumber(record.adjusted_opex_amount, 0);
    const adjustedTotal = toNumber(record.adjusted_total_amount, 0);

    row.anggaran_proposal_capex += proposalCapex;
    row.anggaran_proposal_opex += proposalOpex;
    row.anggaran_proposal_total += proposalTotal;

    row.anggaran_realokasi_2025_capex += adjustedCapex;
    row.anggaran_realokasi_2025_opex += adjustedOpex;
    row.anggaran_realokasi_2025_total += adjustedTotal;

    departmentMap.set(key, row);
  }

  if (departmentMap.size === 0) {
    for (const record of budgetLines) {
      if (record.fiscal_year !== selectedYear || !isAllowedFinanceOrg(record)) {
        continue;
      }

      const key = buildDepartmentKey(record);
      const row =
        departmentMap.get(key) ||
        {
          department_code: record.department_code || record.division_code || record.company_code || 'UNK',
          department_name:
            record.department_name || record.division_name || record.document_no || 'Unknown Department',
          division_code: record.division_code || record.company_code || 'UNK',
          division_name: record.division_name || record.company_code || 'UNKNOWN',
          kode: record.department_code || record.division_code || record.company_code || 'UNK',
          div: record.division_code || record.company_code || 'UNK',
          direktorat: record.division_name || record.company_code || 'UNKNOWN',
          departemen:
            record.department_name || record.division_name || record.document_no || 'Unknown Department',
          anggaran_proposal_capex: 0,
          anggaran_proposal_opex: 0,
          anggaran_proposal_total: 0,
          anggaran_realokasi_2025_capex: 0,
          anggaran_realokasi_2025_opex: 0,
          anggaran_realokasi_2025_total: 0,
          realisasi_capex_total: 0,
          opex_verifikasi_total: 0,
          opex_ppa_spuk_kk_total: 0,
          proforma_total: 0,
          penyerapan_total: 0,
          penyerapan_persen: 0,
          sisa_anggaran_total: 0,
        };

      const amount = toNumber(record.amount, 0);
      row.anggaran_proposal_total += amount;

      departmentMap.set(key, row);
    }
  }

  for (const record of ledgerActivities) {
    if (record.fiscal_year !== selectedYear || !isAllowedFinanceOrg(record)) {
      continue;
    }

    const key = buildDepartmentKey(record);
    const row =
      departmentMap.get(key) ||
      {
        department_code: record.department_code || record.division_code || record.company_code || 'UNK',
        department_name:
          record.department_name || record.division_name || record.account_name || 'Unknown Department',
        division_code: record.division_code || record.company_code || 'UNK',
        division_name: record.division_name || record.company_code || 'UNKNOWN',
        kode: record.department_code || record.division_code || record.company_code || 'UNK',
        div: record.division_code || record.company_code || 'UNK',
        direktorat: record.division_name || record.company_code || 'UNKNOWN',
        departemen:
          record.department_name || record.division_name || record.account_name || 'Unknown Department',
        anggaran_proposal_capex: 0,
        anggaran_proposal_opex: 0,
        anggaran_proposal_total: 0,
        anggaran_realokasi_2025_capex: 0,
        anggaran_realokasi_2025_opex: 0,
        anggaran_realokasi_2025_total: 0,
        realisasi_capex_total: 0,
        opex_verifikasi_total: 0,
        opex_ppa_spuk_kk_total: 0,
        proforma_total: 0,
        penyerapan_total: 0,
        penyerapan_persen: 0,
        sisa_anggaran_total: 0,
      };

    // Actual bucket mapping is intentionally disabled until D365 provides
    // a validated source field that separates CAPEX, verifikasi, and PPA/SPUK/KK.
    departmentMap.set(key, row);
  }

  const departments = Array.from(departmentMap.values())
    .map((row) => {
      row.penyerapan_total =
        row.realisasi_capex_total + row.opex_verifikasi_total + row.opex_ppa_spuk_kk_total;
      row.sisa_anggaran_total = row.anggaran_realokasi_2025_total - row.penyerapan_total;
      row.penyerapan_persen =
        row.anggaran_realokasi_2025_total > 0
          ? Number(((row.penyerapan_total / row.anggaran_realokasi_2025_total) * 100).toFixed(2))
          : 0;

      return {
        ...row,
        category: classifyFinanceCategory(row),
      };
    })
    .sort((a, b) => b.anggaran_realokasi_2025_total - a.anggaran_realokasi_2025_total);

  const categoryTotals = {
    SUBSIDI: createZeroFinanceTotal(),
    BUSDEV: createZeroFinanceTotal(),
    CORPORATE_COST: createZeroFinanceTotal(),
    OVERALL: createZeroFinanceTotal(),
  };
  const grouped = {
    SUBSIDI: [],
    BUSDEV: [],
    CORPORATE_COST: [],
    OVERALL: [],
  };

  for (const row of departments) {
    if (row.category && grouped[row.category]) {
      grouped[row.category].push(row);
      addToFinanceTotal(categoryTotals[row.category], row);
    }

    grouped.OVERALL.push(row);
    addToFinanceTotal(categoryTotals.OVERALL, row);
  }

  FINANCE_CATEGORIES.forEach((category) => finalizeFinanceTotal(categoryTotals[category]));
  finalizeFinanceTotal(categoryTotals.OVERALL);

  const totalLrtj = { ...categoryTotals.OVERALL };

  dashboard.total_lrtj = totalLrtj;
  dashboard.category_totals = categoryTotals;
  dashboard.grouped = grouped;
  dashboard.departments = departments;
  dashboard.selected_year = selectedYear;
  dashboard.available_years = availableYears;
  dashboard.departmentBudgetData = {
    total: {
      realokasi_2025: {
        total: totalLrtj.anggaran_realokasi_2025_total,
        capex: totalLrtj.anggaran_realokasi_2025_capex,
        opex: totalLrtj.anggaran_realokasi_2025_opex,
      },
      penyerapan: {
        total: totalLrtj.penyerapan_total,
        persentase: totalLrtj.penyerapan_persen,
      },
      sisa_anggaran: {
        total: totalLrtj.sisa_anggaran_total,
      },
    },
    departments,
  };

  return dashboard;
}

export function toFinancePreviewPayload(sourcePreview, options = {}) {
  const syncAt = new Date().toISOString();
  const budgetHeaders = normalizeBudgetHeaders(sourcePreview.BudgetPlanningEntries.records, syncAt);
  const budgetLines = normalizeBudgetLines(sourcePreview.KREBudgetPlanningEntriesLines.records, syncAt);
  const ledgerActivities = normalizeLedgerActivities(sourcePreview.GeneralLedgerActivities.records, syncAt, {
    mainAccounts: sourcePreview.MainAccounts?.records || [],
    dimensionCombinations: sourcePreview.DimensionCombinations?.records || [],
    ledgers: sourcePreview.Ledgers?.records || [],
  });
  const { availableYears, selectedYear } = getFinanceYearScope(options.selectedYear);
  const dashboardContract = buildFinanceDashboardContract(
    budgetHeaders,
    budgetLines,
    ledgerActivities,
    { selectedYear }
  );
  const budgetLinesError = sourcePreview.KREBudgetPlanningEntriesLines.error || null;
  const ledgerError = sourcePreview.GeneralLedgerActivities.error || null;
  const warnings = [];

  if (budgetLinesError) {
    warnings.push({
      entity: 'KREBudgetPlanningEntriesLines',
      message:
        'Detail line budget gagal dimuat penuh. Dashboard finance tetap dibentuk dari header budget yang tersedia.',
      details: budgetLinesError.details || {},
    });
  }

  if (ledgerError) {
    warnings.push({
      entity: 'GeneralLedgerActivities',
      message: 'Entity ini gagal dimuat, sehingga actual/realisasi finance sementara diisi 0.',
      details: ledgerError.details || {},
    });
  }

  return {
    schema_version: SCHEMA_VERSION,
    domain: 'finance',
    mode: sourcePreview.BudgetPlanningEntries.mode,
    mapping_status: {
      ready_for_dashboard: true,
      note:
        warnings.length > 0
          ? 'Finance dashboard tetap dibentuk dari source D365 yang berhasil dimuat. Entity yang timeout tidak lagi menjatuhkan seluruh response.'
          : 'Finance dashboard contract dibentuk dari field source D365. Nilai yang tidak punya field pendukung eksplisit dibiarkan 0 agar tidak heuristik.',
    },
    slicer: {
      available_years: availableYears,
      selected_year: selectedYear,
    },
    source_counts: {
      BudgetPlanningEntries: sourcePreview.BudgetPlanningEntries.count,
      KREBudgetPlanningEntriesLines: sourcePreview.KREBudgetPlanningEntriesLines.count,
      GeneralLedgerActivities: sourcePreview.GeneralLedgerActivities.count,
    },
    canonical_schema: {
      budgetPlanFact: CANONICAL_SCHEMA.budgetPlanFact,
      ledgerActivityFact: CANONICAL_SCHEMA.ledgerActivityFact,
    },
    source_metadata: {
      BudgetPlanningEntries: {
        selected_fields: sourcePreview.BudgetPlanningEntries.selectedFields,
        filter: sourcePreview.BudgetPlanningEntries.filter,
        has_next_page: Boolean(sourcePreview.BudgetPlanningEntries.nextLink),
      },
      KREBudgetPlanningEntriesLines: {
        selected_fields: sourcePreview.KREBudgetPlanningEntriesLines.selectedFields,
        filter: sourcePreview.KREBudgetPlanningEntriesLines.filter,
        has_next_page: Boolean(sourcePreview.KREBudgetPlanningEntriesLines.nextLink),
        error: budgetLinesError,
      },
      GeneralLedgerActivities: {
        selected_fields: sourcePreview.GeneralLedgerActivities.selectedFields,
        filter: sourcePreview.GeneralLedgerActivities.filter,
        has_next_page: Boolean(sourcePreview.GeneralLedgerActivities.nextLink),
        error: ledgerError,
      },
    },
    warnings,
    data: {
      budget_plan_headers: budgetHeaders,
      budget_plan_lines: budgetLines,
      ledger_activities: ledgerActivities,
      dashboard_contract: dashboardContract,
    },
  };
}
