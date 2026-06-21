import 'package:equatable/equatable.dart';

class OrderLineInput extends Equatable {
  const OrderLineInput({required this.productId, required this.quantity});

  final int productId;
  final double quantity;

  @override
  List<Object?> get props => [productId, quantity];
}
