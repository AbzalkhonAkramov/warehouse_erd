import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/config.dart';
import '../../../../core/di/injection.dart';
import '../../../../l10n/l10n_ext.dart';
import '../../../products/domain/entities/product.dart';
import '../cubit/create_order_cubit.dart';

class CreateOrderPage extends StatelessWidget {
  const CreateOrderPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => sl<CreateOrderCubit>()..init(),
      child: const _CreateOrderView(),
    );
  }
}

class _CreateOrderView extends StatelessWidget {
  const _CreateOrderView();

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<CreateOrderCubit, CreateOrderState>(
      listenWhen: (p, c) => p.status != c.status,
      listener: (context, state) {
        if (state.status == CreateOrderStatus.success) {
          final approved = state.createdStatus == 'approved';
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(approved
                  ? context.tr('order.autoApproved', {'id': state.createdOrderId})
                  : context.tr('order.sent', {'id': state.createdOrderId})),
              backgroundColor: approved ? Colors.green : Colors.blueGrey,
            ),
          );
          context.read<CreateOrderCubit>().init();
        } else if (state.status == CreateOrderStatus.error &&
            state.error != null) {
          ScaffoldMessenger.of(context)
              .showSnackBar(SnackBar(content: Text(state.error!)));
        }
      },
      builder: (context, state) {
        if (state.status == CreateOrderStatus.loading ||
            state.status == CreateOrderStatus.initial) {
          return const Center(child: CircularProgressIndicator());
        }
        final cubit = context.read<CreateOrderCubit>();
        return Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(12),
              child: DropdownButtonFormField<int>(
                initialValue: state.customerId,
                isExpanded: true,
                decoration: InputDecoration(
                  labelText: context.tr('order.customer'),
                  border: const OutlineInputBorder(),
                ),
                items: state.customers
                    .map((c) =>
                        DropdownMenuItem(value: c.id, child: Text(c.name)))
                    .toList(),
                onChanged: cubit.selectCustomer,
              ),
            ),
            const Divider(height: 1),
            Expanded(
              child: ListView.separated(
                itemCount: state.products.length,
                separatorBuilder: (_, __) => const Divider(height: 1),
                itemBuilder: (context, i) {
                  final p = state.products[i];
                  final qty = state.quantities[p.id] ?? 0;
                  return ListTile(
                    leading: _ProductThumb(product: p),
                    title: Text(p.name),
                    subtitle: Text(
                        '${p.salePrice.toStringAsFixed(2)} / ${p.unit}  ·  '
                        '${context.tr('product.stock')}: ${p.onHand.toStringAsFixed(0)}'),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(
                          icon: const Icon(Icons.remove_circle_outline),
                          onPressed: qty > 0
                              ? () => cubit.setQuantity(p.id, qty - 1)
                              : null,
                        ),
                        SizedBox(
                          width: 28,
                          child: Text('${qty.toInt()}',
                              textAlign: TextAlign.center),
                        ),
                        IconButton(
                          icon: const Icon(Icons.add_circle_outline),
                          onPressed: () => cubit.setQuantity(p.id, qty + 1),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
            _SubmitBar(
              total: state.total,
              canSubmit: state.canSubmit &&
                  state.status != CreateOrderStatus.submitting,
              submitting: state.status == CreateOrderStatus.submitting,
              onSubmit: () => cubit.submit(),
            ),
          ],
        );
      },
    );
  }
}

class _SubmitBar extends StatelessWidget {
  const _SubmitBar({
    required this.total,
    required this.canSubmit,
    required this.submitting,
    required this.onSubmit,
  });

  final double total;
  final bool canSubmit;
  final bool submitting;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            Expanded(
              child: Text(
                '${context.tr('order.total')}: ${total.toStringAsFixed(2)}',
                style: const TextStyle(
                    fontSize: 18, fontWeight: FontWeight.bold),
              ),
            ),
            FilledButton.icon(
              onPressed: canSubmit ? onSubmit : null,
              icon: submitting
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.send),
              label: Text(context.tr('order.submit')),
            ),
          ],
        ),
      ),
    );
  }
}

class _ProductThumb extends StatelessWidget {
  const _ProductThumb({required this.product});

  final Product product;

  @override
  Widget build(BuildContext context) {
    const size = 44.0;
    final placeholder = Container(
      width: size,
      height: size,
      color: Colors.grey.shade200,
      child: const Icon(Icons.inventory_2_outlined, color: Colors.grey),
    );
    if (product.imagePath == null) return placeholder;
    return ClipRRect(
      borderRadius: BorderRadius.circular(6),
      child: Image.network(
        AppConfig.uploadUrl(product.imagePath!),
        width: size,
        height: size,
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => placeholder,
      ),
    );
  }
}
