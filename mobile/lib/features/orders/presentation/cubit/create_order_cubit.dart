import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';

import '../../../../core/network/api_exception.dart';
import '../../../customers/domain/entities/customer.dart';
import '../../../customers/domain/repositories/customer_repository.dart';
import '../../../products/domain/entities/category.dart';
import '../../../products/domain/entities/product.dart';
import '../../../products/domain/repositories/product_repository.dart';
import '../../data/datasources/draft_local_data_source.dart';
import '../../domain/entities/order_draft.dart';
import '../../domain/entities/order_line_input.dart';
import '../../domain/repositories/order_repository.dart';

part 'create_order_state.dart';

class CreateOrderCubit extends Cubit<CreateOrderState> {
  CreateOrderCubit(this._orders, this._products, this._customers, this._drafts)
      : super(const CreateOrderState());

  final OrderRepository _orders;
  final ProductRepository _products;
  final CustomerRepository _customers;
  final DraftLocalDataSource _drafts;

  Future<void> init({int? initialCustomerId, OrderDraft? draft}) async {
    emit(state.copyWith(status: CreateOrderStatus.loading));
    try {
      final products = await _products.fetchProducts();
      final customers = await _customers.fetchCustomers();
      final categories = await _products.fetchCategories();
      if (draft != null) {
        // Resume a saved draft: restore its customer + lines, remember its id.
        final pieces = {
          for (final l in draft.lines)
            if (l.pieces > 0) l.productId: l.pieces
        };
        final boxes = {
          for (final l in draft.lines)
            if (l.boxes > 0) l.productId: l.boxes
        };
        emit(CreateOrderState(
          status: CreateOrderStatus.ready,
          products: products,
          customers: customers,
          categories: categories,
          pieces: pieces,
          boxes: boxes,
          customerId: draft.customerId,
          editingDraftId: draft.localId,
        ));
        return;
      }
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

  /// Save the current (possibly incomplete) order as a draft, then clear the
  /// form. Nothing to save if there is neither a customer nor any line.
  Future<void> saveDraft({String? note}) async {
    final ids = {...state.pieces.keys, ...state.boxes.keys};
    if (state.customerId == null && ids.isEmpty) return;
    final lines = ids
        .map((id) => DraftLine(
              productId: id,
              pieces: state.pieces[id] ?? 0,
              boxes: state.boxes[id] ?? 0,
            ))
        .toList();
    await _drafts.upsert(OrderDraft(
      localId: state.editingDraftId ??
          DateTime.now().microsecondsSinceEpoch.toString(),
      customerId: state.customerId,
      lines: lines,
      note: note,
      createdAt: DateTime.now(),
    ));
    // Reset the form to a fresh, empty order (keeps loaded reference data).
    emit(CreateOrderState(
      status: CreateOrderStatus.draftSaved,
      products: state.products,
      customers: state.customers,
      categories: state.categories,
    ));
  }

  /// Flip a one-shot status (draftSaved) back to the editable form.
  void markReady() => emit(state.copyWith(status: CreateOrderStatus.ready));

  /// Clear the form to a fresh, empty order (keeps the loaded reference data).
  /// Used after a successful send so the positions list is emptied.
  void reset() {
    emit(CreateOrderState(
      status: CreateOrderStatus.ready,
      products: state.products,
      customers: state.customers,
      categories: state.categories,
    ));
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
      // Resuming a draft that is now sent (or queued) — drop it.
      if (state.editingDraftId != null) {
        await _drafts.remove(state.editingDraftId!);
      }
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
