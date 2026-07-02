import '../../domain/entities/cash_summary.dart';
import '../../domain/entities/remittance.dart';
import '../../domain/repositories/cash_repository.dart';
import '../datasources/cash_remote_data_source.dart';

class CashRepositoryImpl implements CashRepository {
  CashRepositoryImpl(this._remote);

  final CashRemoteDataSource _remote;

  @override
  Future<CashSummary> fetchSummary() => _remote.fetchSummary();

  @override
  Future<List<Remittance>> listRemittances() => _remote.listRemittances();

  @override
  Future<void> submitHandover({required double amount, String? note}) =>
      _remote.submitHandover(amount: amount, note: note);
}
