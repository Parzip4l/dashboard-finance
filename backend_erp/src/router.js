import { env } from './config/env.js';
import { AppError, toErrorResponse } from './lib/errors.js';
import { sendJson, sendNoContent } from './lib/http.js';
import { logger } from './lib/logger.js';
import { debugRoutes } from './routes/debug.routes.js';
import { financeRoutes } from './routes/finance.routes.js';
import { healthRoutes } from './routes/health.routes.js';
import { procurementRoutes } from './routes/procurement.routes.js';
import { schemaRoutes } from './routes/schema.routes.js';

const routes = [
  ...healthRoutes,
  ...schemaRoutes,
  ...debugRoutes,
  ...financeRoutes,
  ...procurementRoutes,
];

export async function handleRequest(request, response) {
  if (request.method === 'OPTIONS') {
    sendNoContent(response, env.corsOrigin);
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  const route = routes.find((item) => item.method === request.method && item.path === url.pathname);

  if (!route) {
    sendJson(
      response,
      404,
      {
        error: {
          message: 'Route not found.',
          statusCode: 404,
        },
      },
      env.corsOrigin
    );
    return;
  }

  try {
    const payload = await route.handler({ request, response, url });
    sendJson(response, 200, payload, env.corsOrigin);
  } catch (error) {
    const normalizedError =
      error instanceof AppError ? error : new AppError(500, error.message || 'Unknown error');

    logger.error('Request failed', {
      method: request.method,
      path: url.pathname,
      statusCode: normalizedError.statusCode,
      message: normalizedError.message,
    });

    sendJson(response, normalizedError.statusCode, toErrorResponse(normalizedError), env.corsOrigin);
  }
}
