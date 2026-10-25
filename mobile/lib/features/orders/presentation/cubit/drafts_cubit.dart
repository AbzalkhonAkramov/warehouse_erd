import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';

import '../../../customers/domain/repositories/customer_repository.dart';
import '../../data/datasources/draft_local_data_source.dart';
import '../../domain/entities/order_draft.dart';

part 'drafts_state.dart';

/// Lists saved order drafts and lets the agent delete them. Customer names are
/// resolved from the cached customer list for display.
class DraftsCubit extends Cubit<DraftsState> {
  DraftsCubit(this._drafts, this._customers) : super(const DraftsState());

  final DraftLocalDataSource _drafts;
  final CustomerRepository _customers;

  Future<void> load() async {
    emit(state.copyWith(loading: true));
    final drafts = await _drafts.getAll();
    var names = state.customerNames;
    if (names.isEmpty) {
      try {
        final customers = await _customers.fetchCustomers();
        names = {for (final c in customers) c.id: c.name};
      } catch (_) {
        // Offline: fall back to showing no name.
      }
    }
    emit(DraftsState(loading: false, drafts: drafts, customerNames: names));
  }

  Future<void> delete(String localId) async {
    await _drafts.remove(localId);
    await load();
  }
}
