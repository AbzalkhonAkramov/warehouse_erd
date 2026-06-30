import 'package:equatable/equatable.dart';

class OrderItem extends Equatable {
  const OrderItem({
    required this.productId,
    required this.productName,
    required this.quantity,
    required this.unitPrice,
    required this.lineTotal,
  });

  final int productId;
  final String productName;
  final double quantity;
  final double unitPrice;
  final double lineTotal;

  @override
  List<Object?> get props => [productId, productName, quantity, unitPrice, lineTotal];
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
    this.deliverer,
    this.invoiceNumber,
    this.lines = const [],
  });

  final int id;
  final String orderNo;
  final String status; // new | shipped | delivered | refund | cancelled
  final int customerId;
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
