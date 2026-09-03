import 'package:flutter/material.dart';

import '../../../../core/format.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../l10n/l10n_ext.dart';
import '../../../orders/presentation/pages/create_order_page.dart';
import '../../../photo_report/presentation/pages/photo_report_page.dart';
import '../../../returns/presentation/pages/return_products_page.dart';
import '../../domain/entities/customer.dart';
import '../widgets/visit_day_picker.dart';

/// Market (shop) profile: info, visit days (read-only — managers edit them), and
/// quick actions: create an order, send a before/after photo, or return goods.
class MarketProfilePage extends StatelessWidget {
  const MarketProfilePage({super.key, required this.customer});

  final Customer customer;

  @override
  Widget build(BuildContext context) {
    final c = customer;
    final overLimit = c.creditLimit > 0 && c.debt > c.creditLimit;
    return Scaffold(
      appBar: AppBar(title: Text(context.tr('market.profile'))),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 26,
                backgroundColor: AppColors.brand.withValues(alpha: 0.12),
                child: Text(
                  c.name.characters.isEmpty
                      ? '?'
                      : c.name.characters.first.toUpperCase(),
                  style: const TextStyle(
                      color: AppColors.brand,
                      fontWeight: FontWeight.bold,
                      fontSize: 20),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Text(c.name,
                    style: const TextStyle(
                        fontSize: 20, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
          const SizedBox(height: 20),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                children: [
                  if (c.phone != null && c.phone!.isNotEmpty)
                    _row(Icons.phone_outlined, c.phone!),
                  if (c.address != null && c.address!.isNotEmpty)
                    _row(Icons.location_on_outlined, c.address!),
                  if (c.city != null && c.city!.isNotEmpty)
                    _row(Icons.location_city_outlined, c.city!),
                  if (c.regionName != null && c.regionName!.isNotEmpty)
                    _row(Icons.map_outlined, c.regionName!),
                  _row(
                    Icons.account_balance_wallet_outlined,
                    '${context.tr('market.debt')}: ${money(c.debt)}'
                    '   ·   ${context.tr('market.limit')}: ${money(c.creditLimit)}',
                    color: overLimit ? AppColors.danger : null,
                  ),
                  _row(
                    Icons.event_outlined,
                    '${context.tr('market.visitDays')}: '
                    '${visitDaysLabel(context, c.visitDays)}',
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),
          FilledButton.icon(
            onPressed: () => Navigator.of(context).push(MaterialPageRoute(
              builder: (_) => CreateOrderPage(
                initialCustomerId: c.id,
                standalone: true,
              ),
            )),
            icon: const Icon(Icons.add_shopping_cart_outlined),
            label: Padding(
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: Text(context.tr('market.createOrder')),
            ),
          ),
          const SizedBox(height: 10),
          OutlinedButton.icon(
            onPressed: () => Navigator.of(context).push(MaterialPageRoute(
              builder: (_) => PhotoReportPage(
                initialCustomerId: c.id,
                lockSelection: true,
                standalone: true,
              ),
            )),
            icon: const Icon(Icons.camera_alt_outlined),
            label: Padding(
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: Text(context.tr('market.sendPhoto')),
            ),
          ),
          const SizedBox(height: 10),
          OutlinedButton.icon(
            onPressed: () => Navigator.of(context).push(MaterialPageRoute(
              builder: (_) => ReturnProductsPage(
                customerId: c.id,
                customerName: c.name,
              ),
            )),
            icon: const Icon(Icons.assignment_return_outlined),
            label: Padding(
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: Text(context.tr('market.returnGoods')),
            ),
          ),
        ],
      ),
    );
  }

  Widget _row(IconData icon, String text, {Color? color}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          children: [
            Icon(icon, size: 18, color: AppColors.neutral),
            const SizedBox(width: 12),
            Expanded(child: Text(text, style: TextStyle(fontSize: 14, color: color))),
          ],
        ),
      );
}
