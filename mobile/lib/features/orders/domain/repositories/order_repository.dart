import '../entities/order_line_input.dart';

abstract class OrderRepository {
  /// Creates a sales order and returns its id and resulting status
  /// (`approved` when auto-approved from stock, otherwise `pending`).
  Future<({int id, String status})> createOrder({
    required int customerId,
    required List<OrderLineInput> lines,
    String? note,
  });
}
