import 'dart:io' show Platform;

import 'package:flutter/foundation.dart' show kIsWeb;

/// App-wide configuration.
///
/// Base API URL resolution order:
///   1. a runtime value the user set in-app (persisted, see ServerConfig)
///   2. a compile-time `--dart-define=API_BASE_URL=...`
///   3. a sensible emulator default (Android → 10.0.2.2, iOS/others → localhost)
class AppConfig {
  static const String _override = String.fromEnvironment('API_BASE_URL');

  /// Set from persisted user preference at startup / when the user edits it.
  static String? _runtime;

  static void setRuntimeBase(String? url) {
    final u = url?.trim();
    _runtime = (u == null || u.isEmpty) ? null : u;
  }

  static bool get hasRuntimeBase => _runtime != null;

  static String get defaultBase {
    if (_override.isNotEmpty) return _override;
    // On web `dart:io`'s Platform throws, and 10.0.2.2 (the Android-emulator
    // alias for the host) is meaningless in a browser — talk to localhost.
    final host = (!kIsWeb && Platform.isAndroid) ? '10.0.2.2' : 'localhost';
    return 'http://$host:8000/api/v1';
  }

  static String get baseUrl => _runtime ?? defaultBase;

  /// Origin used to build absolute URLs for uploaded photos (strips /api/v1).
  static String get originUrl => baseUrl.replaceAll('/api/v1', '');

  /// Absolute URL for a stored upload (e.g. a product image's `image_path`).
  static String uploadUrl(String path) => '$originUrl/uploads/$path';
}
