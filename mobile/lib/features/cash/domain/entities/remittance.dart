import 'package:equatable/equatable.dart';

class Remittance extends Equatable {
  const Remittance({
    required this.id,
    required this.amount,
    required this.status,
    required this.createdAt,
    this.receivedAt,
    this.receivedByName,
    this.note,
  });

  final int id;
  final double amount;
  final String status; // pending | received
  final DateTime createdAt;
  final DateTime? receivedAt;
  final String? receivedByName;
  final String? note;

  bool get received => status == 'received';

  @override
  List<Object?> get props => [id, amount, status, createdAt];
}
