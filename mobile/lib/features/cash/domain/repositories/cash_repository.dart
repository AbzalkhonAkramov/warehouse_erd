import '../entities/cash_summary.dart';
import '../entities/remittance.dart';

abstract class CashRepository {
  Future<CashSummary> fetchSummary();
  Future<List<Remittance>> listRemittances();
  Future<void> submitHandover({required double amount, String? note});
}
