import { buildRawPreviewSummary } from '../domain/debug/raw-preview.js';
import { getFinanceSourcePreview } from '../services/d365/finance.repository.js';
import { getProcurementSourcePreview } from '../services/d365/procurement.repository.js';

export const debugRoutes = [
  {
    method: 'GET',
    path: '/api/erp/debug/finance',
    handler: async () => {
      const sourcePreview = await getFinanceSourcePreview();
      return buildRawPreviewSummary(sourcePreview, 'finance');
    },
  },
  {
    method: 'GET',
    path: '/api/erp/debug/procurement',
    handler: async () => {
      const sourcePreview = await getProcurementSourcePreview();
      return buildRawPreviewSummary(sourcePreview, 'procurement');
    },
  },
];
