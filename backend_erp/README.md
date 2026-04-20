# Backend ERP

`backend_erp` adalah jalur backend baru untuk integrasi Dynamics 365 tanpa mengganggu backend lama di `/backend`.

## Tujuan

- Menjaga stabilitas dashboard existing selama migrasi sumber data.
- Memisahkan konektor ERP dari parser Excel lama.
- Memaksa penggunaan schema kanonik agar frontend tidak bergantung pada bentuk tabel mentah ERP.
- Mengurangi risiko kebocoran data dengan field whitelisting, timeout request, dan sanitasi error.

## Endpoint

- `GET /health`
- `GET /api/erp/schema`
- `GET /api/erp/debug/finance`
- `GET /api/erp/debug/procurement`
- `GET /api/erp/finance/normalized`
- `GET /api/erp/procurement/normalized`

## Cara pakai

1. Salin `.env.example` menjadi `.env`.
2. Biarkan `D365_MOCK_MODE=true` untuk bootstrap lokal tanpa kredensial.
3. Jalankan `npm run dev:erp` dari root project atau `npm run dev` dari folder ini.
4. Setelah mapping field Dynamics 365 siap, ubah `D365_MOCK_MODE=false`.

## Prinsip stabilitas dan keamanan

- Backend lama tetap dipertahankan apa adanya sampai hasil ERP tervalidasi.
- Endpoint ERP baru hanya mengembalikan preview ternormalisasi, bukan dump mentah penuh.
- Kredensial tidak pernah ditulis ke response atau log.
- Response error disanitasi agar tidak membocorkan token, URL sensitif, atau detail payload.
- Field mentah sebaiknya dibatasi dengan variabel `*_SELECT` per entity.

## Struktur

- `src/config`: env, daftar source table, schema kanonik.
- `src/services/d365`: auth, OData client, repositories.
- `src/domain/transformers`: normalisasi ke schema bisnis.
- `src/routes`: endpoint health, schema, finance, procurement.

## Catatan penting

File `backend/.env` yang lama masih berisi kredensial. Karena sudah tersimpan di repo lokal, secret tersebut sebaiknya di-rotate dan dipindahkan ke secret manager atau environment deployment.
