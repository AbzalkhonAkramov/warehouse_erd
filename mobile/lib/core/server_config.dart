import 'package:shared_preferences/shared_preferences.dart';

import 'config.dart';

/// Persists a user-chosen API base URL so the app can point at any backend
/// without rebuilding. Loaded into [AppConfig] at startup.
class ServerConfig {
  static const _key = 'api_base_url';

  /// Reads the saved URL (if any) into [AppConfig]. Call once at startup.
  static Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    AppConfig.setRuntimeBase(prefs.getString(_key));
  }

  /// Saves (or clears, when [url] is empty) and applies the URL immediately.
  static Future<void> save(String? url) async {
    final prefs = await SharedPreferences.getInstance();
    final u = url?.trim() ?? '';
    if (u.isEmpty) {
      await prefs.remove(_key);
    } else {
      await prefs.setString(_key, u);
    }
    AppConfig.setRuntimeBase(u);
  }
}
