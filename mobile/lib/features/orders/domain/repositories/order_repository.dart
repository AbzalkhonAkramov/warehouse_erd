import '../entities/order.dart';
import '../entities/order_line_input.dart';

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
}
