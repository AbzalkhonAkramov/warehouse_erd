import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';

import '../../../../core/di/injection.dart';
import '../../../../core/format.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/widgets/state_views.dart';
import '../../../../core/widgets/status_pill.dart';
import '../../../../l10n/l10n_ext.dart';
import '../../../auth/presentation/bloc/auth_bloc.dart';
import '../../domain/entities/order.dart';
import '../../domain/entities/pending_order.dart';
import '../cubit/orders_cubit.dart';
import '../cubit/outbox_cubit.dart';
import 'order_detail_page.dart';

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

const _kStatuses = ['all', 'new', 'shipped', 'delivered', 'refund', 'cancelled'];

class _OrdersView extends StatefulWidget {
  const _OrdersView();

  @override
  State<_OrdersView> createState() => _OrdersViewState();
}

class _OrdersViewState extends State<_OrdersView> {
  String _status = 'all';
  int? _customerId;
  DateTimeRange? _dateRange;

  bool get _hasFilter =>
      _status != 'all' || _customerId != null || _dateRange != null;

  bool _matchDate(DateTime d) {
    if (_dateRange == null) return true;
    final day = DateTime(d.year, d.month, d.day);
    final from = DateTime(_dateRange!.start.year, _dateRange!.start.month,
        _dateRange!.start.day);
    final to =
        DateTime(_dateRange!.end.year, _dateRange!.end.month, _dateRange!.end.day);
    return !day.isBefore(from) && !day.isAfter(to);
  }

  Future<void> _pickShop(BuildContext context, OrdersState state) async {
    // Markets that appear in the current orders.
    final ids = <int>{
      ...state.orders.map((o) => o.customerId),
      ...state.pending.map((p) => p.customerId),
    }.toList()
      ..sort((a, b) => (state.customerNames[a] ?? '')
          .compareTo(state.customerNames[b] ?? ''));
    final picked = await showModalBottomSheet<int?>(
      context: context,
      builder: (_) => SafeArea(
        child: ListView(
          shrinkWrap: true,
          children: [
            ListTile(
              title: Text(context.tr('orders.allShops'),
                  style: const TextStyle(fontWeight: FontWeight.w600)),
              onTap: () => Navigator.of(context).pop(-1),
            ),
            const Divider(height: 1),
            ...ids.map((id) => ListTile(
                  title: Text(state.customerNames[id] ?? '#$id'),
                  onTap: () => Navigator.of(context).pop(id),
                )),
          ],
        ),
      ),
    );
    if (picked != null) {
      setState(() => _customerId = picked == -1 ? null : picked);
    }
  }

  Future<void> _pickDate(BuildContext context) async {
    final now = DateTime.now();
    final range = await showDateRangePicker(
      context: context,
      firstDate: DateTime(now.year - 2),
      lastDate: DateTime(now.year + 1),
      initialDateRange: _dateRange,
    );
    if (range != null) setState(() => _dateRange = range);
  }

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

          final orders = state.orders
              .where((o) =>
                  (_status == 'all' || o.status == _status) &&
                  (_customerId == null || o.customerId == _customerId) &&
                  _matchDate(o.createdAt))
              .toList();
          final pending = (_status == 'all' || _status == 'new')
              ? state.pending
                  .where((p) =>
                      (_customerId == null || p.customerId == _customerId) &&
                      _matchDate(p.createdAt))
                  .toList()
              : <PendingOrder>[];

          final total = orders.length + pending.length;
          return Column(
            children: [
              _filterBar(context, state),
              Expanded(
                child: total == 0
                    ? RefreshableEmpty(
                        onRefresh: () => context.read<OrdersCubit>().load(),
                        message: context.tr('orders.empty'),
                        icon: Icons.receipt_long_outlined,
                      )
                    : RefreshIndicator(
                        onRefresh: () => context.read<OrdersCubit>().load(),
                        child: ListView.builder(
                          padding: const EdgeInsets.fromLTRB(12, 6, 12, 24),
                          itemCount: total,
                          itemBuilder: (context, i) {
                            if (i < pending.length) {
                              final p = pending[i];
                              return _PendingOrderCard(
                                  order: p,
                                  customer: state.customerNames[p.customerId]);
                            }
                            final o = orders[i - pending.length];
                            return _OrderCard(
                                order: o,
                                customer: state.customerNames[o.customerId]);
                          },
                        ),
                      ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _filterBar(BuildContext context, OrdersState state) {
    final df = DateFormat('d MMM');
    return Column(
      children: [
        SizedBox(
          height: 46,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
            children: _kStatuses.map((s) {
              final sel = _status == s;
              return Padding(
                padding: const EdgeInsets.only(right: 6),
                child: ChoiceChip(
                  label: Text(s == 'all'
                      ? context.tr('orders.filterAll')
                      : context.tr('status.$s')),
                  selected: sel,
                  showCheckmark: false,
                  backgroundColor: Colors.white,
                  selectedColor: AppColors.brand,
                  side: BorderSide(color: sel ? AppColors.brand : AppColors.line),
                  labelStyle: TextStyle(
                    color: sel ? Colors.white : const Color(0xFF0F172A),
                    fontWeight: FontWeight.w600,
                    fontSize: 13,
                  ),
                  onSelected: (_) => setState(() => _status = s),
                ),
              );
            }).toList(),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 0, 12, 6),
          child: Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _pickShop(context, state),
                  icon: const Icon(Icons.store_outlined, size: 18),
                  label: Text(
                    _customerId == null
                        ? context.tr('orders.filterShop')
                        : (state.customerNames[_customerId] ?? '#$_customerId'),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _pickDate(context),
                  icon: const Icon(Icons.event_outlined, size: 18),
                  label: Text(
                    _dateRange == null
                        ? context.tr('orders.filterDate')
                        : '${df.format(_dateRange!.start)}–${df.format(_dateRange!.end)}',
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ),
              if (_hasFilter)
                IconButton(
                  tooltip: context.tr('orders.filterReset'),
                  icon: const Icon(Icons.filter_alt_off_outlined),
                  color: AppColors.danger,
                  onPressed: () => setState(() {
                    _status = 'all';
                    _customerId = null;
                    _dateRange = null;
                  }),
                ),
            ],
          ),
        ),
      ],
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

  @override
  Widget build(BuildContext context) {
    final df = DateFormat('d MMM, HH:mm');
    final isDeliverer =
        context.select((AuthBloc b) => b.state.agent?.role) == 'deliverer';
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => Navigator.of(context).push(MaterialPageRoute(
            builder: (_) =>
                OrderDetailPage(order: order, customerName: customer))),
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
                      '${order.customerName ?? customer ?? '#${order.customerId}'} · ${df.format(order.createdAt)}',
                      style: const TextStyle(
                          color: AppColors.neutral, fontSize: 13),
                      overflow: TextOverflow.ellipsis,
                    ),
                    Text(
                      context.tr('orders.itemsCount', {'n': order.lines.length}),
                      style: const TextStyle(
                          color: AppColors.neutral, fontSize: 12),
                    ),
                    if (isDeliverer &&
                        (order.customerAddress?.isNotEmpty ?? false))
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Row(
                          children: [
                            const Icon(Icons.location_on_outlined,
                                size: 14, color: AppColors.neutral),
                            const SizedBox(width: 4),
                            Expanded(
                              child: Text(order.customerAddress!,
                                  style: const TextStyle(
                                      color: AppColors.neutral, fontSize: 12),
                                  overflow: TextOverflow.ellipsis),
                            ),
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
                  const SizedBox(height: 2),
                  const Icon(Icons.chevron_right, color: AppColors.neutral),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
