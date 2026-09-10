# Base URL по платформам + Flutter Web

Бэкенд крутится в Docker на Mac, порт **8000**, путь API — **`/api/v1`**.
LAN-IP Mac на момент записи: **`10.10.250.180`** (меняется при смене Wi-Fi/роутера).

## Что вводить в поле сервера при входе

| Где запущено приложение | Base URL |
|---|---|
| Android — эмулятор | `http://10.0.2.2:8000/api/v1` *(дефолт)* |
| Android — реальный телефон | `http://10.10.250.180:8000/api/v1` |
| iPhone — симулятор | `http://localhost:8000/api/v1` |
| iPhone — реальный телефон | `http://10.10.250.180:8000/api/v1` |
| Web — браузер на этом же Mac | `http://localhost:8000/api/v1` |
| Web — открыт с другого устройства | `http://10.10.250.180:8000/api/v1` |

Пароль вводится одинаково на всех платформах — меняется только base URL.

### Условия

- **Реальные телефоны** (Android/iPhone) должны быть в той же Wi-Fi, что и Mac.
  При смене сети IP `10.10.250.180` меняется — обновить значение.
- `10.0.2.2` — это алиас хоста только для Android-эмулятора; в браузере и на
  реальных устройствах он бессмысленен.

## CORS (только для Web)

Телефонам CORS не важен. Браузер же блокирует запросы на «чужой» origin.

⚠️ **Важно: origin задаётся в `docker-compose.yml` (сервис `backend`,
`environment: BACKEND_CORS_ORIGINS`), а НЕ в `backend/.env`.** Значение из compose
перебивает `.env`. Плюс env читается при *создании* контейнера — после правки нужен
`docker compose up -d backend` (recreate), простой `restart` не подхватит.

Разрешённые origin (после правки этой сессии):

```yaml
BACKEND_CORS_ORIGINS: http://localhost:5173,http://localhost,http://localhost:3000
```

`allow_credentials=True` → wildcard `*` нельзя, origin должен быть точным
(порт важен: `http://localhost` ≠ `http://localhost:3000`).

Если Flutter-web открыть на другом порту — добавить его в ту же строку и пересоздать
контейнер.

## Статус Flutter Web (проверено)

- `flutter create --platforms=web .` → создана папка `web/`.
- `flutter build web` собирается успешно (`build/web`, main.dart.js ~3.9 МБ).
- Все зависимости веб-совместимы (dio, bloc, get_it, shared_preferences,
  image_picker, pdf, printing, connectivity_plus).

### Правки для рантайма в браузере (внесены)

`dart:io` компилируется на web через заглушку, но три места падали в рантайме —
исправлены кросс-платформенно (весь web-код под `kIsWeb`, мобилка не затронута):

| Файл | Фикс |
|---|---|
| `lib/core/config.dart` | `Platform.isAndroid` → guard `!kIsWeb && Platform.isAndroid`, иначе `localhost` |
| `lib/features/photo_report/presentation/pages/photo_report_page.dart` | превью: web → `NetworkImage(blobUrl)`, mobile → `FileImage(File)` |
| `lib/features/photo_report/data/datasources/photo_remote_data_source.dart` | загрузка: web → `MultipartFile.fromBytes` через `XFile`, mobile → `fromFile` |

### Проверено вживую (web на :3000)

- `python3 -m http.server 3000` в `build/web`, открыто в Chrome — приложение
  загрузилось, экран логина отрисовался (RU-локаль).
- Отправлен вход: `OPTIONS /auth/login` → **200**, `POST /auth/login` → **401**
  на неверный пароль, приложение показало snackbar «Incorrect email or password».
- Вывод: сквозной путь web → бэкенд работает. С верным паролем — вход проходит.

### Android — cleartext

`android/app/src/main/AndroidManifest.xml`: добавлен
`android:usesCleartextTraffic="true"` в `<application>` (API по `http://` в LAN).
Изменение манифеста требует полной пересборки (`flutter run`), не hot reload.

### Формат логина

Бэкенд ждёт форму OAuth2: `application/x-www-form-urlencoded`, поля
`username` + `password` (не JSON, не `email`). Мобильный клиент уже шлёт правильно
(`auth_remote_data_source.dart`, `form: true`).
