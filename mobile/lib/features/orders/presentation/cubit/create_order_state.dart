part of 'create_order_cubit.dart';

enum CreateOrderStatus { initial, loading, ready, submitting, success, error }

class CreateOrderState extends Equatable {
  const CreateOrderState({
    this.status = CreateOrderStatus.initial,
    this.products = const [],
    this.customers = const [],
    this.categories = const [],
    this.pieces = const {},
    this.boxes = const {},
    this.customerId,
    this.createdOrderId,
    this.createdStatus,
    this.queued = false,
    this.error,
  });

  final CreateOrderStatus status;
  final List<Product> products;
  final List<Customer> customers;
  final List<Category> categories;
  // A line is entered as two independent amounts: loose pieces and whole boxes.
  final Map<int, double> pieces; // productId -> loose single goods
  final Map<int, int> boxes;     // productId -> number of full boxes
  final int? customerId;
  final int? createdOrderId;
  final String? createdStatus; // 'approved' (auto) or 'pending'
  final bool queued; // saved to the offline outbox instead of sent
  final String? error;

  bool hasPosition(int productId) =>
      (pieces[productId] ?? 0) > 0 || (boxes[productId] ?? 0) > 0;

  List<int> get positionIds =>
      products.map((p) => p.id).where(hasPosition).toList();

  /// Total single goods for a product = loose pieces + boxes * box size.
  double unitsFor(Product p) {
    final loose = pieces[p.id] ?? 0;
    final b = boxes[p.id] ?? 0;
    final size = p.boxQty ?? 0;
    return loose + b * size;
  }

  double lineTotalFor(Product p) => unitsFor(p) * p.salePrice;

  double get total {
    var sum = 0.0;
    for (final p in products) {
      if (hasPosition(p.id)) sum += lineTotalFor(p);
    }
    return sum;
  }

  bool get canSubmit => customerId != null && positionIds.isNotEmpty;

  CreateOrderState copyWith({
    CreateOrderStatus? status,
    List<Product>? products,
    List<Customer>? customers,
    List<Category>? categories,
    Map<int, double>? pieces,
    Map<int, int>? boxes,
    int? customerId,
    int? createdOrderId,
    String? createdStatus,
    bool? queued,
    String? error,
  }) {
    return CreateOrderState(
      status: status ?? this.status,
      products: products ?? this.products,
      customers: customers ?? this.customers,
      categories: categories ?? this.categories,
      pieces: pieces ?? this.pieces,
      boxes: boxes ?? this.boxes,
      customerId: customerId ?? this.customerId,
      createdOrderId: createdOrderId ?? this.createdOrderId,
      createdStatus: createdStatus ?? this.createdStatus,
      queued: queued ?? this.queued,
      error: error,
    );
  }

  @override
  List<Object?> get props => [
        status,
        products,
        customers,
        categories,
        pieces,
        boxes,
        customerId,
        createdOrderId,
        createdStatus,
        queued,
        error,
      ];
}
