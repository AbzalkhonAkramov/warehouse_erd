import '../../../../core/network/api_client.dart';
import '../../domain/entities/category.dart';
import '../../domain/entities/product.dart';

double _toDouble(dynamic v) =>
    v == null ? 0 : (v is num ? v.toDouble() : double.tryParse('$v') ?? 0);

double? _toDoubleOrNull(dynamic v) =>
    v == null ? null : (v is num ? v.toDouble() : double.tryParse('$v'));

Product _fromJson(Map<String, dynamic> j) => Product(
      id: j['id'] as int,
      sku: j['sku'] as String,
      name: j['name'] as String,
      unit: (j['unit'] as String?) ?? 'pcs',
      salePrice: _toDouble(j['sale_price']),
      categoryId: j['category_id'] as int?,
      imagePath: j['image_path'] as String?,
      onHand: _toDouble(j['on_hand']),
      currencyCode: j['currency_code'] as String?,
      currencySymbol: j['currency_symbol'] as String?,
      boxQty: (j['box_qty'] as num?)?.toInt(),
      boxWeight: _toDoubleOrNull(j['box_weight']),
      boxDimensions: j['box_dimensions'] as String?,
      saleMode: (j['sale_mode'] as String?) ?? 'piece',
    );

class ProductRemoteDataSource {
  ProductRemoteDataSource(this._client);

  final ApiClient _client;

  Future<List<Product>> fetchProducts() async {
    final data = await _client.get('/products') as List<dynamic>;
    return data.map((j) => _fromJson(j as Map<String, dynamic>)).toList();
  }

  Future<List<Category>> fetchCategories() async {
    final data = await _client.get('/categories') as List<dynamic>;
    return data
        .map((j) => Category(id: j['id'] as int, name: j['name'] as String))
        .toList();
  }
}
