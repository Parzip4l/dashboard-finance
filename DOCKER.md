# Docker Setup

Skema ini memakai `backend_erp` sebagai backend utama.

## Hot Reload / Mirroring

Mode ini cocok untuk VM development atau staging yang ingin source code di host langsung tercermin ke container.

```bash
docker compose up --build
```

URL:

- Frontend: `http://<IP-VM>:8080`
- backend_erp: `http://<IP-VM>:5100`
- ERP Browser: `http://<IP-VM>:8080/erp-browser`

Yang terjadi:

- Folder project di-mount ke `/app`, jadi perubahan file langsung terbaca container.
- Frontend jalan dengan Vite HMR di port `8080`.
- `backend_erp` jalan dengan `node --watch backend_erp/src/server.js` di port `5100`.
- Frontend mem-proxy `/api` ke service Docker internal `http://backend_erp:5100`.

## Production-Like

Mode ini build frontend static lalu serve via Nginx. Backend tetap service terpisah.

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

URL:

- Frontend: `http://<IP-VM>:9060`
- backend_erp: `http://<IP-VM>:5100`

## Environment

Pastikan file berikut tersedia di VM:

```text
backend_erp/.env
```

Minimal variabel live ERP biasanya:

```bash
D365_MOCK_MODE=false
D365_BASE_URL=...
D365_TENANT_ID=...
D365_CLIENT_ID=...
D365_CLIENT_SECRET=...
D365_SCOPE=...
D365_COMPANY=lrtj
ERP_BACKEND_PORT=5100
ERP_CORS_ORIGIN=*
```

File `.env` tidak dimasukkan ke Docker image karena dibaca saat runtime melalui `env_file`.

## Command Berguna

```bash
docker compose logs -f backend_erp
docker compose logs -f frontend
docker compose restart backend_erp
docker compose down
```

Kalau dependency berubah, rebuild:

```bash
docker compose build --no-cache
docker compose up
```
