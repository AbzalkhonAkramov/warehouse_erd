import 'package:flutter/material.dart';

import '../../../../core/config.dart';
import '../../../../core/format.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../l10n/l10n_ext.dart';
import '../../domain/entities/product.dart';

/// Full product detail: photo, name, price, and how many are left in stock.
class ProductDetailPage extends StatelessWidget {
  const ProductDetailPage({
    super.key,
    required this.product,
    this.showStock = true,
  });

  final Product product;
  final bool showStock;

  String _price(Product p) =>
      p.currencySymbol != null ? '${money(p.salePrice)} ${p.currencySymbol}' : money(p.salePrice);

  String _box(BuildContext context, Product p) {
    if (!p.hasBox) return context.tr('product.noBox');
    final parts = <String>['${p.boxQty} ${p.unit}'];
    if (p.boxWeight != null) parts.add('${qty(p.boxWeight!)} kg');
    if (p.boxDimensions != null && p.boxDimensions!.isNotEmpty) parts.add(p.boxDimensions!);
    return parts.join(' · ');
  }

  @override
  Widget build(BuildContext context) {
    final p = product;
    final low = p.onHand <= 0;
    return Scaffold(
      appBar: AppBar(title: Text(p.name)),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            clipBehavior: Clip.antiAlias,
            child: SizedBox(
              height: 260,
              width: double.infinity,
              child: _Photo(product: p),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            p.name,
            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          Text(
            _price(p),
            style: const TextStyle(
              color: AppColors.brand,
              fontSize: 24,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 20),
          Card(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
              child: Column(
                children: [
                  if (showStock)
                    _row(
                      Icons.inventory_2_outlined,
                      context.tr('product.left'),
                      '${qty(p.onHand)} ${p.unit}',
                      valueColor: low ? AppColors.danger : AppColors.success,
                    ),
                  _row(Icons.sell_outlined, context.tr('product.price'),
                      _price(p)),
                  if (p.currencyCode != null)
                    _row(Icons.payments_outlined, context.tr('product.currency'),
                        p.currencyCode!),
                  _row(Icons.local_shipping_outlined, context.tr('product.saleMode'),
                      context.tr('saleMode.${p.saleMode}')),
                  _row(Icons.numbers_outlined, context.tr('product.qtyType'),
                      context.tr(p.integerQty ? 'qtyType.integer' : 'qtyType.fractional')),
                  _row(Icons.inbox_outlined, context.tr('product.box'),
                      _box(context, p)),
                  _row(Icons.straighten_outlined, context.tr('product.unit'),
                      p.unit),
                  _row(Icons.qr_code_2_outlined, context.tr('product.sku'), p.sku,
                      last: true),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _row(IconData icon, String label, String value,
      {Color? valueColor, bool last = false}) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: BoxDecoration(
        border: last
            ? null
            : const Border(bottom: BorderSide(color: AppColors.line)),
      ),
      child: Row(
        children: [
          Icon(icon, size: 18, color: AppColors.neutral),
          const SizedBox(width: 12),
          Text(label, style: const TextStyle(color: AppColors.neutral)),
          const Spacer(),
          Text(
            value,
            style: TextStyle(
                fontWeight: FontWeight.w600, color: valueColor),
          ),
        ],
      ),
    );
  }
}

class _Photo extends StatelessWidget {
  const _Photo({required this.product});

  final Product product;

  @override
  Widget build(BuildContext context) {
    const placeholder = ColoredBox(
      color: Color(0xFFF1F5F9),
      child: Center(
        child: Icon(Icons.inventory_2_outlined, color: AppColors.line, size: 56),
      ),
    );
    if (product.imagePath == null) return placeholder;
    return ColoredBox(
      color: const Color(0xFFF8FAFC),
      child: Image.network(
        AppConfig.uploadUrl(product.imagePath!),
        fit: BoxFit.contain,
        width: double.infinity,
        errorBuilder: (_, __, ___) => placeholder,
        loadingBuilder: (context, child, progress) => progress == null
            ? child
            : const Center(
                child: SizedBox(
                  width: 26,
                  height: 26,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              ),
      ),
    );
  }
}
