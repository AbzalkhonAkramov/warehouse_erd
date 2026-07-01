# Deployment Guide — Warehouse ERP

> 🇷🇺 На русском: **[DEPLOYMENT.ru.md](DEPLOYMENT.ru.md)**

How to deploy the whole system: **PostgreSQL database**, **FastAPI backend**,
**React web admin**, and the **Flutter mobile app** (plus Telegram).

---

## 1. Architecture at a glance

```
                         ┌─────────────────────────────┐
   Browser (admin) ─────▶│  web (nginx)  :80            │
                         │   serves the React SPA       │
                         │   proxies /api  → backend    │
                         │   proxies /uploads → backend │
                         └──────────────┬──────────────┘
                                        │ (internal network)
   Mobile app (agents) ─────────────────┤
   HTTPS → /api/v1                       ▼
                         ┌─────────────────────────────┐
                         │  backend (FastAPI)  :8000    │
                         │   - REST API                 │
                         │   - nightly archive job      │
                         │   - Telegram send (outbound) │
                         │   - /uploads (product/photos)│
                         └──────────────┬──────────────┘
                                        ▼
                         ┌─────────────────────────────┐
                         │  db (PostgreSQL 16)  :5432   │
                         │   volume: lh_warehouse_pgdata│
                         └─────────────────────────────┘
```

| Service   | Image / build     | Container port | Host port (compose) | Public? |
|-----------|-------------------|----------------|---------------------|---------|
| `db`      | `postgres:16`     | 5432           | 5433                | **No**  |
| `backend` | `./backend`       | 8000           | 8000                | Optional (behind web) |
| `web`     | `./web` (nginx)   | 80             | 5173                | **Yes** (put TLS in front) |

**Key facts**
- The **web container proxies `/api` and `/uploads`** to the backend, so the browser
  talks to a single origin (no CORS in production). In production you only need to
  expose the **web** service publicly; `backend` and `db` can stay internal.
- **Telegram is outbound-only** (the backend calls the Telegram API to send
  order alerts and before/after photo albums). There is **no separate bot process**.
- The **nightly archive** (00:00 Asia/Tashkent) and photo forwarding run **inside the
  backend process** — nothing extra to deploy.

---

## 2. Prerequisites

- A Linux host (or any machine) with **Docker** + **Docker Compose v2**.
- A domain name + TLS certificate for production (via a reverse proxy — see §7).
- For the mobile build: **Flutter SDK ≥ 3.5** on your build machine.

---

## 3. Configure secrets (`.env`)

Compose reads secrets from a **root `.env`** file (next to `docker-compose.yml`).
Create it from the example and fill real values:

```bash
cd warehouse-erp
cp .env.example .env      # then edit
```

Minimum for production:

```dotenv
# A long random string — rotate for prod:  openssl rand -hex 32
SECRET_KEY=<64-hex-chars>

# Telegram (optional; leave blank to disable notifications)
TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_MANAGER_CHAT_ID=-1001234567890

# Branding shown on receipts / login (also configurable in the super-admin UI)
COMPANY_NAME=Your Company
COMPANY_LOGO_URL=
```

> ⚠️ **Change the database password.** `docker-compose.yml` ships a default
> Postgres password (`abzal7727`) and puts it in `DATABASE_URL`. For production,
> replace **both** occurrences (the `db` service `POSTGRES_PASSWORD` and the
> `backend` `DATABASE_URL`) with a strong password, or better, move them to `.env`:
>
> ```yaml
> # db:
>   POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
> # backend:
>   DATABASE_URL: postgresql+asyncpg://postgres:${POSTGRES_PASSWORD}@db:5432/lh_warehouse
> ```

---

## 4. Database

PostgreSQL 16 runs as the `db` service. Data lives in the named volume
**`lh_warehouse_pgdata`**, declared `external: true` in compose (it must already
exist). Two cases:

**Fresh install (new server, no existing data):** create the volume first, or drop
the `external: true` line so compose manages it.

```bash
docker volume create lh_warehouse_pgdata
```

On first boot the backend entrypoint runs `python -m app.bootstrap`, which:
- creates any missing tables (`Base.metadata.create_all` — never drops data), and
- **seeds demo data only if the database is empty** (admin `admin@erp.local` / `admin123`).

**Migrating an existing DB / restoring a backup:** load your dump into the volume
before starting the stack (see §9), then bring the stack up.

**Schema changes on an existing DB:** `create_all` adds *missing tables* but not new
*columns*. When a release adds columns, apply them with Alembic
(`alembic upgrade head` inside the backend) or a one-off `ALTER TABLE` — see the
project's migration notes. Always back up first.

> **Managed database (recommended for prod):** you can instead point
> `DATABASE_URL` at a managed Postgres (RDS, Cloud SQL, etc.) and remove the `db`
> service from compose. Keep the `postgresql+asyncpg://` scheme.

---

## 5. Backend (FastAPI)

Built from `./backend` (Python 3.11 slim). Behaviour:
- Entrypoint `docker-entrypoint.sh` runs `app.bootstrap` then
  `uvicorn app.main:app --host 0.0.0.0 --port 8000`.
- **Uploads** (product images, and legacy photo files) are bind-mounted to
  `./backend/uploads` on the host so they survive rebuilds. Back this folder up.
- Env vars are injected by compose (`DATABASE_URL`, `SECRET_KEY`,
  `BACKEND_CORS_ORIGINS`, `TELEGRAM_*`, `COMPANY_*`, `UPLOAD_DIR`).

Run standalone (without web) for API-only setups:

```bash
docker compose up -d --build db backend
curl http://localhost:8000/docs      # OpenAPI UI
```

---

## 6. Web admin (React + nginx)

Built from `./web`: a multi-stage image that runs `npm ci && npm run build`
(Vite + Tailwind) and serves the static `dist/` with nginx. `web/nginx.conf`:
- serves `index.html` for all client-side routes (SPA),
- proxies `/api/` and `/uploads/` to `http://backend:8000`,
- allows uploads up to `client_max_body_size 25m`.

Because the SPA is served same-origin with the API, **no `VITE_API_BASE` is needed**
in production (it defaults to `/api/v1`).

---

## 7. Full stack — the normal path

From the repo root, with `.env` in place:

```bash
docker compose up -d --build          # build & start db + backend + web
docker compose ps                     # check health
docker compose logs -f backend        # follow API logs
```

Open the admin at **http://SERVER:5173** and log in
(`admin@erp.local` / `admin123` on a fresh seed — **change it immediately**).

### Put it behind HTTPS (production)

Terminate TLS in front of the `web` container with a reverse proxy (Caddy, Traefik,
or nginx). Example Caddy:

```caddy
erp.yourdomain.com {
    reverse_proxy localhost:5173
}
```

Then:
- Point `web`'s host port at localhost only (e.g. `"127.0.0.1:5173:80"`).
- **Do not** expose `backend:8000` or `db:5433` publicly (remove their `ports:` or
  bind to `127.0.0.1`). The web container reaches the backend over the internal
  Docker network.
- Update `BACKEND_CORS_ORIGINS` to your real domain if the mobile app or any other
  origin calls the API directly.

### Update / redeploy

```bash
git pull
docker compose up -d --build          # rebuilds changed images; DB volume kept
```

> **Build note:** the backend Dockerfile installs Python deps from PyPI. If a build
> intermittently fails with `ReadTimeoutError` / `ResolutionImpossible` (flaky
> network), it already retries (`PIP_RETRIES=10`); if it still fails, build with the
> host network: `docker build --network=host -t warehouse-erp-backend ./backend`
> then `docker compose up -d --no-build backend`.

---

## 8. Mobile app (Flutter — agents)

The app is a normal Flutter build; point it at your server's API with a
`--dart-define`. Default (no define) is `http://10.0.2.2:8000/api/v1` (Android
emulator → host).

### Build an Android APK

```bash
cd mobile
flutter pub get
flutter build apk --release \
  --dart-define=API_BASE_URL=https://erp.yourdomain.com/api/v1
# output: build/app/outputs/flutter-apk/app-release.apk
```

Distribute the APK directly, or upload an **app bundle** to Google Play:

```bash
flutter build appbundle --release \
  --dart-define=API_BASE_URL=https://erp.yourdomain.com/api/v1
```

### iOS

```bash
flutter build ipa --release \
  --dart-define=API_BASE_URL=https://erp.yourdomain.com/api/v1
# then distribute via Xcode / TestFlight / App Store
```

Notes:
- Use an **HTTPS** `API_BASE_URL` in production (iOS ATS and Android cleartext
  policies block plain HTTP by default).
- `API_BASE_URL` must end in `/api/v1`; the app derives the upload origin from it.
- The app reads translations from bundled JSON assets and needs no server config.

---

## 9. Backups & restore

**What to back up:**
1. the **database** (all business data), and
2. `backend/uploads/` (product images + any legacy photo files).

Photo *reports* are stored in Telegram only, so they need no server backup.

### Database dump / restore

```bash
# Backup
docker exec erp_db pg_dump -U postgres -d lh_warehouse -Fc > erp-$(date +%F).dump

# Restore (into a running, empty db)
docker exec -i erp_db pg_restore -U postgres -d lh_warehouse --clean --if-exists < erp-YYYY-MM-DD.dump
```

Automate with a nightly cron running `pg_dump` and copying the dump +
`backend/uploads/` off-box.

---

## 10. Telegram setup (optional)

1. Create a bot with **@BotFather**, copy the token into `TELEGRAM_BOT_TOKEN`.
2. Add the bot to your group; if using **forum topics**, note the group `chat_id`
   and each topic's `message_thread_id`.
3. Configure destination **topics** in the super-admin panel (Topics page) — the
   `GET /telegram-topics/updates` helper surfaces recent `chat_id`/topic ids.
4. Assign each agent a default topic if desired. A report is only sent when an
   **active** topic resolves; otherwise it is saved as `FAILED`.

> If a bot token was ever committed or shared, **rotate it** via @BotFather.

---

## 11. Health checks & troubleshooting

```bash
docker compose ps                       # service/health status
docker compose logs -f backend          # API + scheduler + telegram logs
docker exec erp_db pg_isready -U postgres -d lh_warehouse
curl -s http://localhost:8000/docs      # backend reachable?
```

- **Web loads but API 502/timeouts** → backend not healthy or DB not ready; check
  `depends_on` health and backend logs.
- **Photos don't send to Telegram** → no active topic configured, or bad token;
  the report row shows the error.
- **Uploads disappear after redeploy** → ensure `./backend/uploads` bind mount
  exists and is backed up.
- **Login fails on a fresh DB** → the seed only runs on an *empty* database; check
  the backend startup log for “seeding demo data”.

---

## 12. Production checklist

- [ ] Strong `SECRET_KEY` (`openssl rand -hex 32`) in `.env`.
- [ ] Changed Postgres password (compose + `DATABASE_URL`).
- [ ] Changed the seeded `admin@erp.local` password (and any demo accounts).
- [ ] TLS reverse proxy in front of `web`; `backend`/`db` not publicly exposed.
- [ ] `BACKEND_CORS_ORIGINS` set to real origins.
- [ ] Nightly backups of the DB **and** `backend/uploads/`.
- [ ] Mobile app built with the production `API_BASE_URL` (HTTPS).
- [ ] Telegram token rotated if it was ever shared.
