import { CANONICAL_SCHEMA, SCHEMA_VERSION } from '../config/canonical-schema.js';
import { ERP_SOURCE_TABLES } from '../config/source-tables.js';

export const schemaRoutes = [
  {
    method: 'GET',
    path: '/api/erp/schema',
    handler: async () => ({
      schema_version: SCHEMA_VERSION,
      source_tables: ERP_SOURCE_TABLES,
      canonical_schema: CANONICAL_SCHEMA,
      recommended_flow: [
        'Dynamics 365 raw entity preview',
        'Normalization ke schema kanonik',
        'Validasi bisnis per kategori/divisi/departemen',
        'Transformasi ke contract dashboard existing',
      ],
      stability_principles: [
        'Backend lama tetap aktif sampai hasil ERP tervalidasi.',
        'Gunakan whitelist field per entity, bukan select semua kolom di production.',
        'Pisahkan raw preview dari payload dashboard.',
        'Hitung KPI hanya dari schema kanonik, bukan langsung dari tabel ERP mentah.',
      ],
    }),
  },
];
