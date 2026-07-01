import 'package:connectivity_plus/connectivity_plus.dart';

/// Thin wrapper over connectivity_plus. Reports whether the device currently has
/// *any* network interface, and emits when that changes — used to drain the
/// offline order queue as soon as connectivity returns.
class ConnectivityService {
  final Connectivity _c = Connectivity();

  static bool _isOnline(List<ConnectivityResult> r) =>
      r.any((e) => e != ConnectivityResult.none);

  Future<bool> isOnline() async => _isOnline(await _c.checkConnectivity());

  /// Emits true when a connection appears, false when it drops.
  Stream<bool> get onStatusChange =>
      _c.onConnectivityChanged.map(_isOnline).distinct();
}
