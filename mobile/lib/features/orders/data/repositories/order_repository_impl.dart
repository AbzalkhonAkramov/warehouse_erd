import '../../domain/entities/order.dart';
import '../../domain/entities/order_line_input.dart';
import '../../domain/repositories/order_repository.dart';
import '../datasources/order_remote_data_source.dart';

class OrderRepositoryImpl implements OrderRepository {
  OrderRepositoryImpl(this._remote);

  final OrderRemoteDataSource _remote;

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
}
