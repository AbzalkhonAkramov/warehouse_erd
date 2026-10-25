import 'package:equatable/equatable.dart';

/// One product line inside a saved draft (keeps the agent's two-field entry:
/// loose pieces + whole boxes).
class DraftLine extends Equatable {
  const DraftLine({
    required this.productId,
    this.pieces = 0,
    this.boxes = 0,
  });

  final int productId;
  final double pieces;
  final int boxes;

  Map<String, dynamic> toJson() => {
        'product_id': productId,
        'pieces': pieces,
        'boxes': boxes,
      };

  factory DraftLine.fromJson(Map<String, dynamic> j) => DraftLine(
        productId: j['product_id'] as int,
        pieces: (j['pieces'] as num?)?.toDouble() ?? 0,
        boxes: (j['boxes'] as num?)?.toInt() ?? 0,
      );

  @override
  List<Object?> get props => [productId, pieces, boxes];
}

/// An order the agent started but did not send — kept locally until they resume
/// and submit it, or delete it. Unlike the offline outbox, a draft is NEVER sent
/// automatically; the agent chooses when. It may be incomplete (no customer yet).
class OrderDraft extends Equatable {
  const OrderDraft({
    required this.localId,
    required this.lines,
    required this.createdAt,
    this.customerId,
    this.note,
  });

  /// Client-generated id (millis-since-epoch) — unique within the drafts list.
  final String localId;
  final int? customerId;
  final List<DraftLine> lines;
  final String? note;
  final DateTime createdAt;

  Map<String, dynamic> toJson() => {
        'local_id': localId,
        'customer_id': customerId,
        'note': note,
        'created_at': createdAt.toIso8601String(),
        'lines': lines.map((l) => l.toJson()).toList(),
      };

  factory OrderDraft.fromJson(Map<String, dynamic> j) => OrderDraft(
        localId: j['local_id'] as String,
        customerId: j['customer_id'] as int?,
        note: j['note'] as String?,
        createdAt: DateTime.tryParse('${j['created_at']}') ?? DateTime.now(),
        lines: ((j['lines'] as List<dynamic>?) ?? [])
            .map((l) => DraftLine.fromJson(l as Map<String, dynamic>))
            .toList(),
      );

  @override
  List<Object?> get props => [localId, customerId, lines, note, createdAt];
}
