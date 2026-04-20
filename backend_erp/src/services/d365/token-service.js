import { env } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';
import { fetchJson } from '../../lib/request.js';

let cachedToken = null;
let cachedTokenExpiresAt = 0;

export async function getAccessToken() {
  if (env.useMockData) {
    return 'mock-token';
  }

  const now = Date.now();
  if (cachedToken && now < cachedTokenExpiresAt - 60_000) {
    return cachedToken;
  }

  const tokenUrl = `https://login.microsoftonline.com/${env.d365TenantId}/oauth2/v2.0/token`;
  const params = new URLSearchParams();
  params.append('client_id', env.d365ClientId);
  params.append('client_secret', env.d365ClientSecret);
  params.append('scope', env.d365Scope);
  params.append('grant_type', 'client_credentials');

  const data = await fetchJson(
    tokenUrl,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    },
    env.requestTimeoutMs
  );

  if (!data.access_token) {
    throw new AppError(502, 'Dynamics 365 token response is missing access_token.');
  }

  cachedToken = data.access_token;
  cachedTokenExpiresAt = Date.now() + (Number(data.expires_in || 3600) * 1000);
  return cachedToken;
}
