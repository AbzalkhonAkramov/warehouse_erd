part of 'orders_cubit.dart';

enum OrdersStatus { initial, loading, ready, error }

class OrdersState extends Equatable {
  const OrdersState({
    this.status = OrdersStatus.initial,
    this.orders = const [],
    this.customerNames = const {},
    this.error,
  });

  final OrdersStatus status;
  final List<Order> orders;
  final Map<int, String> customerNames;
  final String? error;

  OrdersState copyWith({
    OrdersStatus? status,
    List<Order>? orders,
    Map<int, String>? customerNames,
    String? error,
  }) {
    return OrdersState(
      status: status ?? this.status,
      orders: orders ?? this.orders,
      customerNames: customerNames ?? this.customerNames,
      error: error,
    );
  }

  @override
  List<Object?> get props => [status, orders, customerNames, error];
}
