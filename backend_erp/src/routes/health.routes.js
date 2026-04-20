import { SCHEMA_VERSION } from '../config/canonical-schema.js';
import { getPublicEnv } from '../config/env.js';

export const healthRoutes = [
  {
    method: 'GET',
    path: '/health',
    handler: async () => ({
      status: 'ok',
      service: 'backend_erp',
      schema_version: SCHEMA_VERSION,
      time: new Date().toISOString(),
      config: getPublicEnv(),
    }),
  },
];
