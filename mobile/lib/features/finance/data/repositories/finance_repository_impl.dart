import '../../domain/entities/invoice.dart';
import '../../domain/repositories/finance_repository.dart';
import '../datasources/finance_remote_data_source.dart';

class FinanceRepositoryImpl implements FinanceRepository {
  FinanceRepositoryImpl(this._remote);

  final FinanceRemoteDataSource _remote;

  @override
  Future<List<Invoice>> listInvoices() => _remote.listInvoices();

  @override
  Future<Invoice> getInvoice(int id) => _remote.getInvoice(id);

  @override
  Future<void> recordPayment({
    required int invoiceId,
    required double amount,
    required String method,
    String? note,
  }) =>
      _remote.recordPayment(
        invoiceId: invoiceId,
        amount: amount,
        method: method,
        note: note,
      );
}
