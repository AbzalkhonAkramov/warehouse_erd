import 'package:bloc/bloc.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'messages.dart';

/// Holds the current UI language, persisted across launches. Defaults to Russian.
class LocaleCubit extends Cubit<AppLang> {
  LocaleCubit() : super(AppLang.ru);

  static const _key = 'app_lang';

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString(_key);
    for (final lang in AppLang.values) {
      if (lang.name == saved) {
        emit(lang);
        return;
      }
    }
  }

  Future<void> setLang(AppLang lang) async {
    emit(lang);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, lang.name);
  }
}
