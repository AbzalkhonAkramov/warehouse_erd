import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';

import '../../../../core/network/api_exception.dart';
import '../../../customers/domain/repositories/customer_repository.dart';
import '../../domain/entities/order.dart';
import '../../domain/entities/pending_order.dart';
import '../../domain/repositories/order_repository.dart';

part 'orders_state.dart';

class OrdersCubit extends Cubit<OrdersState> {
  OrdersCubit(this._orders, this._customers) : super(const OrdersState());

  final OrderRepository _orders;
  final CustomerRepository _customers;

  Future<void> load() async {
    emit(state.copyWith(status: OrdersStatus.loading));
    // Locally queued orders show first — available even with no connection.
    final pending = await _orders.pendingOrders();
    try {
      final orders = await _orders.listOrders();
      final customers = await _customers.fetchCustomers();
      final names = {for (final c in customers) c.id: c.name};
      emit(state.copyWith(
        status: OrdersStatus.ready,
        orders: orders,
        pending: pending,
        customerNames: names,
        offline: false,
      ));
    } on ApiException catch (e) {
      if (e.isNetwork) {
        // Offline: still show whatever is queued, plus an offline notice.
        emit(state.copyWith(
          status: OrdersStatus.ready,
          orders: const [],
          pending: pending,
          offline: true,
        ));
      } else {
        emit(state.copyWith(status: OrdersStatus.error, error: e.message));
      }
    }
  }
}
