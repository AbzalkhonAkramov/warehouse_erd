import 'dart:convert';

import 'package:flutter/services.dart' show rootBundle;

/// Lightweight localization catalog. Translations live in editable JSON files
/// under `assets/l10n/<lang>.json` and are loaded once at startup by
/// [loadMessages]. Look-ups go through `context.tr('key')` (see l10n_ext.dart).
/// Default language is Russian.
enum AppLang { ru, uz, en }

const Map<AppLang, String> langLabels = {
  AppLang.ru: 'Русский',
  AppLang.uz: "O‘zbekcha",
  AppLang.en: 'English',
};

/// In-memory catalog, filled by [loadMessages]. Empty until then.
final Map<AppLang, Map<String, String>> messages = {
  for (final lang in AppLang.values) lang: <String, String>{},
};

/// Reads every language's JSON asset into [messages]. Call once before
/// `runApp` (see main.dart). Safe to call again to reload.
Future<void> loadMessages() async {
  for (final lang in AppLang.values) {
    final raw = await rootBundle.loadString('assets/l10n/${lang.name}.json');
    final data = json.decode(raw) as Map<String, dynamic>;
    messages[lang] = data.map((k, v) => MapEntry(k, '$v'));
  }
}
