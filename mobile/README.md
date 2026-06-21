# Warehouse ERP — Agent app (Flutter)

Field-agent mobile app built with **Clean Architecture + BLoC**.

## Features
- JWT login against the FastAPI backend
- **My customers** — the agent's assigned shops, with debt vs. credit limit
- **New order** — pick a customer, add products with quantity steppers, submit for
  manager approval
- **Photo report** — capture **before/after** photos with the camera, pick a customer
  and (optionally) a topic, add a note, and submit. The backend forwards the photos
  to the configured **Telegram group topic**.

## Architecture

```
lib/
├── core/                      # config, Dio client, token storage, DI (get_it)
└── features/<feature>/
    ├── data/                  # data sources (HTTP) + repository implementations
    ├── domain/                # entities + repository interfaces
    └── presentation/          # BLoC/Cubit + pages
```

Each feature follows the dependency rule: `presentation → domain ← data`.
State management uses `flutter_bloc` (Bloc for auth & photo report, Cubit for the
list/form features). Dependencies are wired in `core/di/injection.dart`.

## Run

The backend must be running. Then:

```bash
cd mobile
flutter pub get

# Android emulator (10.0.2.2 reaches your machine's localhost — the default):
flutter run

# Real device / different host — point at your machine's LAN IP:
flutter run --dart-define=API_BASE_URL=http://192.168.1.50:8000/api/v1
```

Sign in with `agent@erp.local` / `agent123` after seeding the backend.

## Telegram photo routing

Photos route to a topic resolved in this order:
1. the topic the agent selects on the submit screen, else
2. the agent's admin-assigned `default_topic_id`, else
3. the topic flagged **default** in the super-admin panel.

Topics (group `chat_id` + forum `message_thread_id`) are configured in the web
admin under **Telegram topics**, which also has a *Discover IDs* helper.

## Quality
- `flutter analyze` → no issues
- `flutter test` → domain unit test passes
