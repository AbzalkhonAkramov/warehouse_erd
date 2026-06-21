/// App-wide configuration.
///
/// [baseUrl] points at the FastAPI backend. Defaults to the Android emulator's
/// host alias (10.0.2.2 → your machine's localhost). Override at build time with
/// `--dart-define=API_BASE_URL=http://192.168.x.x:8000/api/v1` for a real device.
class AppConfig {
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:8000/api/v1',
  );

  /// Origin used to build absolute URLs for uploaded photos (strips /api/v1).
  static String get originUrl => baseUrl.replaceAll('/api/v1', '');

  /// Absolute URL for a stored upload (e.g. a product image's `image_path`).
  static String uploadUrl(String path) => '$originUrl/uploads/$path';
}
