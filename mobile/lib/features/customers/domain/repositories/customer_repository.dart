import '../entities/customer.dart';

abstract class CustomerRepository {
  Future<List<Customer>> fetchCustomers();

  /// Creates a shop. When called by an agent the backend auto-assigns it to them.
  Future<void> createCustomer({
    required String name,
    String? phone,
    String? address,
  });
}
