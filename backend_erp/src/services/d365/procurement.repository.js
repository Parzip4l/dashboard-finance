import { env } from '../../config/env.js';
import { getEntityConfig } from '../../config/source-tables.js';
import { fetchEntityPreview } from './odata-client.js';

function mergeFilters(...filters) {
  return filters
    .map((filter) => String(filter || '').trim())
    .filter(Boolean)
    .join(' and ');
}

function buildProcurementYearFilter(entityName, selectedYear) {
  if (!selectedYear) {
    return '';
  }

  const nextYear = selectedYear + 1;

  if (entityName === 'PurchaseRequisitionHeaders') {
    return `DefaultRequestedDate ge ${selectedYear}-01-01T00:00:00Z and DefaultRequestedDate lt ${nextYear}-01-01T00:00:00Z`;
  }

  if (entityName === 'PurchaseRequisitionLinesV2') {
    return `RequestedDate ge ${selectedYear}-01-01T00:00:00Z and RequestedDate lt ${nextYear}-01-01T00:00:00Z`;
  }

  return '';
}

function buildProcurementCompanyFilter(entityName) {
  if (!env.d365Company) {
    return '';
  }

  const companyCode = String(env.d365Company).trim();
  const dataAreaId = companyCode.toLowerCase();
  const legalEntityId = companyCode.toUpperCase();

  if (entityName === 'PurchaseRequisitionLinesV2') {
    return `BuyingLegalEntityId eq '${legalEntityId}'`;
  }

  if (entityName === 'ProcurementPlanTables' || entityName === 'ProcurementPlanDetails') {
    return `dataAreaId eq '${dataAreaId}'`;
  }

  return '';
}

function pickPrNo(record) {
  return (
    record?.PurchaseRequisitionNumber ||
    record?.PRNumber ||
    record?.RequisitionNumber ||
    null
  );
}

function filterHeadersByLrtLines(headersPreview, linesPreview) {
  if (!env.d365Company) {
    return headersPreview;
  }

  const allowedPrNos = new Set(
    (linesPreview?.records || []).map((record) => pickPrNo(record)).filter(Boolean)
  );

  if (allowedPrNos.size === 0) {
    return {
      ...headersPreview,
      records: [],
      count: 0,
    };
  }

  const filteredRecords = (headersPreview?.records || []).filter((record) =>
    allowedPrNos.has(pickPrNo(record))
  );

  return {
    ...headersPreview,
    records: filteredRecords,
    count: filteredRecords.length,
  };
}

export async function getProcurementSourcePreview(selectedYear = null) {
  const entities = [
    'PurchaseRequisitionHeaders',
    'PurchaseRequisitionLinesV2',
    'ProcurementPlanTables',
    'ProcurementPlanDetails',
  ];

  const previews = await Promise.all(
    entities.map(async (entityName) => {
      const config = getEntityConfig(entityName);
      const yearFilter = buildProcurementYearFilter(entityName, selectedYear);
      const companyFilter = buildProcurementCompanyFilter(entityName);
      const mergedFilter = mergeFilters(config.filter, yearFilter, companyFilter);
      const result = await fetchEntityPreview(entityName, {
        top: env.previewTop,
        select: config.select,
        filter: mergedFilter,
        allPages: entityName === 'ProcurementPlanDetails' || entityName === 'PurchaseRequisitionLinesV2' || entityName === 'PurchaseRequisitionHeaders',
        maxPages: 20,
      });

      return [entityName, result];
    })
  );
  const sourcePreview = Object.fromEntries(previews);

  sourcePreview.PurchaseRequisitionHeaders = filterHeadersByLrtLines(
    sourcePreview.PurchaseRequisitionHeaders,
    sourcePreview.PurchaseRequisitionLinesV2
  );

  return sourcePreview;
}
