import '../../../../core/network/api_client.dart';
import '../../domain/entities/customer.dart';
import '../../domain/entities/region.dart';

double _toDouble(dynamic v) =>
    v == null ? 0 : (v is num ? v.toDouble() : double.tryParse('$v') ?? 0);

class CustomerRemoteDataSource {
  CustomerRemoteDataSource(this._client);

  final ApiClient _client;

  Future<List<Customer>> fetchCustomers() async {
    final data = await _client.get('/customers') as List<dynamic>;
    return data
        .map(
          (j) => Customer(
            id: j['id'] as int,
            name: j['name'] as String,
            phone: j['phone'] as String?,
            address: j['address'] as String?,
            creditLimit: _toDouble(j['credit_limit']),
            debt: _toDouble(j['debt']),
          ),
        )
        .toList();
  }

  Future<List<Region>> fetchRegions() async {
    final data = await _client.get('/regions') as List<dynamic>;
    return data
        .map((j) => Region(id: j['id'] as int, name: j['name'] as String))
        .toList();
  }

  Future<void> createCustomer({
    required String name,
    String? phone,
    String? address,
    String? city,
    int? regionId,
  }) async {
    await _client.post('/customers', data: {
      'name': name,
      if (phone != null && phone.isNotEmpty) 'phone': phone,
      if (address != null && address.isNotEmpty) 'address': address,
      if (city != null && city.isNotEmpty) 'city': city,
      if (regionId != null) 'region_id': regionId,
    });
  }
}
