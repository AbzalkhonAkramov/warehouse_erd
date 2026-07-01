import 'dart:io' show Platform;

/// App-wide configuration.
///
/// [baseUrl] points at the FastAPI backend. When not overridden it picks the
/// right host for the current emulator/simulator automatically:
///   • Android emulator reaches the host machine at `10.0.2.2`
///   • iOS Simulator (and macOS/desktop) reach it at `localhost`
/// Override at build time for a real device / production:
///   `--dart-define=API_BASE_URL=https://erp.example.com/api/v1`
class AppConfig {
  static const String _override = String.fromEnvironment('API_BASE_URL');

  static String get baseUrl {
    if (_override.isNotEmpty) return _override;
    final host = Platform.isAndroid ? '10.0.2.2' : 'localhost';
    return 'http://$host:8000/api/v1';
  }

  /// Origin used to build absolute URLs for uploaded photos (strips /api/v1).
  static String get originUrl => baseUrl.replaceAll('/api/v1', '');

  /// Absolute URL for a stored upload (e.g. a product image's `image_path`).
  static String uploadUrl(String path) => '$originUrl/uploads/$path';
}
