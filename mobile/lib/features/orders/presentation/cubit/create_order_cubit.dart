import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';

import '../../../../core/network/api_exception.dart';
import '../../../customers/domain/entities/customer.dart';
import '../../../customers/domain/repositories/customer_repository.dart';
import '../../../products/domain/entities/category.dart';
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

  Future<void> init({int? initialCustomerId}) async {
    emit(state.copyWith(status: CreateOrderStatus.loading));
    try {
      final products = await _products.fetchProducts();
      final customers = await _customers.fetchCustomers();
      final categories = await _products.fetchCategories();
      emit(state.copyWith(
        status: CreateOrderStatus.ready,
        products: products,
        customers: customers,
        categories: categories,
        // Preselect the market when opened from its profile.
        customerId: initialCustomerId ?? state.customerId,
      ));
    } on ApiException catch (e) {
      emit(state.copyWith(status: CreateOrderStatus.error, error: e.message));
    }
  }

  /// Pull-to-refresh: refetch products/customers/categories but keep the order
  /// the agent is building (selected customer + entered amounts).
  Future<void> reload() async {
    try {
      final products = await _products.fetchProducts();
      final customers = await _customers.fetchCustomers();
      final categories = await _products.fetchCategories();
      emit(state.copyWith(
        products: products,
        customers: customers,
        categories: categories,
      ));
    } on ApiException {
      // Keep the current data if the refresh fails (e.g. offline).
    }
  }

  void selectCustomer(int? id) => emit(state.copyWith(customerId: id));

  /// Set a line's two independent amounts. Removing both clears the position.
  void setLine(int productId, {required double pieces, required int boxes}) {
    final p = Map<int, double>.from(state.pieces);
    final b = Map<int, int>.from(state.boxes);
    if (pieces <= 0) {
      p.remove(productId);
    } else {
      p[productId] = pieces;
    }
    if (boxes <= 0) {
      b.remove(productId);
    } else {
      b[productId] = boxes;
    }
    emit(state.copyWith(pieces: p, boxes: b));
  }

  Future<void> submit({String? note}) async {
    if (!state.canSubmit) return;
    emit(state.copyWith(status: CreateOrderStatus.submitting));
    try {
      final byId = {for (final p in state.products) p.id: p};
      final lines = state.positionIds.map((id) {
        final p = byId[id]!;
        // quantity = loose pieces + boxes * box size (total single goods);
        // box_count keeps the box breakdown for the receipt.
        return OrderLineInput(
          productId: id,
          quantity: state.unitsFor(p),
          boxCount: state.boxes[id] ?? 0,
        );
      }).toList();
      // Sends immediately when online; saves to the offline outbox otherwise.
      final res = await _orders.submitOrder(
        customerId: state.customerId!,
        lines: lines,
        note: note,
      );
      emit(state.copyWith(
        status: CreateOrderStatus.success,
        queued: res.queued,
        createdOrderId: res.id,
        createdStatus: res.status,
      ));
    } on ApiException catch (e) {
      emit(state.copyWith(status: CreateOrderStatus.error, error: e.message));
    }
  }
}
