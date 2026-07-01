import 'dart:async';

import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';

import '../../../../core/network/connectivity_service.dart';
import '../../domain/repositories/order_repository.dart';

part 'outbox_state.dart';

/// App-wide owner of the offline order outbox: tracks connectivity, the number
/// of queued orders, and drains the queue automatically when the device comes
/// back online.
class OutboxCubit extends Cubit<OutboxState> {
  OutboxCubit(this._orders, this._connectivity) : super(const OutboxState());

  final OrderRepository _orders;
  final ConnectivityService _connectivity;
  StreamSubscription<bool>? _sub;

  Future<void> start() async {
    final online = await _connectivity.isOnline();
    final pending = await _orders.pendingCount();
    emit(state.copyWith(online: online, pending: pending));
    _sub = _connectivity.onStatusChange.listen(_onConnectivity);
    if (online && pending > 0) sync();
  }

  void _onConnectivity(bool online) {
    emit(state.copyWith(online: online));
    if (online) sync();
  }

  /// Refresh the pending count (e.g. right after an order is queued).
  Future<void> refresh() async {
    emit(state.copyWith(pending: await _orders.pendingCount()));
  }

  /// Try to send everything in the outbox. Bumps [OutboxState.syncedTick] when
  /// at least one order goes through so listeners (the orders list) can reload.
  Future<void> sync() async {
    if (state.syncing) return;
    emit(state.copyWith(syncing: true));
    try {
      final res = await _orders.syncPending();
      final pending = await _orders.pendingCount();
      emit(state.copyWith(
        syncing: false,
        pending: pending,
        online: !res.stillOffline,
        syncedTick: res.synced > 0 ? state.syncedTick + 1 : state.syncedTick,
        justSynced: res.synced,
      ));
    } catch (_) {
      emit(state.copyWith(syncing: false));
    }
  }

  @override
  Future<void> close() {
    _sub?.cancel();
    return super.close();
  }
}
