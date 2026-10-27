import {
  CANONICAL_SCHEMA,
  SCHEMA_VERSION,
  createEmptyFinanceDashboardContract,
} from '../../config/canonical-schema.js';
import { env } from '../../config/env.js';
import { inferOrg, pickFirst, toInteger, toIsoDate, toNumber } from './shared.js';

const FINANCE_CATEGORIES = ['SUBSIDI', 'BUSDEV', 'CORPORATE_COST'];
const DISALLOWED_FINANCE_ORG_TOKENS = ['jakpro'];
const RAB_CATEGORY_BY_CODE = new Map([
  ['S', 'SUBSIDI'],
  ['B', 'BUSDEV'],
  ['N', 'CORPORATE_COST'],
]);
const APPROVED_STATUS_TOKENS = ['approved', 'approve'];
const REVISION_TOKENS = ['revision', 'revisi'];
const PROPOSAL_TOKENS = ['proposal'];
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

function normalizeFieldName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function hasValue(value) {
  return value !== null && value !== undefined && value !== '';
}

function pickFlexible(record, keys, fallback = null) {
  const entries = Object.entries(record || {});

  for (const key of keys) {
    if (hasValue(record?.[key])) {
      return record[key];
    }

    const normalizedKey = normalizeFieldName(key);
    const matchedEntry = entries.find(([entryKey, entryValue]) => {
      return normalizeFieldName(entryKey) === normalizedKey && hasValue(entryValue);
    });

    if (matchedEntry) {
      return matchedEntry[1];
    }
  }

  return fallback;
}

function extractDigits(value) {
  const matched = String(value || '').match(/-?\d+/);
  return matched ? Number.parseInt(matched[0], 10) : null;
}

function textIncludesAny(value, tokens) {
  const normalized = normalizeText(value);
  return tokens.some((token) => normalized.includes(token));
}

function categoryFromRabCode(value) {
  const normalized = String(value || '').trim().toUpperCase();
  if (!normalized) {
    return null;
  }

  const direct = RAB_CATEGORY_BY_CODE.get(normalized);
  if (direct) {
    return direct;
  }

  const firstLetter = normalized[0];
  return RAB_CATEGORY_BY_CODE.get(firstLetter) || null;
}

function extractRabCode(record) {
  const direct = pickFlexible(
    record,
    ['rab_code', 'RABCode', 'RAB', 'KodeRAB', 'Kode RAB', 'LedgerDimensionRAB', 'Ledger dimension RAB'],
    null
  );

  if (hasValue(direct)) {
    return String(direct).trim().toUpperCase();
  }

  const dimensionText = pickFlexible(
    record,
    [
      'LedgerDimensionDisplayValue',
      'DefaultDimensionDisplayValue',
      'LedgerDimension',
      'BudgetDimension',
      'DimensionDisplayValue',
      'ledger_dimension_display',
    ],
    ''
  );
  const matched = String(dimensionText || '').match(/\b([BSN])\b/);
  return matched ? matched[1].toUpperCase() : null;
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
      version_number: toInteger(
        pickFlexible(record, ['VersionNumber', 'VersionNo', 'VersionSequence', 'RevisionNumber'], null),
        extractDigits(pickFirst(record, ['Version', 'Scenario', 'BudgetScenario'], null))
      ),
      account_code: pickFirst(record, ['MainAccountId', 'AccountCode', 'MainAccount', 'BudgetCode'], null),
      account_name: pickFirst(
        record,
        ['MainAccountName', 'AccountName', 'MainAccountDescription', 'DepartmentName', 'DivisionName'],
        null
      ),
      rab_code: extractRabCode(record),
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
      version_number: toInteger(
        pickFlexible(record, ['VersionNumber', 'VersionNo', 'VersionSequence', 'RevisionNumber'], null),
        extractDigits(pickFirst(record, ['Version', 'Scenario', 'BudgetScenario'], null))
      ),
      account_code: pickFirst(record, ['BudgetCode', 'MainAccountId', 'AccountCode', 'MainAccount'], null),
      account_name: pickFirst(
        record,
        ['CodeName', 'Descriptions', 'MainAccountName', 'AccountName', 'MainAccountDescription'],
        null
      ),
      rab_code: extractRabCode(record),
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

function inferBudgetControlOrg(record) {
  const baseOrg = inferFinanceOrg(record);

  return {
    ...baseOrg,
    department_code: pickFlexible(
      record,
      ['ActDepartmentCode', 'DepartmentCode', 'Department', 'J01_Department', 'P01_Departemen', 'I03_Department'],
      baseOrg.department_code
    ),
    department_name: pickFlexible(
      record,
      ['ActDepartment', 'DepartmentName', 'DepartmentDescription'],
      baseOrg.department_name
    ),
    division_code: pickFlexible(
      record,
      ['DivisionCode', 'D02_Divisi', 'L01_Division', 'I01_BusinessUnit', 'P02_SBU'],
      baseOrg.division_code
    ),
    division_name: pickFlexible(record, ['ActDivision', 'DivisionName', 'BusinessUnitName'], baseOrg.division_name),
  };
}

function classifyBudgetControlCategory(record) {
  const categoryFromCode = categoryFromRabCode(
    extractRabCode(record) ||
      pickFlexible(record, ['BudgetCode', 'budget_type', 'account_code', 'account_name'], null)
  );
  if (categoryFromCode) {
    return categoryFromCode;
  }

  const textBlob = [
    record.department_name,
    record.division_name,
    record.account_name,
    record.ledger_dimension_display,
    record.account_code,
    record.budget_type,
  ]
    .map(normalizeText)
    .join(' ');

  if (textBlob.includes('corporate cost')) {
    return 'CORPORATE_COST';
  }

  if (textBlob.includes('busdev') || textBlob.includes('business development')) {
    return 'BUSDEV';
  }

  if (textBlob.includes('subsidi') || textBlob.includes('subsidy')) {
    return 'SUBSIDI';
  }

  return classifyFinanceCategory(record);
}

function classifyBudgetControlBucket(record) {
  const mainAccount = String(record.account_code || '').trim();
  const accountText = `${mainAccount} ${record.account_name || ''} ${record.ledger_dimension_display || ''}`.toLowerCase();

  if (/^1\d*/.test(mainAccount)) {
    return 'CAPEX';
  }

  if (accountText.includes('verifikasi')) {
    return 'VERIFIKASI';
  }

  return 'PPA_SPUK_KK';
}

function normalizeBudgetControlStatistics(records, syncAt) {
  return records.map((record, index) => {
    const org = inferBudgetControlOrg(record);
    const derivedPeriod = derivePeriodFromDate(
      pickFlexible(record, ['AccountingDate', 'PostingDate', 'CreatedDateTime', 'ApprovedDateTime'], null)
    );

    const actualAmount = toNumber(
      pickFlexible(
        record,
        [
          'ConsumedAmount',
          'ActualAmount',
          'UsedBudgetFunds',
          'UsedAmount',
          'Amount',
          'AccountingCurrencyAmount',
        ],
        0
      ),
      0
    );
    const availableAmount = toNumber(
      pickFlexible(
        record,
        [
          'TotalBudgetFundsAvailable',
          'BudgetFundsAvailable',
          'AvailableBudgetFunds',
          'RemainingBudgetFunds',
          'RemainingAmount',
        ],
        0
      ),
      0
    );
    const absorptionPercent = toNumber(
      pickFlexible(record, ['Percentage', 'UtilizationPercent', 'PenyerapanPercent'], null),
      null
    );

    const normalized = {
      source_id:
        pickFlexible(record, ['RecId', 'Id', 'BudgetControlStatisticId'], null) || `bcs:${index + 1}`,
      source_table: 'Budget Control Statistic',
      fiscal_year: toInteger(pickFlexible(record, ['FiscalYear', 'BudgetYear', 'Year'], derivedPeriod.fiscalYear)),
      period_month: toInteger(pickFlexible(record, ['PeriodMonth', 'Month'], derivedPeriod.periodMonth)),
      ...org,
      version: pickFlexible(record, ['Version', 'Scenario', 'BudgetScenario'], null),
      version_number: toInteger(
        pickFlexible(record, ['VersionNumber', 'VersionNo', 'VersionSequence', 'RevisionNumber'], null),
        extractDigits(pickFlexible(record, ['Version', 'Scenario'], null))
      ),
      status: pickFlexible(record, ['ApprovalStatus', 'Status', 'WorkflowStatus'], null),
      account_code: pickFlexible(record, ['MainAccountId', 'MainAccount', 'BudgetCode', 'AccountCode'], null),
      account_name: pickFlexible(record, ['MainAccountName', 'AccountName'], null),
      budget_type: pickFlexible(record, ['BudgetModel', 'BudgetType', 'Type'], null),
      ledger_dimension: pickFlexible(record, ['LedgerDimension'], null),
      ledger_dimension_display: pickFlexible(
        record,
        ['LedgerDimensionDisplayValue', 'DefaultDimensionDisplayValue', 'DimensionDisplayValue'],
        null
      ),
      rab_code: extractRabCode(record),
      actual_amount: actualAmount,
      available_amount: availableAmount,
      absorption_percent: absorptionPercent,
      sync_at: syncAt,
    };

    return {
      ...normalized,
      category: classifyBudgetControlCategory(normalized),
      actual_bucket: classifyBudgetControlBucket(normalized),
    };
  });
}

function isScenarioRecord(record, tokens) {
  return textIncludesAny(record.scenario || record.version || record.budget_type, tokens);
}

function isApprovedRecord(record) {
  return textIncludesAny(record.status, APPROVED_STATUS_TOKENS);
}

function buildVersionGroupKey(record) {
  return [record.header_id, record.document_no, record.department_code, record.division_code, record.rab_code]
    .filter(Boolean)
    .join('::');
}

function selectLatestRevisionRecords(records) {
  const approvedRevisions = records.filter((record) => isScenarioRecord(record, REVISION_TOKENS) && isApprovedRecord(record));
  if (!approvedRevisions.length) {
    return [];
  }

  const grouped = new Map();

  for (const record of approvedRevisions) {
    const groupKey = buildVersionGroupKey(record) || `ungrouped:${record.source_id}`;
    const current = grouped.get(groupKey);

    if (!current || (record.version_number || 0) >= (current.version_number || 0)) {
      grouped.set(groupKey, record);
    }
  }

  return Array.from(grouped.values());
}

function createDepartmentRow(record) {
  return {
    department_code: record.department_code || record.division_code || record.company_code || 'UNK',
    department_name: record.department_name || record.division_name || record.account_name || record.document_no || 'Unknown Department',
    division_code: record.division_code || record.company_code || 'UNK',
    division_name: record.division_name || record.company_code || 'UNKNOWN',
    kode: record.department_code || record.division_code || record.company_code || 'UNK',
    div: record.division_code || record.company_code || 'UNK',
    direktorat: record.division_name || record.company_code || 'UNKNOWN',
    departemen: record.department_name || record.division_name || record.account_name || record.document_no || 'Unknown Department',
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
    budget_control_available_total: 0,
    budget_control_penyerapan_persen: null,
  };
}

function buildFinanceDashboardContract(
  budgetHeaders,
  budgetLines,
  ledgerActivities,
  budgetControlStatistics,
  options = {}
) {
  const dashboard = createEmptyFinanceDashboardContract();
  const { availableYears, selectedYear } = getFinanceYearScope(options.selectedYear);

  if (!selectedYear) {
    return dashboard;
  }

  const departmentMap = new Map();
  const ensureDepartmentRow = (record) => {
    const key = buildDepartmentKey(record);
    const row = departmentMap.get(key) || createDepartmentRow(record);
    departmentMap.set(key, row);
    return row;
  };

  const proposalHeaders = budgetHeaders.filter(
    (record) =>
      record.fiscal_year === selectedYear &&
      isAllowedFinanceOrg(record) &&
      (isScenarioRecord(record, PROPOSAL_TOKENS) || !isScenarioRecord(record, REVISION_TOKENS))
  );

  for (const record of proposalHeaders) {
    const row = ensureDepartmentRow(record);
    const proposalCapex = toNumber(record.proposal_capex_amount, 0);
    const proposalOpex = toNumber(record.proposal_opex_amount, 0);
    const proposalTotal =
      toNumber(record.proposal_total_amount, 0) || proposalCapex + proposalOpex || toNumber(record.amount, 0);

    row.anggaran_proposal_capex += proposalCapex;
    row.anggaran_proposal_opex += proposalOpex;
    row.anggaran_proposal_total += proposalTotal;
  }

  if (!proposalHeaders.length) {
    for (const record of budgetLines) {
      if (
        record.fiscal_year !== selectedYear ||
        !isAllowedFinanceOrg(record) ||
        !isScenarioRecord(record, PROPOSAL_TOKENS)
      ) {
        continue;
      }

      const row = ensureDepartmentRow(record);
      row.anggaran_proposal_total += toNumber(record.amount, 0);
    }
  }

  const latestRevisionLines = selectLatestRevisionRecords(
    budgetLines.filter((record) => record.fiscal_year === selectedYear && isAllowedFinanceOrg(record))
  );

  for (const record of budgetHeaders) {
    if (record.fiscal_year !== selectedYear || !isAllowedFinanceOrg(record)) {
      continue;
    }

    const row = ensureDepartmentRow(record);
    row.anggaran_realokasi_2025_capex += toNumber(record.adjusted_capex_amount, 0);
    row.anggaran_realokasi_2025_opex += toNumber(record.adjusted_opex_amount, 0);
  }

  if (latestRevisionLines.length) {
    for (const record of latestRevisionLines) {
      const row = ensureDepartmentRow(record);
      row.anggaran_realokasi_2025_total += toNumber(record.amount, 0);
    }
  } else {
    for (const record of budgetHeaders) {
      if (record.fiscal_year !== selectedYear || !isAllowedFinanceOrg(record)) {
        continue;
      }

      const row = ensureDepartmentRow(record);
      row.anggaran_realokasi_2025_total += toNumber(record.adjusted_total_amount, 0);
    }
  }

  for (const record of budgetControlStatistics) {
    if (record.fiscal_year !== selectedYear || !isAllowedFinanceOrg(record)) {
      continue;
    }

    const row = ensureDepartmentRow(record);
    const actualAmount = toNumber(record.actual_amount, 0);

    if (record.actual_bucket === 'CAPEX') {
      row.realisasi_capex_total += actualAmount;
    } else if (record.actual_bucket === 'VERIFIKASI') {
      row.opex_verifikasi_total += actualAmount;
    } else {
      row.opex_ppa_spuk_kk_total += actualAmount;
    }

    row.budget_control_available_total += toNumber(record.available_amount, 0);

    if (record.absorption_percent !== null && record.absorption_percent !== undefined) {
      row.budget_control_penyerapan_persen = toNumber(record.absorption_percent, 0);
    }
  }

  const hasBudgetControlActuals = budgetControlStatistics.some(
    (record) => record.fiscal_year === selectedYear && isAllowedFinanceOrg(record)
  );

  if (!hasBudgetControlActuals) {
    for (const record of ledgerActivities) {
      if (record.fiscal_year !== selectedYear || !isAllowedFinanceOrg(record)) {
        continue;
      }

      const row = ensureDepartmentRow(record);
      const signedAmount = Math.abs(toNumber(record.amount, 0));

      if (/^1\d*/.test(String(record.account_code || '').trim())) {
        row.realisasi_capex_total += signedAmount;
      } else {
        row.opex_ppa_spuk_kk_total += signedAmount;
      }
    }
  }

  const departments = Array.from(departmentMap.values())
    .map((row) => {
      row.penyerapan_total =
        row.realisasi_capex_total + row.opex_verifikasi_total + row.opex_ppa_spuk_kk_total;
      row.sisa_anggaran_total =
        row.budget_control_available_total > 0
          ? row.budget_control_available_total
          : row.anggaran_realokasi_2025_total - row.penyerapan_total;
      row.penyerapan_persen =
        row.budget_control_penyerapan_persen !== null && row.budget_control_penyerapan_persen !== undefined
          ? Number(row.budget_control_penyerapan_persen.toFixed(2))
          : row.anggaran_realokasi_2025_total > 0
            ? Number(((row.penyerapan_total / row.anggaran_realokasi_2025_total) * 100).toFixed(2))
            : 0;

      return {
        ...row,
        category: classifyBudgetControlCategory(row) || classifyFinanceCategory(row),
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
  const budgetControlStatistics = normalizeBudgetControlStatistics(
    sourcePreview['Budget Control Statistic']?.records || [],
    syncAt
  );
  const { availableYears, selectedYear } = getFinanceYearScope(options.selectedYear);
  const dashboardContract = buildFinanceDashboardContract(
    budgetHeaders,
    budgetLines,
    ledgerActivities,
    budgetControlStatistics,
    { selectedYear }
  );
  const budgetLinesError = sourcePreview.KREBudgetPlanningEntriesLines.error || null;
  const ledgerError = sourcePreview.GeneralLedgerActivities.error || null;
  const budgetControlError = sourcePreview['Budget Control Statistic']?.error || null;
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

  if (budgetControlError) {
    warnings.push({
      entity: 'Budget Control Statistic',
      message:
        'Entity Budget Control Statistic gagal dimuat. Realisasi, persen penyerapan, dan sisa anggaran akan fallback ke source yang tersedia.',
      details: budgetControlError.details || {},
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
      'Budget Control Statistic': sourcePreview['Budget Control Statistic']?.count || 0,
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
      'Budget Control Statistic': {
        selected_fields: sourcePreview['Budget Control Statistic']?.selectedFields || [],
        filter: sourcePreview['Budget Control Statistic']?.filter || '',
        has_next_page: Boolean(sourcePreview['Budget Control Statistic']?.nextLink),
        error: budgetControlError,
      },
    },
    warnings,
    data: {
      budget_plan_headers: budgetHeaders,
      budget_plan_lines: budgetLines,
      ledger_activities: ledgerActivities,
      budget_control_statistics: budgetControlStatistics,
      dashboard_contract: dashboardContract,
    },
  };
}
