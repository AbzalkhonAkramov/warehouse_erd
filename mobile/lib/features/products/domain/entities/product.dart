import 'package:equatable/equatable.dart';

class Product extends Equatable {
  const Product({
    required this.id,
    required this.sku,
    required this.name,
    required this.unit,
    required this.salePrice,
    this.categoryId,
    this.imagePath,
    this.onHand = 0,
  });

  final int id;
  final String sku;
  final String name;
  final String unit;
  final double salePrice; // retail price (agents never see the purchase price)
  final int? categoryId;
  final String? imagePath;
  final double onHand; // available stock

  @override
  List<Object?> get props =>
      [id, sku, name, unit, salePrice, categoryId, imagePath, onHand];
}
