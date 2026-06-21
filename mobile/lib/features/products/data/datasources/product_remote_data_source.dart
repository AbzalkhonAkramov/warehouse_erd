import '../../../../core/network/api_client.dart';
import '../../domain/entities/product.dart';

double _toDouble(dynamic v) =>
    v == null ? 0 : (v is num ? v.toDouble() : double.tryParse('$v') ?? 0);

class ProductRemoteDataSource {
  ProductRemoteDataSource(this._client);

  final ApiClient _client;

  Future<List<Product>> fetchProducts() async {
    final data = await _client.get('/products') as List<dynamic>;
    return data
        .map(
          (j) => Product(
            id: j['id'] as int,
            sku: j['sku'] as String,
            name: j['name'] as String,
            unit: (j['unit'] as String?) ?? 'pcs',
            salePrice: _toDouble(j['sale_price']),
            imagePath: j['image_path'] as String?,
            onHand: _toDouble(j['on_hand']),
          ),
        )
        .toList();
  }
}
