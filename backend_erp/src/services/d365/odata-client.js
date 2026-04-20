import { env } from '../../config/env.js';
import { fetchJson } from '../../lib/request.js';
import { getAccessToken } from './token-service.js';

function normalizeBaseUrl(value) {
  return value
    .replace(/\/+$/, '')
    .replace(/\/data$/i, '');
}

function buildEntityUrl(entityName, options = {}) {
  const url = new URL(`${normalizeBaseUrl(env.d365BaseUrl)}/data/${entityName}`);

  if (options.top) {
    url.searchParams.set('$top', String(options.top));
  }

  if (options.select && options.select.length > 0) {
    url.searchParams.set('$select', options.select.join(','));
  }

  if (options.filter) {
    url.searchParams.set('$filter', options.filter);
  }

  url.searchParams.set('cross-company', 'true');

  return url.toString();
}

async function fetchOdataPage(url, token, top, timeoutMs) {
  return fetchJson(
    url,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'OData-Version': '4.0',
        'OData-MaxVersion': '4.0',
        Prefer: `odata.maxpagesize=${top || env.previewTop}`,
      },
    },
    timeoutMs || env.requestTimeoutMs
  );
}

export async function fetchEntityPreview(entityName, options = {}) {
  if (env.useMockData) {
    return {
      entityName,
      records: [],
      count: 0,
      nextLink: null,
      mode: 'mock',
      selectedFields: options.select || [],
      filter: options.filter || '',
    };
  }

  const token = await getAccessToken();
  const initialUrl = buildEntityUrl(entityName, options);
  const maxPages = options.maxPages || 10;
  let nextUrl = initialUrl;
  let pageCount = 0;
  const records = [];
  let lastNextLink = null;

  while (nextUrl && pageCount < maxPages) {
    const data = await fetchOdataPage(
      nextUrl,
      token,
      options.top || env.previewTop,
      options.timeoutMs || env.requestTimeoutMs
    );

    records.push(...(Array.isArray(data.value) ? data.value : []));
    lastNextLink = data['@odata.nextLink'] || null;
    pageCount += 1;

    if (!options.allPages || !lastNextLink) {
      break;
    }

    nextUrl = lastNextLink;
  }

  return {
    entityName,
    records,
    count: records.length,
    nextLink: lastNextLink,
    mode: 'live',
    selectedFields: options.select || [],
    filter: options.filter || '',
  };
}
