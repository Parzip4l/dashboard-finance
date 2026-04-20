export function pickFirst(record, keys, fallback = null) {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null && record[key] !== '') {
      return record[key];
    }
  }

  return fallback;
}

export function toNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const normalized = typeof value === 'string' ? value.replace(/,/g, '') : value;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function toIsoDate(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function toInteger(value, fallback = null) {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export function inferOrg(record) {
  return {
    company_code: pickFirst(record, ['DataAreaId', 'dataAreaId', 'Company', 'LegalEntityId'], null),
    department_code: pickFirst(
      record,
      ['DepartmentCode', 'departmentCode', 'CostCenter', 'Department', 'DimensionDepartment'],
      null
    ),
    department_name: pickFirst(
      record,
      ['DepartmentName', 'departmentName', 'CostCenterName', 'DepartmentDescription'],
      null
    ),
    division_code: pickFirst(record, ['DivisionCode', 'divisionCode', 'BusinessUnitCode'], null),
    division_name: pickFirst(record, ['DivisionName', 'divisionName', 'BusinessUnitName'], null),
  };
}
