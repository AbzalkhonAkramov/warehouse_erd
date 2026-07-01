import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';

import '../../../../core/di/injection.dart';
import '../../../../core/format.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/widgets/state_views.dart';
import '../../../../core/widgets/status_pill.dart';
import '../../../../l10n/l10n_ext.dart';
import '../../../photo_report/presentation/pages/photo_report_page.dart';
import '../../domain/entities/order.dart';
import '../../domain/entities/pending_order.dart';
import '../cubit/orders_cubit.dart';
import '../cubit/outbox_cubit.dart';
import 'receipt_page.dart';

class OrdersPage extends StatelessWidget {
  const OrdersPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => sl<OrdersCubit>()..load(),
      child: const _OrdersView(),
    );
  }
}

class _OrdersView extends StatelessWidget {
  const _OrdersView();

  @override
  Widget build(BuildContext context) {
    // Reload the list whenever the outbox drains, so freshly-sent orders appear.
    return BlocListener<OutboxCubit, OutboxState>(
      listenWhen: (p, c) => p.syncedTick != c.syncedTick,
      listener: (context, _) => context.read<OrdersCubit>().load(),
      child: BlocBuilder<OrdersCubit, OrdersState>(
        builder: (context, state) {
          if (state.status == OrdersStatus.loading ||
              state.status == OrdersStatus.initial) {
            return const LoadingView();
          }
          if (state.status == OrdersStatus.error) {
            return ErrorView(
              message: state.error ?? context.tr('common.error'),
              onRetry: () => context.read<OrdersCubit>().load(),
            );
          }
          if (state.orders.isEmpty && state.pending.isEmpty) {
            return EmptyView(
              message: context.tr('orders.empty'),
              icon: Icons.receipt_long_outlined,
            );
          }
          final pending = state.pending;
          return RefreshIndicator(
            onRefresh: () => context.read<OrdersCubit>().load(),
            child: ListView.builder(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 24),
              // pending orders first, then the server orders
              itemCount: pending.length + state.orders.length,
              itemBuilder: (context, i) {
                if (i < pending.length) {
                  final p = pending[i];
                  return _PendingOrderCard(
                      order: p, customer: state.customerNames[p.customerId]);
                }
                final o = state.orders[i - pending.length];
                return _OrderCard(
                    order: o, customer: state.customerNames[o.customerId]);
              },
            ),
          );
        },
      ),
    );
  }
}

/// An order captured offline, still waiting in the outbox — clearly marked so
/// the agent knows it hasn't reached the server yet.
class _PendingOrderCard extends StatelessWidget {
  const _PendingOrderCard({required this.order, this.customer});

  final PendingOrder order;
  final String? customer;

  @override
  Widget build(BuildContext context) {
    final df = DateFormat('d MMM, HH:mm');
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            const Icon(Icons.schedule, color: AppColors.warning),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  StatusPill(
                    label: context.tr('orders.pendingSync'),
                    color: AppColors.warning,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${customer ?? '#${order.customerId}'} · ${df.format(order.createdAt)}',
                    style: const TextStyle(
                        color: AppColors.neutral, fontSize: 13),
                    overflow: TextOverflow.ellipsis,
                  ),
                  Text(
                    context.tr('orders.itemsCount',
                        {'n': order.lines.length}),
                    style: const TextStyle(
                        color: AppColors.neutral, fontSize: 12),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _OrderCard extends StatelessWidget {
  const _OrderCard({required this.order, this.customer});

  final Order order;
  final String? customer;

  // Before/after photos can only be sent while the order is shipped.
  bool get _canAttachPhoto => order.status == 'shipped';

  void _attachPhoto(BuildContext context) {
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => PhotoReportPage(
        initialCustomerId: order.customerId,
        initialSalesOrderId: order.id,
        lockSelection: true,
        standalone: true,
      ),
    ));
  }

  @override
  Widget build(BuildContext context) {
    final df = DateFormat('d MMM, HH:mm');
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: order.shipped
            ? () => Navigator.of(context).push(MaterialPageRoute(
                builder: (_) => ReceiptPage(orderId: order.id)))
            : null,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text('#${order.orderNo}',
                            style: const TextStyle(
                                fontWeight: FontWeight.bold, fontSize: 15)),
                        const SizedBox(width: 8),
                        StatusPill(
                          label: context.tr('status.${order.status}'),
                          color: AppColors.orderStatus(order.status),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${customer ?? '#${order.customerId}'} · ${df.format(order.createdAt)}',
                      style: const TextStyle(
                          color: AppColors.neutral, fontSize: 13),
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (order.shipped)
                      Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: Row(
                          children: [
                            const Icon(Icons.receipt_outlined,
                                size: 15, color: AppColors.brand),
                            const SizedBox(width: 4),
                            Text(context.tr('orders.receipt'),
                                style: const TextStyle(
                                    color: AppColors.brand,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600)),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(money(order.total),
                      style: const TextStyle(
                          fontWeight: FontWeight.bold, fontSize: 15)),
                  if (_canAttachPhoto)
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: IconButton(
                        visualDensity: VisualDensity.compact,
                        icon: const Icon(Icons.add_a_photo_outlined),
                        color: AppColors.brand,
                        tooltip: context.tr('photo.attachToOrder'),
                        onPressed: () => _attachPhoto(context),
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
