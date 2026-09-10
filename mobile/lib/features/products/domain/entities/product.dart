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
    this.currencyCode,
    this.currencySymbol,
    this.boxQty,
    this.boxWeight,
    this.boxDimensions,
    this.saleMode = 'piece',
  });

  final int id;
  final String sku;
  final String name;
  final String unit;
  final double salePrice; // retail price (agents never see the purchase price)
  final int? categoryId;
  final String? imagePath;
  final double onHand; // available stock

  // Money type + packaging + sale mode. Set by a manager on web; agents only
  // read these here.
  final String? currencyCode;   // UZS, USD
  final String? currencySymbol; // so'm, $
  final int? boxQty;            // units per box; null = no box
  final double? boxWeight;      // kg per box
  final String? boxDimensions;  // "40x30x25 cm"
  final String saleMode;        // box | piece | both

  bool get hasBox => boxQty != null && boxQty! > 0;

  @override
  List<Object?> get props => [
        id,
        sku,
        name,
        unit,
        salePrice,
        categoryId,
        imagePath,
        onHand,
        currencyCode,
        currencySymbol,
        boxQty,
        boxWeight,
        boxDimensions,
        saleMode,
      ];
}
