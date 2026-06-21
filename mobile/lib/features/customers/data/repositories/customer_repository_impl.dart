import '../../domain/entities/customer.dart';
import '../../domain/repositories/customer_repository.dart';
import '../datasources/customer_remote_data_source.dart';

class CustomerRepositoryImpl implements CustomerRepository {
  CustomerRepositoryImpl(this._remote);

  final CustomerRemoteDataSource _remote;

  @override
  Future<List<Customer>> fetchCustomers() => _remote.fetchCustomers();

  @override
  Future<void> createCustomer({
    required String name,
    String? phone,
    String? address,
  }) =>
      _remote.createCustomer(name: name, phone: phone, address: address);
}
