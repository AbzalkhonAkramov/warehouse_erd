import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';

import '../../../../core/network/api_exception.dart';
import '../../../customers/domain/repositories/customer_repository.dart';
import '../../domain/entities/invoice.dart';
import '../../domain/repositories/finance_repository.dart';

part 'invoices_state.dart';

class InvoicesCubit extends Cubit<InvoicesState> {
  InvoicesCubit(this._finance, this._customers) : super(const InvoicesState());

  final FinanceRepository _finance;
  final CustomerRepository _customers;

  Future<void> load() async {
    emit(state.copyWith(status: InvoicesStatus.loading));
    try {
      final invoices = await _finance.listInvoices();
      final customers = await _customers.fetchCustomers();
      final names = {for (final c in customers) c.id: c.name};
      emit(state.copyWith(
        status: InvoicesStatus.ready,
        invoices: invoices,
        customerNames: names,
      ));
    } on ApiException catch (e) {
      emit(state.copyWith(status: InvoicesStatus.error, error: e.message));
    }
  }

  void setFilter(InvoiceFilter filter) => emit(state.copyWith(filter: filter));
}
