import '../../../../core/network/api_client.dart';
import '../../domain/entities/customer.dart';
import '../../domain/entities/region.dart';

double _toDouble(dynamic v) =>
    v == null ? 0 : (v is num ? v.toDouble() : double.tryParse('$v') ?? 0);

List<String> _days(dynamic v) {
  final s = (v as String?)?.trim() ?? '';
  if (s.isEmpty) return const [];
  return s.split(',').map((e) => e.trim()).where((e) => e.isNotEmpty).toList();
}

class CustomerRemoteDataSource {
  CustomerRemoteDataSource(this._client);

  final ApiClient _client;

  Customer _parse(Map<String, dynamic> j) => Customer(
        id: j['id'] as int,
        name: j['name'] as String,
        phone: j['phone'] as String?,
        address: j['address'] as String?,
        city: j['city'] as String?,
        regionName: j['region_name'] as String?,
        creditLimit: _toDouble(j['credit_limit']),
        debt: _toDouble(j['debt']),
        visitDays: _days(j['visit_days']),
      );

  Future<List<Customer>> fetchCustomers() async {
    final data = await _client.get('/customers') as List<dynamic>;
    return data.map((j) => _parse(j as Map<String, dynamic>)).toList();
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
    List<String> visitDays = const [],
  }) async {
    await _client.post('/customers', data: {
      'name': name,
      if (phone != null && phone.isNotEmpty) 'phone': phone,
      if (address != null && address.isNotEmpty) 'address': address,
      if (city != null && city.isNotEmpty) 'city': city,
      if (regionId != null) 'region_id': regionId,
      if (visitDays.isNotEmpty) 'visit_days': visitDays.join(','),
    });
  }

  /// Updates the visit days for a market (assigned agent or manager).
  Future<Customer> updateVisitDays(int id, List<String> days) async {
    final data = await _client.patch('/customers/$id/visit-days',
        data: {'visit_days': days.isEmpty ? null : days.join(',')});
    return _parse(data as Map<String, dynamic>);
  }
}
