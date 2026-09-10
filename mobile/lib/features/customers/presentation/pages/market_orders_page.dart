import 'package:flutter/material.dart';

import '../../../../core/di/injection.dart';
import '../../../../core/format.dart';
import '../../../../core/network/api_exception.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/widgets/state_views.dart';
import '../../../../core/widgets/status_pill.dart';
import '../../../../l10n/l10n_ext.dart';
import '../../../orders/domain/entities/order.dart';
import '../../../orders/domain/repositories/order_repository.dart';
import '../../../orders/presentation/pages/receipt_page.dart';

Color orderStatusColor(String status) {
  switch (status) {
    case 'delivered':
      return AppColors.success;
    case 'shipped':
      return AppColors.brand;
    case 'refund':
      return AppColors.danger;
    case 'cancelled':
      return AppColors.neutral;
    default:
      return AppColors.warning;
  }
}

/// This market's orders (full history, or delivered-only). Tapping an order
/// opens its receipt.
class MarketOrdersPage extends StatefulWidget {
  const MarketOrdersPage({
    super.key,
    required this.customerId,
    required this.title,
    this.deliveredOnly = false,
  });

  final int customerId;
  final String title;
  final bool deliveredOnly;

  @override
  State<MarketOrdersPage> createState() => _MarketOrdersPageState();
}

class _MarketOrdersPageState extends State<MarketOrdersPage> {
  bool _loading = true;
  String? _error;
  List<Order> _orders = const [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final all = await sl<OrderRepository>().listOrders();
      if (!mounted) return;
      setState(() {
        _orders = all
            .where((o) => o.customerId == widget.customerId)
            .where((o) => !widget.deliveredOnly || o.status == 'delivered')
            .toList();
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.title)),
      body: _loading
          ? const LoadingView()
          : _error != null
              ? ErrorView(message: _error!, onRetry: _load)
              : _orders.isEmpty
                  ? RefreshableEmpty(
                      onRefresh: _load,
                      message: context.tr('market.noOrders'),
                      icon: Icons.receipt_long_outlined,
                    )
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView.builder(
                        padding: const EdgeInsets.all(12),
                        itemCount: _orders.length,
                        itemBuilder: (context, i) =>
                            _OrderTile(order: _orders[i]),
                      ),
                    ),
    );
  }
}

class _OrderTile extends StatelessWidget {
  const _OrderTile({required this.order});

  final Order order;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('#${order.orderNo}',
            style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 4),
          child: StatusPill(
            label: context.tr('status.${order.status}'),
            color: orderStatusColor(order.status),
          ),
        ),
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(money(order.total),
                style: const TextStyle(fontWeight: FontWeight.bold)),
            const Icon(Icons.chevron_right, color: AppColors.neutral),
          ],
        ),
        onTap: () => Navigator.of(context).push(MaterialPageRoute(
          builder: (_) => ReceiptPage(orderId: order.id),
        )),
      ),
    );
  }
}
