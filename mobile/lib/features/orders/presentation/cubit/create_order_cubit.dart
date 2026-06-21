import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';

import '../../../../core/network/api_exception.dart';
import '../../../customers/domain/entities/customer.dart';
import '../../../customers/domain/repositories/customer_repository.dart';
import '../../../products/domain/entities/product.dart';
import '../../../products/domain/repositories/product_repository.dart';
import '../../domain/entities/order_line_input.dart';
import '../../domain/repositories/order_repository.dart';

part 'create_order_state.dart';

class CreateOrderCubit extends Cubit<CreateOrderState> {
  CreateOrderCubit(this._orders, this._products, this._customers)
      : super(const CreateOrderState());

  final OrderRepository _orders;
  final ProductRepository _products;
  final CustomerRepository _customers;

  Future<void> init() async {
    emit(state.copyWith(status: CreateOrderStatus.loading));
    try {
      final products = await _products.fetchProducts();
      final customers = await _customers.fetchCustomers();
      emit(state.copyWith(
        status: CreateOrderStatus.ready,
        products: products,
        customers: customers,
      ));
    } on ApiException catch (e) {
      emit(state.copyWith(status: CreateOrderStatus.error, error: e.message));
    }
  }

  void selectCustomer(int? id) => emit(state.copyWith(customerId: id));

  void setQuantity(int productId, double qty) {
    final next = Map<int, double>.from(state.quantities);
    if (qty <= 0) {
      next.remove(productId);
    } else {
      next[productId] = qty;
    }
    emit(state.copyWith(quantities: next));
  }

  Future<void> submit({String? note}) async {
    if (state.customerId == null || state.quantities.isEmpty) return;
    emit(state.copyWith(status: CreateOrderStatus.submitting));
    try {
      final lines = state.quantities.entries
          .map((e) => OrderLineInput(productId: e.key, quantity: e.value))
          .toList();
      final res = await _orders.createOrder(
        customerId: state.customerId!,
        lines: lines,
        note: note,
      );
      emit(state.copyWith(
        status: CreateOrderStatus.success,
        createdOrderId: res.id,
        createdStatus: res.status,
      ));
    } on ApiException catch (e) {
      emit(state.copyWith(status: CreateOrderStatus.error, error: e.message));
    }
  }
}
