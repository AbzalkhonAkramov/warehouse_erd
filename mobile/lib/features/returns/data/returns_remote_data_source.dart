import '../../../../core/network/api_client.dart';

class ReturnsRemoteDataSource {
  ReturnsRemoteDataSource(this._client);

  final ApiClient _client;

  /// Submit a product-return request against an order (manager approves later).
  Future<void> submitReturn({
    required int salesOrderId,
    required List<({int productId, double quantity})> lines,
    String? note,
  }) async {
    await _client.post('/returns', data: {
      'sales_order_id': salesOrderId,
      'lines': [
        for (final l in lines) {'product_id': l.productId, 'quantity': l.quantity},
      ],
      if (note != null && note.isNotEmpty) 'note': note,
    });
  }
}
