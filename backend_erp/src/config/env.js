import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

loadEnvFile(path.join(projectRoot, '.env'));

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex < 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();

    if (!key || process.env[key] !== undefined) {
      continue;
    }

    process.env[key] = stripQuotes(rawValue);
  }
}

function stripQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function readBoolean(name, fallback = false) {
  const value = process.env[name];
  if (value === undefined) {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function readInteger(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === '') {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be an integer.`);
  }

  return parsed;
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

const useMockData = readBoolean('D365_MOCK_MODE', true);

export const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: readInteger('ERP_BACKEND_PORT', 5100),
  corsOrigin: process.env.ERP_CORS_ORIGIN || '*',
  requestTimeoutMs: readInteger('ERP_REQUEST_TIMEOUT_MS', 15000),
  previewTop: readInteger('ERP_PREVIEW_TOP', 50),
  useMockData,
  skipGeneralLedgerActivities: readBoolean('D365_SKIP_GENERAL_LEDGER_ACTIVITIES', true),
  d365BaseUrl: useMockData ? '' : requireEnv('D365_BASE_URL'),
  d365TenantId: useMockData ? '' : requireEnv('D365_TENANT_ID'),
  d365ClientId: useMockData ? '' : requireEnv('D365_CLIENT_ID'),
  d365ClientSecret: useMockData ? '' : requireEnv('D365_CLIENT_SECRET'),
  d365Scope: useMockData ? '' : requireEnv('D365_SCOPE'),
  d365Company: process.env.D365_COMPANY || '',
});

export function getPublicEnv() {
  return {
    nodeEnv: env.nodeEnv,
    port: env.port,
    corsOrigin: env.corsOrigin,
    requestTimeoutMs: env.requestTimeoutMs,
    previewTop: env.previewTop,
    useMockData: env.useMockData,
    skipGeneralLedgerActivities: env.skipGeneralLedgerActivities,
    d365BaseUrlConfigured: Boolean(env.d365BaseUrl),
    d365CompanyConfigured: Boolean(env.d365Company),
  };
}
