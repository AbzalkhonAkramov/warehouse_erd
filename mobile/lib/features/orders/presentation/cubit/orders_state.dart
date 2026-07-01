part of 'orders_cubit.dart';

enum OrdersStatus { initial, loading, ready, error }

class OrdersState extends Equatable {
  const OrdersState({
    this.status = OrdersStatus.initial,
    this.orders = const [],
    this.pending = const [],
    this.customerNames = const {},
    this.offline = false,
    this.error,
  });

  final OrdersStatus status;
  final List<Order> orders;

  /// Orders captured offline, still waiting to be sent.
  final List<PendingOrder> pending;
  final Map<int, String> customerNames;
  final bool offline;
  final String? error;

  OrdersState copyWith({
    OrdersStatus? status,
    List<Order>? orders,
    List<PendingOrder>? pending,
    Map<int, String>? customerNames,
    bool? offline,
    String? error,
  }) {
    return OrdersState(
      status: status ?? this.status,
      orders: orders ?? this.orders,
      pending: pending ?? this.pending,
      customerNames: customerNames ?? this.customerNames,
      offline: offline ?? this.offline,
      error: error,
    );
  }

  @override
  List<Object?> get props =>
      [status, orders, pending, customerNames, offline, error];
}
