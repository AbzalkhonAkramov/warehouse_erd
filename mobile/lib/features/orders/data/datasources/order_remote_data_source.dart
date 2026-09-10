import '../../../../core/network/api_client.dart';
import '../../domain/entities/order.dart';
import '../../domain/entities/order_line_input.dart';

double _toDouble(dynamic v) =>
    v == null ? 0 : (v is num ? v.toDouble() : double.tryParse('$v') ?? 0);

Order _parseOrder(Map<String, dynamic> j) {
  return Order(
    id: j['id'] as int,
    orderNo: (j['order_no'] as String?) ?? '${j['id']}',
    status: j['status'] as String,
    customerId: j['customer_id'] as int,
    customerName: j['customer_name'] as String?,
    customerAddress: j['customer_address'] as String?,
    subtotal: _toDouble(j['subtotal']),
    discount: _toDouble(j['discount']),
    total: _toDouble(j['total']),
    deliverer: j['deliverer'] as String?,
    invoiceNumber: j['invoice_number'] as String?,
    createdAt:
        DateTime.tryParse((j['created_at'] as String?) ?? '')?.toLocal() ??
            DateTime.now(),
    lines: ((j['lines'] as List<dynamic>?) ?? [])
        .map((l) => OrderItem(
              productId: l['product_id'] as int,
              productName: (l['product_name'] as String?) ?? '#${l['product_id']}',
              quantity: _toDouble(l['quantity']),
              unitPrice: _toDouble(l['unit_price']),
              lineTotal: _toDouble(l['line_total']),
              boxCount: (l['box_count'] as num?)?.toInt() ?? 0,
              boxSize: (l['box_size'] as num?)?.toInt() ?? 0,
            ))
        .toList(),
  );
}

class OrderRemoteDataSource {
  OrderRemoteDataSource(this._client);

  final ApiClient _client;

  Future<List<Order>> listOrders() async {
    final data = await _client.get('/sales-orders') as List<dynamic>;
    return data.map((j) => _parseOrder(j as Map<String, dynamic>)).toList();
  }

  Future<Order> getOrder(int id) async {
    final data = await _client.get('/sales-orders/$id') as Map<String, dynamic>;
    return _parseOrder(data);
  }

  Future<({int id, String status})> createOrder({
    required int customerId,
    required List<OrderLineInput> lines,
    String? note,
  }) async {
    final body = <String, dynamic>{
      'customer_id': customerId,
      if (note != null && note.isNotEmpty) 'note': note,
      'lines': lines
          .map((l) => {
                'product_id': l.productId,
                'quantity': l.quantity,
                'box_count': l.boxCount,
              })
          .toList(),
    };
    final data = await _client.post('/sales-orders', data: body);
    return (id: data['id'] as int, status: data['status'] as String);
  }
}
