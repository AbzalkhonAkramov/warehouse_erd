import '../entities/invoice.dart';

abstract class FinanceRepository {
  /// Invoices visible to the current user (agents see only their own orders').
  Future<List<Invoice>> listInvoices();

  /// A single invoice with its full payment history.
  Future<Invoice> getInvoice(int id);

  /// Record a cash/transfer/card payment against an invoice. Reduces the
  /// invoice balance and the customer's debt on the server.
  Future<void> recordPayment({
    required int invoiceId,
    required double amount,
    required String method,
    String? note,
  });
}
