import 'package:equatable/equatable.dart';

class OrderLineInput extends Equatable {
  const OrderLineInput({
    required this.productId,
    required this.quantity,
    this.boxCount = 0,
  });

  final int productId;
  final double quantity; // total single goods (loose pieces + boxes * box size)
  final int boxCount;    // how many of the goods were entered as full boxes

  @override
  List<Object?> get props => [productId, quantity, boxCount];
}
