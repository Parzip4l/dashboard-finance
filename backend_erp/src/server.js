import { createServer } from 'node:http';
import { env, getPublicEnv } from './config/env.js';
import { logger } from './lib/logger.js';
import { handleRequest } from './router.js';

const server = createServer((request, response) => {
  handleRequest(request, response).catch((error) => {
    logger.error('Unhandled request failure', {
      message: error.message,
    });

    response.writeHead(500, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    response.end(
      JSON.stringify(
        {
          error: {
            message: 'Unhandled backend_erp error.',
            statusCode: 500,
          },
        },
        null,
        2
      )
    );
  });
});

server.listen(env.port, () => {
  logger.info('backend_erp server started', {
    service: 'backend_erp',
    ...getPublicEnv(),
  });
});
