part of 'create_order_cubit.dart';

enum CreateOrderStatus { initial, loading, ready, submitting, success, error }

class CreateOrderState extends Equatable {
  const CreateOrderState({
    this.status = CreateOrderStatus.initial,
    this.products = const [],
    this.customers = const [],
    this.categories = const [],
    this.quantities = const {},
    this.customerId,
    this.createdOrderId,
    this.createdStatus,
    this.error,
  });

  final CreateOrderStatus status;
  final List<Product> products;
  final List<Customer> customers;
  final List<Category> categories;
  final Map<int, double> quantities;
  final int? customerId;
  final int? createdOrderId;
  final String? createdStatus; // 'approved' (auto) or 'pending'
  final String? error;

  double get total {
    var sum = 0.0;
    for (final p in products) {
      final q = quantities[p.id];
      if (q != null) sum += q * p.salePrice;
    }
    return sum;
  }

  bool get canSubmit => customerId != null && quantities.isNotEmpty;

  CreateOrderState copyWith({
    CreateOrderStatus? status,
    List<Product>? products,
    List<Customer>? customers,
    List<Category>? categories,
    Map<int, double>? quantities,
    int? customerId,
    int? createdOrderId,
    String? createdStatus,
    String? error,
  }) {
    return CreateOrderState(
      status: status ?? this.status,
      products: products ?? this.products,
      customers: customers ?? this.customers,
      categories: categories ?? this.categories,
      quantities: quantities ?? this.quantities,
      customerId: customerId ?? this.customerId,
      createdOrderId: createdOrderId ?? this.createdOrderId,
      createdStatus: createdStatus ?? this.createdStatus,
      error: error,
    );
  }

  @override
  List<Object?> get props => [
        status,
        products,
        customers,
        categories,
        quantities,
        customerId,
        createdOrderId,
        createdStatus,
        error,
      ];
}
