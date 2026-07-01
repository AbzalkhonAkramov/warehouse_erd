import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';

import '../../../../core/network/api_exception.dart';
import '../../domain/entities/invoice.dart';
import '../../domain/repositories/finance_repository.dart';

part 'invoice_detail_state.dart';

class InvoiceDetailCubit extends Cubit<InvoiceDetailState> {
  InvoiceDetailCubit(this._finance, this.invoiceId, this.customerName)
      : super(const InvoiceDetailState());

  final FinanceRepository _finance;
  final int invoiceId;
  final String customerName;

  Future<void> load() async {
    emit(state.copyWith(status: DetailStatus.loading, clearMessages: true));
    try {
      final invoice = await _finance.getInvoice(invoiceId);
      emit(state.copyWith(status: DetailStatus.ready, invoice: invoice));
    } on ApiException catch (e) {
      emit(state.copyWith(status: DetailStatus.error, error: e.message));
    }
  }

  /// Records a payment then reloads the invoice so the balance/history refresh.
  /// Returns true on success (the caller can pop the sheet / show a toast).
  Future<bool> recordPayment({
    required double amount,
    required String method,
    String? note,
  }) async {
    emit(state.copyWith(submitting: true, clearMessages: true));
    try {
      await _finance.recordPayment(
        invoiceId: invoiceId,
        amount: amount,
        method: method,
        note: note,
      );
      final invoice = await _finance.getInvoice(invoiceId);
      emit(state.copyWith(
        status: DetailStatus.ready,
        invoice: invoice,
        submitting: false,
        paidJustNow: true,
      ));
      return true;
    } on ApiException catch (e) {
      emit(state.copyWith(submitting: false, error: e.message));
      return false;
    }
  }
}
