/// A normalised error surfaced from the data layer to cubits/blocs.
class ApiException implements Exception {
  const ApiException(this.message, {this.statusCode, this.isNetwork = false});

  final String message;
  final int? statusCode;

  /// True when the server could not be reached at all (no HTTP response) —
  /// i.e. the device is offline. Callers use this to queue work for later.
  final bool isNetwork;

  bool get isUnauthorized => statusCode == 401;

  @override
  String toString() => message;
}
