import '../entities/customer.dart';
import '../entities/region.dart';

abstract class CustomerRepository {
  Future<List<Customer>> fetchCustomers();

  Future<List<Region>> fetchRegions();

  /// Creates a shop. When called by an agent the backend auto-assigns it to them.
  Future<void> createCustomer({
    required String name,
    String? phone,
    String? address,
    String? city,
    int? regionId,
  });
}
