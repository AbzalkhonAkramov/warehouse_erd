import 'package:equatable/equatable.dart';

class OrderItem extends Equatable {
  const OrderItem({
    required this.productId,
    required this.productName,
    required this.quantity,
    required this.unitPrice,
    required this.lineTotal,
    this.boxCount = 0,
    this.boxSize = 0,
  });

  final int productId;
  final String productName;
  final double quantity;   // total single goods
  final double unitPrice;
  final double lineTotal;
  final int boxCount;      // how many full boxes are inside `quantity`
  final int boxSize;       // units per box at sale time (for the breakdown)

  /// Loose (non-boxed) single goods on this line.
  double get loosePieces => quantity - boxCount * boxSize;

  @override
  List<Object?> get props =>
      [productId, productName, quantity, unitPrice, lineTotal, boxCount, boxSize];
}

class Order extends Equatable {
  const Order({
    required this.id,
    required this.orderNo,
    required this.status,
    required this.customerId,
    required this.subtotal,
    required this.discount,
    required this.total,
    required this.createdAt,
    this.customerName,
    this.customerAddress,
    this.deliverer,
    this.invoiceNumber,
    this.lines = const [],
  });

  final int id;
  final String orderNo;
  final String status; // new | shipped | delivered | refund | cancelled
  final int customerId;
  final String? customerName; // market (shop) name
  final String? customerAddress; // where to deliver
  final double subtotal;
  final double discount;
  final double total;
  final DateTime createdAt;
  final String? deliverer;
  final String? invoiceNumber;
  final List<OrderItem> lines;

  bool get shipped => status == 'shipped' || status == 'delivered';

  @override
  List<Object?> get props =>
      [id, orderNo, status, customerId, total, deliverer, invoiceNumber, lines];
}
