import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';

import '../../../../core/format.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/widgets/status_pill.dart';
import '../../../../l10n/l10n_ext.dart';
import '../../../auth/presentation/bloc/auth_bloc.dart';
import '../../../photo_report/presentation/pages/photo_report_page.dart';
import '../../domain/entities/order.dart';
import 'receipt_page.dart';

/// Full read-only detail of one order: market, date, deliverer, every product
/// line (with names) and the totals.
class OrderDetailPage extends StatelessWidget {
  const OrderDetailPage({super.key, required this.order, this.customerName});

  final Order order;
  final String? customerName;

  String _lineQty(BuildContext context, OrderItem l) {
    if (l.boxCount > 0) {
      final parts = <String>[
        '${l.boxCount} ${context.tr('order.box')} × ${l.boxSize}'
      ];
      if (l.loosePieces > 0) parts.add('${qty(l.loosePieces)} ${context.tr('product.unit')}');
      return parts.join(' + ');
    }
    return qty(l.quantity);
  }

  @override
  Widget build(BuildContext context) {
    final df = DateFormat('d MMM yyyy, HH:mm');
    final name = order.customerName ?? customerName ?? '#${order.customerId}';
    return Scaffold(
      appBar: AppBar(title: Text('#${order.orderNo}')),
      body: ListView(
        padding: const EdgeInsets.all(14),
        children: [
          // Status + date
          Row(
            children: [
              StatusPill(
                label: context.tr('status.${order.status}'),
                color: AppColors.orderStatus(order.status),
              ),
              const Spacer(),
              Text(df.format(order.createdAt),
                  style: const TextStyle(color: AppColors.neutral, fontSize: 13)),
            ],
          ),
          const SizedBox(height: 14),

          // Order info
          Card(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
              child: Column(
                children: [
                  _row(Icons.store_outlined, context.tr('order.customer'), name),
                  if (order.customerAddress?.isNotEmpty ?? false)
                    _row(Icons.location_on_outlined, context.tr('field.address'),
                        order.customerAddress!),
                  if (order.deliverer?.isNotEmpty ?? false)
                    _row(Icons.local_shipping_outlined,
                        context.tr('receipt.deliverer'), order.deliverer!),
                  if (order.invoiceNumber?.isNotEmpty ?? false)
                    _row(Icons.receipt_long_outlined,
                        context.tr('receipt.invoice'), order.invoiceNumber!,
                        last: true),
                ],
              ),
            ),
          ),
          const SizedBox(height: 14),

          // Products
          Text(context.tr('col.product'),
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
          const SizedBox(height: 6),
          Card(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
              child: Column(
                children: [
                  for (var i = 0; i < order.lines.length; i++)
                    Container(
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      decoration: BoxDecoration(
                        border: i == order.lines.length - 1
                            ? null
                            : const Border(
                                bottom: BorderSide(color: AppColors.line)),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(order.lines[i].productName,
                                    style: const TextStyle(
                                        fontWeight: FontWeight.w600)),
                                const SizedBox(height: 2),
                                Text(
                                  '${_lineQty(context, order.lines[i])}'
                                  '  ·  ${money(order.lines[i].unitPrice)}',
                                  style: const TextStyle(
                                      color: AppColors.neutral, fontSize: 12.5),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(money(order.lines[i].lineTotal),
                              style:
                                  const TextStyle(fontWeight: FontWeight.w600)),
                        ],
                      ),
                    ),
                  if (order.lines.isEmpty)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      child: Text(context.tr('orders.noItems'),
                          style: const TextStyle(color: AppColors.neutral)),
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 14),

          // Totals
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                children: [
                  _total(context.tr('receipt.subtotal'), money(order.subtotal)),
                  if (order.discount > 0)
                    _total(context.tr('receipt.discount'),
                        '− ${money(order.discount)}'),
                  const Divider(height: 18),
                  _total(context.tr('order.total'), money(order.total),
                      bold: true),
                ],
              ),
            ),
          ),

          if (order.shipped) ...[
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: () => Navigator.of(context).push(MaterialPageRoute(
                  builder: (_) => ReceiptPage(orderId: order.id))),
              icon: const Icon(Icons.receipt_outlined),
              label: Text(context.tr('orders.receipt')),
            ),
          ],

          // Deliverers attach before/after photos while the order is shipped.
          if (order.status == 'shipped' &&
              context.select((AuthBloc b) => b.state.agent?.role) ==
                  'deliverer') ...[
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: () => Navigator.of(context).push(MaterialPageRoute(
                builder: (_) => PhotoReportPage(
                  initialCustomerId: order.customerId,
                  initialSalesOrderId: order.id,
                  lockSelection: true,
                  standalone: true,
                ),
              )),
              icon: const Icon(Icons.add_a_photo_outlined),
              label: Text(context.tr('photo.attachToOrder')),
            ),
          ],
        ],
      ),
    );
  }

  Widget _row(IconData icon, String label, String value, {bool last = false}) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: BoxDecoration(
        border: last
            ? null
            : const Border(bottom: BorderSide(color: AppColors.line)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: AppColors.neutral),
          const SizedBox(width: 12),
          Text(label, style: const TextStyle(color: AppColors.neutral)),
          const SizedBox(width: 12),
          Expanded(
            child: Text(value,
                textAlign: TextAlign.right,
                style: const TextStyle(fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }

  Widget _total(String label, String value, {bool bold = false}) {
    final style = TextStyle(
        fontWeight: bold ? FontWeight.bold : FontWeight.w500,
        fontSize: bold ? 17 : 14);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        children: [
          Text(label, style: style),
          const Spacer(),
          Text(value, style: style),
        ],
      ),
    );
  }
}
