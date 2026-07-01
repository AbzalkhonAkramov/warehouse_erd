import 'package:equatable/equatable.dart';

import 'order_line_input.dart';

/// An order captured while offline, waiting in the local outbox to be sent once
/// the device is back online.
class PendingOrder extends Equatable {
  const PendingOrder({
    required this.localId,
    required this.customerId,
    required this.lines,
    required this.createdAt,
    this.note,
  });

  /// Client-generated id (millis-since-epoch string) — unique within the queue.
  final String localId;
  final int customerId;
  final List<OrderLineInput> lines;
  final DateTime createdAt;
  final String? note;

  double totalWith(double Function(int productId) unitPrice) {
    var sum = 0.0;
    for (final l in lines) {
      sum += l.quantity * unitPrice(l.productId);
    }
    return sum;
  }

  Map<String, dynamic> toJson() => {
        'local_id': localId,
        'customer_id': customerId,
        'note': note,
        'created_at': createdAt.toIso8601String(),
        'lines': lines
            .map((l) => {'product_id': l.productId, 'quantity': l.quantity})
            .toList(),
      };

  factory PendingOrder.fromJson(Map<String, dynamic> j) => PendingOrder(
        localId: j['local_id'] as String,
        customerId: j['customer_id'] as int,
        note: j['note'] as String?,
        createdAt: DateTime.tryParse('${j['created_at']}') ?? DateTime.now(),
        lines: ((j['lines'] as List<dynamic>?) ?? [])
            .map((l) => OrderLineInput(
                  productId: l['product_id'] as int,
                  quantity: (l['quantity'] as num).toDouble(),
                ))
            .toList(),
      );

  @override
  List<Object?> get props => [localId, customerId, note, createdAt, lines];
}
