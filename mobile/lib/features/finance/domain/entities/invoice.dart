import 'package:equatable/equatable.dart';

class Payment extends Equatable {
  const Payment({
    required this.id,
    required this.invoiceId,
    required this.amount,
    required this.method,
    required this.collectedAt,
    this.collectedByName,
    this.note,
  });

  final int id;
  final int invoiceId;
  final double amount;
  final String method; // cash | transfer | card
  final DateTime collectedAt;
  final String? collectedByName;
  final String? note;

  @override
  List<Object?> get props => [id, invoiceId, amount, method, collectedAt, note];
}

class Invoice extends Equatable {
  const Invoice({
    required this.id,
    required this.number,
    required this.salesOrderId,
    required this.customerId,
    required this.total,
    required this.paidAmount,
    required this.status,
    required this.createdAt,
    this.payments = const [],
  });

  final int id;
  final String number;
  final int salesOrderId;
  final int customerId;
  final double total;
  final double paidAmount;
  final String status; // unpaid | partial | paid
  final DateTime createdAt;
  final List<Payment> payments; // populated only in the detail view

  /// Outstanding amount still owed on this invoice.
  double get balance {
    final b = total - paidAmount;
    return b < 0 ? 0 : b;
  }

  bool get isPaid => status == 'paid';

  @override
  List<Object?> get props =>
      [id, number, salesOrderId, customerId, total, paidAmount, status, createdAt];
}
