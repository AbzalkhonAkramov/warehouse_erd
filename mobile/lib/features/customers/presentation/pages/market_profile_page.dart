import 'package:flutter/material.dart';

import '../../../../core/di/injection.dart';
import '../../../../core/format.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../l10n/l10n_ext.dart';
import '../../../orders/domain/entities/order.dart';
import '../../../orders/domain/repositories/order_repository.dart';
import '../../../orders/presentation/pages/create_order_page.dart';
import '../../../orders/presentation/pages/receipt_page.dart';
import '../../../photo_report/presentation/pages/photo_report_page.dart';
import '../../domain/entities/customer.dart';
import '../widgets/visit_day_picker.dart';
import 'market_orders_page.dart';

/// Market (shop) profile: a grid of field services (desktop-parity), the client
/// balance in the app bar, and this market's delivered orders as quick actions.
class MarketProfilePage extends StatefulWidget {
  const MarketProfilePage({super.key, required this.customer});

  final Customer customer;

  @override
  State<MarketProfilePage> createState() => _MarketProfilePageState();
}

class _MarketProfilePageState extends State<MarketProfilePage> {
  bool _ordersLoading = true;
  List<Order> _delivered = const [];

  Customer get c => widget.customer;

  @override
  void initState() {
    super.initState();
    _loadDelivered();
  }

  Future<void> _loadDelivered() async {
    try {
      final all = await sl<OrderRepository>().listOrders();
      if (!mounted) return;
      setState(() {
        _delivered = all
            .where((o) => o.customerId == c.id && o.status == 'delivered')
            .toList();
        _ordersLoading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _ordersLoading = false);
    }
  }

  void _push(Widget page) =>
      Navigator.of(context).push(MaterialPageRoute(builder: (_) => page));

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(context.tr('market.profile')),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _header(context),
          const SizedBox(height: 20),
          Text(context.tr('market.deliveredOrders'),
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
          const SizedBox(height: 8),
          _deliveredSection(context),
        ],
      ),
      // The only three abilities available in a market profile.
      bottomNavigationBar: SafeArea(
        child: Container(
          decoration: const BoxDecoration(
            border: Border(top: BorderSide(color: AppColors.line)),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
          child: Row(
            children: [
              _bottomAction(context, Icons.camera_alt_outlined, 'service.photo',
                  () => _push(PhotoReportPage(
                        initialCustomerId: c.id,
                        lockSelection: true,
                        standalone: true,
                      ))),
              _bottomAction(context, Icons.history, 'service.orderHistory',
                  () => _push(MarketOrdersPage(
                        customerId: c.id,
                        title: context.tr('service.orderHistory'),
                      ))),
              _bottomAction(context, Icons.add_shopping_cart_outlined,
                  'service.addOrder',
                  () => _push(CreateOrderPage(
                      initialCustomerId: c.id, standalone: true))),
            ],
          ),
        ),
      ),
    );
  }

  Widget _bottomAction(
      BuildContext context, IconData icon, String labelKey, VoidCallback onTap) {
    return Expanded(
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, color: AppColors.brand, size: 22),
              const SizedBox(height: 3),
              Text(
                context.tr(labelKey),
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 11),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _header(BuildContext context) => Row(
        children: [
          CircleAvatar(
            radius: 24,
            backgroundColor: AppColors.brand.withValues(alpha: 0.12),
            child: Text(
              c.name.characters.isEmpty
                  ? '?'
                  : c.name.characters.first.toUpperCase(),
              style: const TextStyle(
                  color: AppColors.brand,
                  fontWeight: FontWeight.bold,
                  fontSize: 18),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(c.name,
                    style: const TextStyle(
                        fontSize: 18, fontWeight: FontWeight.bold)),
                if (c.address != null && c.address!.isNotEmpty)
                  Text(c.address!,
                      style: const TextStyle(
                          color: AppColors.neutral, fontSize: 13)),
                if (c.visitDays.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Row(
                      children: [
                        const Icon(Icons.event_outlined,
                            size: 13, color: AppColors.brand),
                        const SizedBox(width: 4),
                        Text(visitDaysLabel(context, c.visitDays),
                            style: const TextStyle(
                                color: AppColors.brand, fontSize: 12)),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ],
      );

  Widget _deliveredSection(BuildContext context) {
    if (_ordersLoading) {
      return const Padding(
        padding: EdgeInsets.all(16),
        child: Center(
            child: SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(strokeWidth: 2))),
      );
    }
    if (_delivered.isEmpty) {
      return Text(context.tr('market.noDelivered'),
          style: const TextStyle(color: AppColors.neutral));
    }
    return Column(
      children: _delivered
          .map((o) => Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: ListTile(
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16)),
                  leading: const Icon(Icons.local_shipping_outlined,
                      color: AppColors.success),
                  title: Text('#${o.orderNo}',
                      style: const TextStyle(fontWeight: FontWeight.w600)),
                  subtitle: Text(money(o.total)),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => _push(ReceiptPage(orderId: o.id)),
                ),
              ))
          .toList(),
    );
  }
}

