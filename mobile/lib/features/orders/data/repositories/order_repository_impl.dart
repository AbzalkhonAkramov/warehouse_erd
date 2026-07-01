import '../../../../core/network/api_exception.dart';
import '../../domain/entities/order.dart';
import '../../domain/entities/order_line_input.dart';
import '../../domain/entities/pending_order.dart';
import '../../domain/repositories/order_repository.dart';
import '../datasources/order_local_data_source.dart';
import '../datasources/order_remote_data_source.dart';

class OrderRepositoryImpl implements OrderRepository {
  OrderRepositoryImpl(this._remote, this._local);

  final OrderRemoteDataSource _remote;
  final OrderLocalDataSource _local;

  @override
  Future<List<Order>> listOrders() => _remote.listOrders();

  @override
  Future<Order> getOrder(int id) => _remote.getOrder(id);

  @override
  Future<({int id, String status})> createOrder({
    required int customerId,
    required List<OrderLineInput> lines,
    String? note,
  }) {
    return _remote.createOrder(customerId: customerId, lines: lines, note: note);
  }

  @override
  Future<SubmitResult> submitOrder({
    required int customerId,
    required List<OrderLineInput> lines,
    String? note,
  }) async {
    try {
      final res = await _remote.createOrder(
        customerId: customerId,
        lines: lines,
        note: note,
      );
      return (queued: false, id: res.id, status: res.status);
    } on ApiException catch (e) {
      // Only queue when the failure is a connectivity problem — real server
      // errors (validation, auth) should surface to the user immediately.
      if (!e.isNetwork) rethrow;
      await _local.add(PendingOrder(
        localId: DateTime.now().microsecondsSinceEpoch.toString(),
        customerId: customerId,
        lines: lines,
        note: note,
        createdAt: DateTime.now(),
      ));
      return (queued: true, id: null, status: null);
    }
  }

  @override
  Future<List<PendingOrder>> pendingOrders() => _local.getAll();

  @override
  Future<int> pendingCount() => _local.count();

  @override
  Future<SyncResult> syncPending() async {
    final pending = await _local.getAll();
    var synced = 0;
    for (final p in pending) {
      try {
        await _remote.createOrder(
          customerId: p.customerId,
          lines: p.lines,
          note: p.note,
        );
        await _local.remove(p.localId);
        synced++;
      } on ApiException catch (e) {
        if (e.isNetwork) {
          // Still offline — stop and try again on the next connectivity change.
          return (synced: synced, stillOffline: true);
        }
        // Server rejected this specific order (e.g. validation). Drop it so it
        // can't block the rest of the queue forever, and keep draining.
        await _local.remove(p.localId);
      }
    }
    return (synced: synced, stillOffline: false);
  }
}
