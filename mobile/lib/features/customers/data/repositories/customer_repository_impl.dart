import '../../domain/entities/customer.dart';
import '../../domain/entities/region.dart';
import '../../domain/repositories/customer_repository.dart';
import '../datasources/customer_remote_data_source.dart';

class CustomerRepositoryImpl implements CustomerRepository {
  CustomerRepositoryImpl(this._remote);

  final CustomerRemoteDataSource _remote;

  @override
  Future<List<Customer>> fetchCustomers() => _remote.fetchCustomers();

  @override
  Future<List<Region>> fetchRegions() => _remote.fetchRegions();

  @override
  Future<void> createCustomer({
    required String name,
    String? phone,
    String? address,
    String? city,
    int? regionId,
    List<String> visitDays = const [],
  }) =>
      _remote.createCustomer(
        name: name,
        phone: phone,
        address: address,
        city: city,
        regionId: regionId,
        visitDays: visitDays,
      );

  @override
  Future<Customer> updateVisitDays(int id, List<String> days) =>
      _remote.updateVisitDays(id, days);
}
