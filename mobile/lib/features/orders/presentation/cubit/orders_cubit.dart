import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';

import '../../../../core/network/api_exception.dart';
import '../../../customers/domain/repositories/customer_repository.dart';
import '../../domain/entities/order.dart';
import '../../domain/repositories/order_repository.dart';

part 'orders_state.dart';

class OrdersCubit extends Cubit<OrdersState> {
  OrdersCubit(this._orders, this._customers) : super(const OrdersState());

  final OrderRepository _orders;
  final CustomerRepository _customers;

  Future<void> load() async {
    emit(state.copyWith(status: OrdersStatus.loading));
    try {
      final orders = await _orders.listOrders();
      final customers = await _customers.fetchCustomers();
      final names = {for (final c in customers) c.id: c.name};
      emit(state.copyWith(
        status: OrdersStatus.ready,
        orders: orders,
        customerNames: names,
      ));
    } on ApiException catch (e) {
      emit(state.copyWith(status: OrdersStatus.error, error: e.message));
    }
  }
}
