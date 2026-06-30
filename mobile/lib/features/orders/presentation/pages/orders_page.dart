import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';

import '../../../../core/di/injection.dart';
import '../../../../l10n/l10n_ext.dart';
import '../../../photo_report/presentation/pages/photo_report_page.dart';
import '../../domain/entities/order.dart';
import '../cubit/orders_cubit.dart';
import 'receipt_page.dart';

Color statusColor(String s) {
  switch (s) {
    case 'shipped':
      return Colors.blue;
    case 'delivered':
      return Colors.green;
    case 'refund':
      return Colors.purple;
    case 'cancelled':
      return Colors.grey;
    default:
      return Colors.orange; // new
  }
}

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
    return BlocBuilder<OrdersCubit, OrdersState>(
      builder: (context, state) {
        if (state.status == OrdersStatus.loading ||
            state.status == OrdersStatus.initial) {
          return const Center(child: CircularProgressIndicator());
        }
        if (state.status == OrdersStatus.error) {
          return Center(child: Text(state.error ?? context.tr('common.error')));
        }
        if (state.orders.isEmpty) {
          return Center(child: Text(context.tr('orders.empty')));
        }
        return RefreshIndicator(
          onRefresh: () => context.read<OrdersCubit>().load(),
          child: ListView.separated(
            itemCount: state.orders.length,
            separatorBuilder: (_, __) => const Divider(height: 1),
            itemBuilder: (context, i) {
              final o = state.orders[i];
              return _OrderTile(order: o, customer: state.customerNames[o.customerId]);
            },
          ),
        );
      },
    );
  }
}

class _OrderTile extends StatelessWidget {
  const _OrderTile({required this.order, this.customer});

  final Order order;
  final String? customer;

  // Before/after photos can only be sent while the order is shipped (not after it
  // is delivered, and not before it ships).
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
    return ListTile(
      leading: _canAttachPhoto
          ? IconButton(
              icon: const Icon(Icons.add_a_photo_outlined),
              tooltip: context.tr('photo.attachToOrder'),
              onPressed: () => _attachPhoto(context),
            )
          : null,
      title: Row(
        children: [
          Text('#${order.orderNo}',
              style: const TextStyle(fontWeight: FontWeight.bold)),
          const SizedBox(width: 8),
          _StatusChip(status: order.status),
        ],
      ),
      subtitle: Text(
          '${customer ?? '#${order.customerId}'}  ·  ${df.format(order.createdAt)}'),
      trailing: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Text(order.total.toStringAsFixed(2),
              style: const TextStyle(fontWeight: FontWeight.bold)),
          if (order.shipped)
            Text('🧾 ${context.tr('orders.receipt')}',
                style: const TextStyle(fontSize: 11, color: Colors.blue)),
        ],
      ),
      onTap: order.shipped
          ? () => Navigator.of(context).push(MaterialPageRoute(
              builder: (_) => ReceiptPage(orderId: order.id)))
          : null,
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final c = statusColor(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: c.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text(
        context.tr('status.$status'),
        style: TextStyle(color: c, fontSize: 12, fontWeight: FontWeight.w600),
      ),
    );
  }
}
