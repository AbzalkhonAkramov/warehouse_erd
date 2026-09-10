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
import '../../../returns/presentation/pages/return_products_page.dart';
import '../../domain/entities/customer.dart';
import '../widgets/visit_day_picker.dart';
import 'market_invoices_page.dart';
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

  void _soon() => ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(context.tr('common.comingSoon'))),
      );

  @override
  Widget build(BuildContext context) {
    final services = <_Service>[
      _Service(Icons.payments_outlined, 'service.payment',
          () => _push(MarketInvoicesPage(
                customerId: c.id,
                customerName: c.name,
                title: context.tr('service.payment'),
                unpaidOnly: true,
              ))),
      _Service(Icons.account_balance_wallet_outlined, 'service.debts',
          () => _push(MarketInvoicesPage(
                customerId: c.id,
                customerName: c.name,
                title: context.tr('service.debts'),
                unpaidOnly: true,
              ))),
      _Service(Icons.receipt_long_outlined, 'service.receipt',
          () => _push(MarketOrdersPage(
                customerId: c.id,
                title: context.tr('service.receipt'),
              ))),
      _Service(Icons.recommend_outlined, 'service.recommended', _soon, soon: true),
      _Service(Icons.inventory_2_outlined, 'service.crates', _soon, soon: true),
      _Service(Icons.storefront_outlined, 'service.storeStock', _soon, soon: true),
      _Service(Icons.kitchen_outlined, 'service.equipment', _soon, soon: true),
      _Service(Icons.history, 'service.orderHistory',
          () => _push(MarketOrdersPage(
                customerId: c.id,
                title: context.tr('service.orderHistory'),
              ))),
      _Service(Icons.checklist_outlined, 'service.tasks', _soon, soon: true),
      _Service(Icons.event_busy_outlined, 'service.visitRefusal', _soon, soon: true),
      _Service(Icons.swap_horiz, 'service.exchange', _soon, soon: true),
      _Service(Icons.assignment_return_outlined, 'service.returnOrder',
          () => _push(ReturnProductsPage(customerId: c.id, customerName: c.name))),
      _Service(Icons.camera_alt_outlined, 'service.photo',
          () => _push(PhotoReportPage(
                initialCustomerId: c.id,
                lockSelection: true,
                standalone: true,
              ))),
      _Service(Icons.remove_shopping_cart_outlined, 'service.shelfReturns', _soon, soon: true),
      _Service(Icons.add_shopping_cart_outlined, 'service.addOrder',
          () => _push(CreateOrderPage(initialCustomerId: c.id, standalone: true))),
    ];

    final overLimit = c.creditLimit > 0 && c.debt > c.creditLimit;

    return Scaffold(
      appBar: AppBar(
        title: Text(context.tr('market.profile')),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: InkWell(
              borderRadius: BorderRadius.circular(20),
              onTap: () => _push(MarketInvoicesPage(
                customerId: c.id,
                customerName: c.name,
                title: context.tr('market.balance'),
                unpaidOnly: true,
              )),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                child: Row(
                  children: [
                    Icon(Icons.account_balance_wallet,
                        size: 18,
                        color: overLimit ? AppColors.danger : Colors.white),
                    const SizedBox(width: 6),
                    Text(
                      money(c.debt),
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        color: overLimit ? AppColors.danger : Colors.white,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _header(context),
          const SizedBox(height: 16),
          _debtCard(context, overLimit),
          const SizedBox(height: 20),
          Text(context.tr('market.deliveredOrders'),
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
          const SizedBox(height: 8),
          _deliveredSection(context),
        ],
      ),
      // Primary actions pinned to the bottom, alongside the "More" services sheet.
      bottomNavigationBar: SafeArea(
        child: Container(
          decoration: const BoxDecoration(
            border: Border(top: BorderSide(color: AppColors.line)),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
          child: Row(
            children: [
              _bottomAction(context, Icons.apps, 'market.more',
                  () => _openServices(context, services)),
              _bottomAction(context, Icons.camera_alt_outlined, 'service.photo',
                  () => _push(PhotoReportPage(
                        initialCustomerId: c.id,
                        lockSelection: true,
                        standalone: true,
                      ))),
              _bottomAction(context, Icons.add_shopping_cart_outlined,
                  'service.addOrder',
                  () => _push(CreateOrderPage(
                      initialCustomerId: c.id, standalone: true))),
              _bottomAction(context, Icons.remove_shopping_cart_outlined,
                  'service.shelfReturns', _soon),
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

  Widget _debtCard(BuildContext context, bool overLimit) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            Icon(Icons.account_balance_wallet_outlined,
                color: overLimit ? AppColors.danger : AppColors.neutral),
            const SizedBox(width: 12),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(context.tr('market.debt'),
                    style: const TextStyle(
                        color: AppColors.neutral, fontSize: 12)),
                Text(
                  money(c.debt),
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: overLimit ? AppColors.danger : AppColors.brand,
                  ),
                ),
              ],
            ),
            const Spacer(),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(context.tr('market.limit'),
                    style: const TextStyle(
                        color: AppColors.neutral, fontSize: 12)),
                Text(money(c.creditLimit),
                    style: const TextStyle(fontWeight: FontWeight.w600)),
              ],
            ),
          ],
        ),
      ),
    );
  }

  void _openServices(BuildContext context, List<_Service> services) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.only(bottom: 12, left: 4),
                child: Text(context.tr('market.services'),
                    style: const TextStyle(
                        fontSize: 16, fontWeight: FontWeight.bold)),
              ),
              Flexible(
                child: GridView.count(
                  crossAxisCount: 3,
                  shrinkWrap: true,
                  crossAxisSpacing: 10,
                  mainAxisSpacing: 10,
                  childAspectRatio: 0.92,
                  children: services
                      .map((s) => _ServiceTile(
                            service: s,
                            onTapOverride: () {
                              Navigator.of(sheetContext).pop();
                              s.onTap();
                            },
                          ))
                      .toList(),
                ),
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

class _Service {
  const _Service(this.icon, this.labelKey, this.onTap, {this.soon = false});
  final IconData icon;
  final String labelKey;
  final VoidCallback onTap;
  final bool soon;
}

class _ServiceTile extends StatelessWidget {
  const _ServiceTile({required this.service, this.onTapOverride});

  final _Service service;
  final VoidCallback? onTapOverride;

  @override
  Widget build(BuildContext context) {
    final soon = service.soon;
    final iconColor = soon ? AppColors.neutral : AppColors.brand;
    return Card(
      margin: EdgeInsets.zero,
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTapOverride ?? service.onTap,
        child: Opacity(
          opacity: soon ? 0.55 : 1,
          child: Padding(
            padding: const EdgeInsets.all(8),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: iconColor.withValues(alpha: 0.10),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(service.icon, color: iconColor, size: 24),
                ),
                const SizedBox(height: 8),
                Text(
                  context.tr(service.labelKey),
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 11.5, height: 1.15),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
