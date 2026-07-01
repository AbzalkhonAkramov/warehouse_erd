import '../entities/order.dart';
import '../entities/order_line_input.dart';
import '../entities/pending_order.dart';

/// Result of trying to submit an order: either it reached the server (`queued`
/// is false, with the server id/status) or it was saved to the offline outbox.
typedef SubmitResult = ({bool queued, int? id, String? status});

/// Result of draining the outbox.
typedef SyncResult = ({int synced, bool stillOffline});

abstract class OrderRepository {
  /// The agent's own orders (newest first).
  Future<List<Order>> listOrders();

  /// A single order with its lines (for the receipt).
  Future<Order> getOrder(int id);

  /// Creates a sales order and returns its id and resulting status.
  Future<({int id, String status})> createOrder({
    required int customerId,
    required List<OrderLineInput> lines,
    String? note,
  });

  /// Tries to send the order; if the device is offline it is saved to the local
  /// outbox and [SubmitResult.queued] is true.
  Future<SubmitResult> submitOrder({
    required int customerId,
    required List<OrderLineInput> lines,
    String? note,
  });

  /// Orders currently waiting in the offline outbox.
  Future<List<PendingOrder>> pendingOrders();

  /// How many orders are waiting to be sent.
  Future<int> pendingCount();

  /// Sends every queued order it can; stops if the device is still offline.
  Future<SyncResult> syncPending();
}
