# Руководство по развёртыванию — Warehouse ERP

Как развернуть всю систему: **база данных PostgreSQL**, **бэкенд FastAPI**,
**веб-панель React** и **мобильное приложение Flutter** (плюс Telegram).

---

## 1. Архитектура вкратце

```
                         ┌─────────────────────────────┐
   Браузер (админ) ─────▶│  web (nginx)  :80            │
                         │   отдаёт React SPA           │
                         │   проксирует /api  → backend │
                         │   проксирует /uploads → backend │
                         └──────────────┬──────────────┘
                                        │ (внутренняя сеть)
   Моб. приложение (агенты) ────────────┤
   HTTPS → /api/v1                       ▼
                         ┌─────────────────────────────┐
                         │  backend (FastAPI)  :8000    │
                         │   - REST API                 │
                         │   - ночная архивация         │
                         │   - отправка в Telegram      │
                         │   - /uploads (фото товаров)  │
                         └──────────────┬──────────────┘
                                        ▼
                         ┌─────────────────────────────┐
                         │  db (PostgreSQL 16)  :5432   │
                         │   том: lh_warehouse_pgdata   │
                         └─────────────────────────────┘
```

| Сервис    | Образ / сборка   | Порт контейнера | Порт хоста (compose) | Публичный? |
|-----------|------------------|-----------------|----------------------|------------|
| `db`      | `postgres:16`    | 5432            | 5433                 | **Нет**    |
| `backend` | `./backend`      | 8000            | 8000                 | Опционально (за web) |
| `web`     | `./web` (nginx)  | 80              | 5173                 | **Да** (поставьте TLS впереди) |

**Ключевые факты**
- **Веб-контейнер проксирует `/api` и `/uploads`** на бэкенд, поэтому браузер
  общается с одним origin (в проде нет CORS). В проде публично нужно открыть
  только сервис **web**; `backend` и `db` могут оставаться внутренними.
- **Telegram работает только на отправку** (бэкенд вызывает Telegram API, чтобы
  слать уведомления о заказах и альбомы фото «до/после»). **Отдельного процесса
  бота нет.**
- **Ночная архивация** (00:00 Asia/Tashkent) и пересылка фото выполняются **внутри
  процесса бэкенда** — ничего дополнительно разворачивать не нужно.

---

## 2. Предварительные требования

- Linux-хост (или любая машина) с **Docker** + **Docker Compose v2**.
- Доменное имя + TLS-сертификат для прода (через обратный прокси — см. §7).
- Для сборки мобильного приложения: **Flutter SDK ≥ 3.5** на сборочной машине.

---

## 3. Настройка секретов (`.env`)

Compose читает секреты из корневого файла **`.env`** (рядом с
`docker-compose.yml`). Создайте его из примера и впишите реальные значения:

```bash
cd warehouse-erp
cp .env.example .env      # затем отредактируйте
```

Минимум для прода:

```dotenv
# Длинная случайная строка — сгенерируйте для прода:  openssl rand -hex 32
SECRET_KEY=<64-hex-символов>

# Telegram (опционально; оставьте пустым, чтобы отключить уведомления)
TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_MANAGER_CHAT_ID=-1001234567890

# Брендинг на чеках / странице входа (также настраивается в супер-админке)
COMPANY_NAME=Ваша компания
COMPANY_LOGO_URL=
```

> ⚠️ **Смените пароль базы данных.** В `docker-compose.yml` зашит пароль Postgres
> по умолчанию (`abzal7727`), и он же прописан в `DATABASE_URL`. Для прода замените
> **оба** места (`POSTGRES_PASSWORD` у сервиса `db` и `DATABASE_URL` у `backend`) на
> надёжный пароль, а лучше вынесите их в `.env`:
>
> ```yaml
> # db:
>   POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
> # backend:
>   DATABASE_URL: postgresql+asyncpg://postgres:${POSTGRES_PASSWORD}@db:5432/lh_warehouse
> ```

---

## 4. База данных

PostgreSQL 16 работает как сервис `db`. Данные лежат в именованном томе
**`lh_warehouse_pgdata`**, объявленном как `external: true` в compose (том должен
уже существовать). Два случая:

**Чистая установка (новый сервер, данных нет):** сначала создайте том — или удалите
строку `external: true`, чтобы compose управлял им сам.

```bash
docker volume create lh_warehouse_pgdata
```

При первом запуске entrypoint бэкенда выполняет `python -m app.bootstrap`, который:
- создаёт недостающие таблицы (`Base.metadata.create_all` — никогда не удаляет
  данные), и
- **загружает демо-данные только если база пустая** (админ `admin@erp.local` /
  `admin123`).

**Миграция существующей БД / восстановление из бэкапа:** загрузите свой дамп в том
до запуска стека (см. §9), затем поднимите стек.

**Изменения схемы на существующей БД:** `create_all` добавляет *недостающие
таблицы*, но не новые *колонки*. Когда релиз добавляет колонки, примените их через
Alembic (`alembic upgrade head` внутри бэкенда) или разовым `ALTER TABLE` — см.
заметки по миграциям в проекте. Всегда делайте бэкап заранее.

> **Управляемая БД (рекомендуется для прода):** можно направить `DATABASE_URL` на
> управляемый Postgres (RDS, Cloud SQL и т. п.) и удалить сервис `db` из compose.
> Сохраните схему `postgresql+asyncpg://`.

---

## 5. Бэкенд (FastAPI)

Собирается из `./backend` (Python 3.11 slim). Поведение:
- Entrypoint `docker-entrypoint.sh` запускает `app.bootstrap`, затем
  `uvicorn app.main:app --host 0.0.0.0 --port 8000`.
- **Загрузки** (изображения товаров и устаревшие файлы фото) монтируются (bind
  mount) в `./backend/uploads` на хосте, чтобы пережить пересборки. Делайте бэкап
  этой папки.
- Переменные окружения передаёт compose (`DATABASE_URL`, `SECRET_KEY`,
  `BACKEND_CORS_ORIGINS`, `TELEGRAM_*`, `COMPANY_*`, `UPLOAD_DIR`).

Запуск отдельно (без web) для API-only конфигураций:

```bash
docker compose up -d --build db backend
curl http://localhost:8000/docs      # OpenAPI UI
```

---

## 6. Веб-панель (React + nginx)

Собирается из `./web`: многоступенчатый образ, который выполняет
`npm ci && npm run build` (Vite + Tailwind) и отдаёт статику `dist/` через nginx.
`web/nginx.conf`:
- отдаёт `index.html` для всех клиентских маршрутов (SPA),
- проксирует `/api/` и `/uploads/` на `http://backend:8000`,
- разрешает загрузки до `client_max_body_size 25m`.

Так как SPA отдаётся с того же origin, что и API, **`VITE_API_BASE` в проде не
нужен** (по умолчанию `/api/v1`).

---

## 7. Полный стек — обычный путь

Из корня репозитория, с готовым `.env`:

```bash
docker compose up -d --build          # собрать и запустить db + backend + web
docker compose ps                     # проверить состояние
docker compose logs -f backend        # следить за логами API
```

Откройте админку на **http://СЕРВЕР:5173** и войдите
(`admin@erp.local` / `admin123` на свежем сиде — **сразу смените пароль**).

### За HTTPS (продакшн)

Терминируйте TLS перед контейнером `web` обратным прокси (Caddy, Traefik или
nginx). Пример Caddy:

```caddy
erp.yourdomain.com {
    reverse_proxy localhost:5173
}
```

Затем:
- Привяжите порт хоста `web` только к localhost (например, `"127.0.0.1:5173:80"`).
- **Не** открывайте `backend:8000` или `db:5433` публично (уберите их `ports:` или
  привяжите к `127.0.0.1`). Веб-контейнер достаёт бэкенд по внутренней сети Docker.
- Обновите `BACKEND_CORS_ORIGINS` на ваш реальный домен, если мобильное приложение
  или другой origin обращается к API напрямую.

### Обновление / повторное развёртывание

```bash
git pull
docker compose up -d --build          # пересоберёт изменённые образы; том БД сохранится
```

> **Заметка о сборке:** Dockerfile бэкенда ставит зависимости Python с PyPI. Если
> сборка изредка падает с `ReadTimeoutError` / `ResolutionImpossible` (нестабильная
> сеть), повторы уже включены (`PIP_RETRIES=10`); если всё равно падает, соберите с
> сетью хоста: `docker build --network=host -t warehouse-erp-backend ./backend`,
> затем `docker compose up -d --no-build backend`.

---

## 8. Мобильное приложение (Flutter — агенты)

Приложение — обычная сборка Flutter; направьте его на API вашего сервера через
`--dart-define`. По умолчанию (без define) — `http://10.0.2.2:8000/api/v1`
(Android-эмулятор → хост).

### Сборка Android APK

```bash
cd mobile
flutter pub get
flutter build apk --release \
  --dart-define=API_BASE_URL=https://erp.yourdomain.com/api/v1
# результат: build/app/outputs/flutter-apk/app-release.apk
```

Раздайте APK напрямую или загрузите **app bundle** в Google Play:

```bash
flutter build appbundle --release \
  --dart-define=API_BASE_URL=https://erp.yourdomain.com/api/v1
```

### iOS

```bash
flutter build ipa --release \
  --dart-define=API_BASE_URL=https://erp.yourdomain.com/api/v1
# затем раздача через Xcode / TestFlight / App Store
```

Примечания:
- В проде используйте **HTTPS** `API_BASE_URL` (политики iOS ATS и Android по
  умолчанию блокируют обычный HTTP).
- `API_BASE_URL` должен заканчиваться на `/api/v1`; origin для загрузок приложение
  выводит из него.
- Приложение читает переводы из встроенных JSON-ассетов и не требует настройки на
  сервере.

---

## 9. Резервные копии и восстановление

**Что бэкапить:**
1. **базу данных** (все бизнес-данные), и
2. `backend/uploads/` (изображения товаров + устаревшие файлы фото).

Фото*отчёты* хранятся только в Telegram, поэтому серверный бэкап им не нужен.

### Дамп / восстановление БД

```bash
# Бэкап
docker exec erp_db pg_dump -U postgres -d lh_warehouse -Fc > erp-$(date +%F).dump

# Восстановление (в работающую пустую БД)
docker exec -i erp_db pg_restore -U postgres -d lh_warehouse --clean --if-exists < erp-YYYY-MM-DD.dump
```

Автоматизируйте ночным cron, который делает `pg_dump` и копирует дамп +
`backend/uploads/` за пределы сервера.

---

## 10. Настройка Telegram (опционально)

1. Создайте бота через **@BotFather**, скопируйте токен в `TELEGRAM_BOT_TOKEN`.
2. Добавьте бота в группу; при использовании **тем форума** узнайте `chat_id`
   группы и `message_thread_id` каждой темы.
3. Настройте темы-назначения в супер-админке (страница Topics) — помощник
   `GET /telegram-topics/updates` показывает свежие `chat_id`/id тем.
4. При желании назначьте каждому агенту тему по умолчанию. Отчёт отправляется,
   только если находится **активная** тема; иначе он сохраняется как `FAILED`.

> Если токен бота когда-либо был закоммичен или передан — **смените его** через
> @BotFather.

---

## 11. Проверки состояния и устранение неполадок

```bash
docker compose ps                       # статус/здоровье сервисов
docker compose logs -f backend          # API + планировщик + логи telegram
docker exec erp_db pg_isready -U postgres -d lh_warehouse
curl -s http://localhost:8000/docs      # бэкенд доступен?
```

- **Веб грузится, но API даёт 502/таймауты** → бэкенд не здоров или БД не готова;
  проверьте health в `depends_on` и логи бэкенда.
- **Фото не уходят в Telegram** → не настроена активная тема или неверный токен;
  строка отчёта показывает ошибку.
- **Загрузки исчезают после пересборки** → убедитесь, что bind mount
  `./backend/uploads` существует и бэкапится.
- **Не входит на свежей БД** → сид запускается только на *пустой* базе; проверьте
  в логе старта бэкенда сообщение «seeding demo data».

---

## 12. Чек-лист для продакшна

- [ ] Надёжный `SECRET_KEY` (`openssl rand -hex 32`) в `.env`.
- [ ] Сменён пароль Postgres (compose + `DATABASE_URL`).
- [ ] Сменён пароль засиженного `admin@erp.local` (и любых демо-аккаунтов).
- [ ] TLS-обратный прокси перед `web`; `backend`/`db` не открыты публично.
- [ ] `BACKEND_CORS_ORIGINS` указывает на реальные origin.
- [ ] Ночные бэкапы БД **и** `backend/uploads/`.
- [ ] Мобильное приложение собрано с продовым `API_BASE_URL` (HTTPS).
- [ ] Токен Telegram сменён, если он когда-либо был передан.
