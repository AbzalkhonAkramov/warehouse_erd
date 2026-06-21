import '../../../../core/network/api_client.dart';
import '../../domain/entities/order_line_input.dart';

class OrderRemoteDataSource {
  OrderRemoteDataSource(this._client);

  final ApiClient _client;

  Future<({int id, String status})> createOrder({
    required int customerId,
    required List<OrderLineInput> lines,
    String? note,
  }) async {
    final body = <String, dynamic>{
      'customer_id': customerId,
      if (note != null && note.isNotEmpty) 'note': note,
      'lines': lines
          .map((l) => {'product_id': l.productId, 'quantity': l.quantity})
          .toList(),
    };
    final data = await _client.post('/sales-orders', data: body);
    return (id: data['id'] as int, status: data['status'] as String);
  }
}
