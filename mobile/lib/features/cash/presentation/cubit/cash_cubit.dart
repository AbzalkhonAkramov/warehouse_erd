import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';

import '../../../../core/network/api_exception.dart';
import '../../domain/entities/cash_summary.dart';
import '../../domain/entities/remittance.dart';
import '../../domain/repositories/cash_repository.dart';

part 'cash_state.dart';

class CashCubit extends Cubit<CashState> {
  CashCubit(this._repo) : super(const CashState());

  final CashRepository _repo;

  Future<void> load() async {
    emit(state.copyWith(status: CashStatus.loading, clearError: true));
    try {
      final summary = await _repo.fetchSummary();
      final history = await _repo.listRemittances();
      emit(state.copyWith(
        status: CashStatus.ready,
        summary: summary,
        history: history,
      ));
    } on ApiException catch (e) {
      emit(state.copyWith(status: CashStatus.error, error: e.message));
    }
  }

  /// Agent declares a handover (agent_submits mode). Returns true on success.
  Future<bool> submit({required double amount, String? note}) async {
    emit(state.copyWith(submitting: true, clearError: true));
    try {
      await _repo.submitHandover(amount: amount, note: note);
      final summary = await _repo.fetchSummary();
      final history = await _repo.listRemittances();
      emit(state.copyWith(
        submitting: false,
        summary: summary,
        history: history,
      ));
      return true;
    } on ApiException catch (e) {
      emit(state.copyWith(submitting: false, error: e.message));
      return false;
    }
  }
}
