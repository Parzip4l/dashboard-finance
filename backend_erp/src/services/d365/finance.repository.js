import { env } from '../../config/env.js';
import { getEntityConfig } from '../../config/source-tables.js';
import { fetchEntityPreview } from './odata-client.js';

const ledgerCompanyCache = new Map();

function mergeFilters(...filters) {
  return filters
    .map((filter) => String(filter || '').trim())
    .filter(Boolean)
    .join(' and ');
}

function buildFinanceYearFilter(selectedYear) {
  return selectedYear ? `Year eq '${selectedYear}'` : '';
}

function buildFinanceCompanyFilter(entityName) {
  if (entityName === 'GeneralLedgerActivities') {
    return '';
  }

  if (!env.d365Company) {
    return '';
  }

  return `dataAreaId eq '${String(env.d365Company).toLowerCase()}'`;
}

function buildGeneralLedgerYearFilter(entityName, selectedYear) {
  if (entityName !== 'GeneralLedgerActivities' || !selectedYear) {
    return '';
  }

  const currentYear = new Date().getUTCFullYear();
  const yearOffset = selectedYear - currentYear;

  return `YearOffset eq ${yearOffset}`;
}

function quoteFilterValue(value) {
  if (typeof value === 'number') {
    return String(value);
  }

  return `'${String(value).replace(/'/g, "''")}'`;
}

function chunkValues(values, size = 20) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

async function getLedgerCompany(entityCode) {
  const normalized = String(entityCode || '').trim().toUpperCase();
  if (!normalized) {
    return null;
  }

  if (ledgerCompanyCache.has(normalized)) {
    return ledgerCompanyCache.get(normalized);
  }

  const result = await fetchEntityPreview('Ledgers', {
    top: 1,
    select: ['LedgerRecId', 'LegalEntityId', 'Name', 'Description', 'ChartOfAccounts'],
    filter: `LegalEntityId eq '${normalized}'`,
    timeoutMs: Math.max(env.requestTimeoutMs, 30000),
    allPages: false,
    maxPages: 1,
  });

  const ledger = result.records?.[0] || null;
  ledgerCompanyCache.set(normalized, ledger);
  return ledger;
}

async function fetchLookupRecords(entityName, idField, ids, select) {
  if (!ids.length) {
    return [];
  }

  const chunks = chunkValues(ids, 20);
  const records = [];

  for (const chunk of chunks) {
    const filter = chunk.map((value) => `${idField} eq ${quoteFilterValue(value)}`).join(' or ');
    const result = await fetchEntityPreview(entityName, {
      top: chunk.length,
      select,
      filter,
      timeoutMs: Math.max(env.requestTimeoutMs, 30000),
      allPages: false,
      maxPages: 1,
    });

    records.push(...(result.records || []));
  }

  return records;
}

async function buildGeneralLedgerLookups(records) {
  const mainAccountIds = Array.from(
    new Set(
      records
        .map((record) => record.MainAccountRecId)
        .filter((value) => value !== null && value !== undefined && value !== '')
    )
  );
  const ledgerDimensionIds = Array.from(
    new Set(
      records
        .map((record) => record.LedgerDimension)
        .filter((value) => value !== null && value !== undefined && value !== '')
    )
  );
  const ledgerIds = Array.from(
    new Set(records.map((record) => record.Ledger).filter((value) => value !== null && value !== undefined && value !== ''))
  );

  const [mainAccounts, dimensionCombinations, ledgers] = await Promise.all([
    fetchLookupRecords('MainAccounts', 'MainAccountRecId', mainAccountIds, [
      'MainAccountRecId',
      'MainAccountId',
      'Name',
      'ChartOfAccounts',
      'MainAccountType',
    ]),
    fetchLookupRecords('DimensionCombinations', 'RecordId', ledgerDimensionIds, [
      'RecordId',
      'DisplayValue',
      'MainAccount',
      'J01_Department',
      'P01_Departemen',
      'I03_Department',
      'D02_Divisi',
      'L01_Division',
      'I01_BusinessUnit',
      'P02_SBU',
    ]),
    fetchLookupRecords('Ledgers', 'LedgerRecId', ledgerIds, [
      'LedgerRecId',
      'LegalEntityId',
      'Name',
      'Description',
      'ChartOfAccounts',
    ]),
  ]);

  return {
    MainAccounts: mainAccounts,
    DimensionCombinations: dimensionCombinations,
    Ledgers: ledgers,
  };
}

function buildBudgetHeaderVersionFilter(entityName) {
  if (entityName !== 'BudgetPlanningEntries') {
    return '';
  }

  return `Version eq 'Proposal'`;
}

function buildAttemptTops(config) {
  const requestedTop = config.top || env.previewTop;
  const candidates = [requestedTop];

  if (requestedTop > 100) {
    candidates.push(100);
  }

  if (requestedTop > 50) {
    candidates.push(50);
  }

  if (requestedTop > 25) {
    candidates.push(25);
  }

  candidates.push(10);

  return Array.from(new Set(candidates.filter((value) => value > 0)));
}

function isOptionalFinanceEntity(entityName) {
  return entityName === 'KREBudgetPlanningEntriesLines' || entityName === 'GeneralLedgerActivities';
}

function buildFinanceSelect(entityName, config) {
  if (config.select?.length) {
    return config.select;
  }

  if (entityName !== 'GeneralLedgerActivities') {
    return config.select;
  }

  return [
    'LedgerDimension',
    'MainAccountRecId',
    'Ledger',
    'PostingLayer',
    'LedgerGregorianDateId',
    'AccountingCurrencyAmount',
    'AnalysisCurrencyAmount',
    'ReportingCurrencyAmount',
    'YearOffset',
    'TotalRevenue',
    'AccountsPayable',
    'QuickRatioAssets',
    'CurrentRatioAssets',
    'Liabilities',
    'ReturnOnTotalAssetsExpenses',
    'SalesReturnAndDiscounts',
    'AccountsReceivable',
    'Cash',
    'TotalAssets',
    'Equity',
    'CurrentLiabilities',
    'OperatingExpenses',
    'ProfitMarginTaxes',
    'Sales',
    'SalesPlusReturnsAndDiscounts',
    'CostOfGoodsSold',
    'AdditionalEarnings',
    'Expenses',
    'Income',
  ];
}

async function fetchFinanceEntityWithFallback(entityName, selectedYear = null) {
  const config = getEntityConfig(entityName);
  const yearFilter =
    entityName === 'GeneralLedgerActivities' ? '' : buildFinanceYearFilter(selectedYear);
  const ledgerYearFilter = buildGeneralLedgerYearFilter(entityName, selectedYear);
  const ledgerCompany = entityName === 'GeneralLedgerActivities' ? await getLedgerCompany(env.d365Company) : null;
  const companyFilter =
    entityName === 'GeneralLedgerActivities' && ledgerCompany?.LedgerRecId
      ? `Ledger eq ${ledgerCompany.LedgerRecId}`
      : buildFinanceCompanyFilter(entityName);
  const versionFilter = buildBudgetHeaderVersionFilter(entityName);
  const select = buildFinanceSelect(entityName, config);
  const mergedFilter = mergeFilters(config.filter, yearFilter, ledgerYearFilter, companyFilter, versionFilter);

  if (entityName === 'GeneralLedgerActivities' && env.skipGeneralLedgerActivities) {
    return buildSoftFailurePreview(entityName, config, {
      message: 'Skipped GeneralLedgerActivities fetch.',
      statusCode: 299,
      details: {
        reason: 'Disabled by D365_SKIP_GENERAL_LEDGER_ACTIVITIES to keep finance endpoint responsive.',
      },
    });
  }

  if (entityName === 'BudgetPlanningEntries') {
    const result = await fetchEntityPreview(entityName, {
      top: config.top || env.previewTop,
      select,
      filter: mergedFilter,
      timeoutMs: config.timeoutMs || env.requestTimeoutMs,
      allPages: Boolean(selectedYear),
      maxPages: 20,
    });

    return [entityName, result];
  }

  const attemptTops = buildAttemptTops(config);
  let lastError = null;

  for (const top of attemptTops) {
    try {
      const result = await fetchEntityPreview(entityName, {
        top: entityName === 'GeneralLedgerActivities' ? Math.min(top, 50) : top,
        select,
        filter: mergedFilter,
        timeoutMs:
          entityName === 'GeneralLedgerActivities'
            ? config.timeoutMs || Math.max(env.requestTimeoutMs, 45000)
            : config.timeoutMs || Math.max(env.requestTimeoutMs, 30000),
        allPages: entityName === 'GeneralLedgerActivities' ? false : false,
        maxPages: 1,
      });

      return [
        entityName,
        {
          ...result,
          requestedTop: config.top || env.previewTop,
          effectiveTop: top,
        },
      ];
    } catch (error) {
      lastError = error;

      if (error?.statusCode !== 504) {
        throw error;
      }
    }
  }

  throw lastError;
}

function buildSoftFailurePreview(entityName, config, error) {
  return [
    entityName,
    {
      entityName,
      records: [],
      count: 0,
      nextLink: null,
      mode: 'live_partial',
      selectedFields: config.select || [],
      filter: config.filter || '',
      requestedTop: config.top || env.previewTop,
      effectiveTop: 0,
      error: {
        message: error.message || 'Failed to fetch entity preview.',
        statusCode: error.statusCode || 500,
        details: error.details || {},
      },
    },
  ];
}

export async function getFinanceSourcePreview(selectedYear = null) {
  const entities = [
    'BudgetPlanningEntries',
    'KREBudgetPlanningEntriesLines',
    'GeneralLedgerActivities',
  ];

  const previews = await Promise.all(
    entities.map(async (entityName) => {
      try {
        return await fetchFinanceEntityWithFallback(entityName, selectedYear);
      } catch (error) {
        if (!isOptionalFinanceEntity(entityName)) {
          throw error;
        }

        return buildSoftFailurePreview(entityName, getEntityConfig(entityName), error);
      }
    })
  );

  const previewObject = Object.fromEntries(previews);

  if (previewObject.GeneralLedgerActivities?.records?.length) {
    const lookups = await buildGeneralLedgerLookups(previewObject.GeneralLedgerActivities.records);
    previewObject.MainAccounts = {
      entityName: 'MainAccounts',
      records: lookups.MainAccounts,
      count: lookups.MainAccounts.length,
      nextLink: null,
      mode: 'live',
      selectedFields: ['MainAccountRecId', 'MainAccountId', 'Name', 'ChartOfAccounts', 'MainAccountType'],
      filter: 'Lookup by MainAccountRecId from GeneralLedgerActivities',
    };
    previewObject.DimensionCombinations = {
      entityName: 'DimensionCombinations',
      records: lookups.DimensionCombinations,
      count: lookups.DimensionCombinations.length,
      nextLink: null,
      mode: 'live',
      selectedFields: [
        'RecordId',
        'DisplayValue',
        'MainAccount',
        'J01_Department',
        'P01_Departemen',
        'I03_Department',
        'D02_Divisi',
        'L01_Division',
        'I01_BusinessUnit',
        'P02_SBU',
      ],
      filter: 'Lookup by RecordId from GeneralLedgerActivities.LedgerDimension',
    };
    previewObject.Ledgers = {
      entityName: 'Ledgers',
      records: lookups.Ledgers,
      count: lookups.Ledgers.length,
      nextLink: null,
      mode: 'live',
      selectedFields: ['LedgerRecId', 'LegalEntityId', 'Name', 'Description', 'ChartOfAccounts'],
      filter: 'Lookup by LedgerRecId from GeneralLedgerActivities.Ledger',
    };
  }

  return previewObject;
}
