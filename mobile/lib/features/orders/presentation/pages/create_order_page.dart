import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/config.dart';
import '../../../../core/di/injection.dart';
import '../../../../core/format.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/widgets/state_views.dart';
import '../../../../l10n/l10n_ext.dart';
import '../../../customers/domain/entities/customer.dart';
import '../../../products/domain/entities/product.dart';
import '../cubit/create_order_cubit.dart';
import '../cubit/outbox_cubit.dart';

String _fmtQty(double q) =>
    q == q.roundToDouble() ? q.toStringAsFixed(0) : '$q';

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

  Future<void> _pickCustomer(BuildContext context, List<Customer> customers) async {
    final cubit = context.read<CreateOrderCubit>();
    final picked = await showModalBottomSheet<int>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _CustomerPicker(customers: customers),
    );
    if (picked != null) cubit.selectCustomer(picked);
  }

  Future<void> _addPosition(BuildContext context, CreateOrderState state) async {
    final cubit = context.read<CreateOrderCubit>();
    final product = await showModalBottomSheet<Product>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _ProductPicker(
        products: state.products,
        categories: state.categories,
      ),
    );
    if (product != null && context.mounted) {
      await _editQty(context, cubit, product, state.quantities[product.id] ?? 0);
    }
  }

  Future<void> _editQty(
      BuildContext context, CreateOrderCubit cubit, Product p, double current) async {
    final controller =
        TextEditingController(text: current > 0 ? _fmtQty(current) : '');
    final qty = await showDialog<double>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(p.name),
        content: TextField(
          controller: controller,
          autofocus: true,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          inputFormatters: [
            FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]')),
          ],
          decoration: InputDecoration(
            labelText: ctx.tr('order.quantity'),
            suffixText: p.unit,
          ),
          onSubmitted: (_) => Navigator.of(ctx).pop(
              double.tryParse(controller.text.replaceAll(',', '.')) ?? 0),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: Text(ctx.tr('common.cancel'))),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(
                double.tryParse(controller.text.replaceAll(',', '.')) ?? 0),
            child: Text(ctx.tr('order.add')),
          ),
        ],
      ),
    );
    if (qty != null) cubit.setQuantity(p.id, qty);
  }

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<CreateOrderCubit, CreateOrderState>(
      listenWhen: (p, c) => p.status != c.status,
      listener: (context, state) {
        if (state.status == CreateOrderStatus.success) {
          if (state.queued) {
            // Saved to the offline outbox — tell the agent and update the badge.
            ScaffoldMessenger.of(context).showSnackBar(SnackBar(
              backgroundColor: AppColors.warning,
              content: Text(context.tr('order.savedOffline')),
            ));
            context.read<OutboxCubit>().refresh();
          } else {
            ScaffoldMessenger.of(context).showSnackBar(SnackBar(
              content: Text(context.tr('order.sent', {'id': state.createdOrderId})),
              backgroundColor: Colors.blueGrey,
            ));
          }
          context.read<CreateOrderCubit>().init();
        } else if (state.status == CreateOrderStatus.error && state.error != null) {
          ScaffoldMessenger.of(context)
              .showSnackBar(SnackBar(content: Text(state.error!)));
        }
      },
      builder: (context, state) {
        if (state.status == CreateOrderStatus.loading ||
            state.status == CreateOrderStatus.initial) {
          return const LoadingView();
        }
        final cubit = context.read<CreateOrderCubit>();
        final selMatch = state.customers.where((c) => c.id == state.customerId);
        final selected = selMatch.isEmpty ? null : selMatch.first.name;

        // The order being built — one row per added product (position).
        final positions = state.quantities.entries.toList();
        final byId = {for (final p in state.products) p.id: p};

        return Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 6),
              child: Card(
                child: ListTile(
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16)),
                  leading: const CircleAvatar(
                    backgroundColor: Color(0xFFEEF2FF),
                    child: Icon(Icons.store_outlined, color: AppColors.brand),
                  ),
                  title: Text(selected ?? context.tr('order.selectCustomer'),
                      style: TextStyle(
                          fontWeight: FontWeight.w600,
                          color: selected == null ? AppColors.neutral : null)),
                  trailing: const Icon(Icons.unfold_more),
                  onTap: () => _pickCustomer(context, state.customers),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 4),
              child: SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: () => _addPosition(context, state),
                  icon: const Icon(Icons.add),
                  label: Text(context.tr('order.addPosition')),
                ),
              ),
            ),
            Expanded(
              child: positions.isEmpty
                  ? RefreshableEmpty(
                      onRefresh: () => cubit.reload(),
                      message: context.tr('order.noPositions'),
                      icon: Icons.add_shopping_cart_outlined,
                    )
                  : RefreshIndicator(
                      onRefresh: () => cubit.reload(),
                      child: ListView.builder(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.fromLTRB(12, 6, 12, 12),
                      itemCount: positions.length,
                      itemBuilder: (context, i) {
                        final entry = positions[i];
                        final p = byId[entry.key];
                        if (p == null) return const SizedBox.shrink();
                        final q = entry.value;
                        return Card(
                          margin: const EdgeInsets.only(bottom: 8),
                          child: ListTile(
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(16)),
                            leading: _ProductThumb(product: p),
                            title: Text(p.name,
                                style: const TextStyle(
                                    fontWeight: FontWeight.w600)),
                            subtitle: Text(
                                '${_fmtQty(q)} × ${money(p.salePrice)} ${p.unit}',
                                style: const TextStyle(
                                    color: AppColors.neutral, fontSize: 13)),
                            trailing: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  money(q * p.salePrice),
                                  style: const TextStyle(
                                      fontWeight: FontWeight.bold),
                                ),
                                IconButton(
                                  icon: const Icon(Icons.delete_outline),
                                  color: AppColors.danger,
                                  onPressed: () => cubit.setQuantity(p.id, 0),
                                ),
                              ],
                            ),
                            onTap: () => _editQty(context, cubit, p, q),
                          ),
                        );
                      },
                    ),
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

class _CustomerPicker extends StatefulWidget {
  const _CustomerPicker({required this.customers});

  final List<Customer> customers;

  @override
  State<_CustomerPicker> createState() => _CustomerPickerState();
}

class _CustomerPickerState extends State<_CustomerPicker> {
  String _q = '';

  @override
  Widget build(BuildContext context) {
    final q = _q.trim().toLowerCase();
    final list = widget.customers
        .where((c) =>
            q.isEmpty ||
            c.name.toLowerCase().contains(q) ||
            (c.phone ?? '').contains(q))
        .toList();
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.7,
        builder: (context, controller) => Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(12),
              child: TextField(
                autofocus: true,
                decoration: InputDecoration(
                  prefixIcon: const Icon(Icons.search),
                  hintText: context.tr('order.searchCustomer'),
                ),
                onChanged: (v) => setState(() => _q = v),
              ),
            ),
            Expanded(
              child: ListView.builder(
                controller: controller,
                itemCount: list.length,
                itemBuilder: (context, i) {
                  final c = list[i];
                  return ListTile(
                    title: Text(c.name),
                    subtitle: c.phone != null ? Text(c.phone!) : null,
                    onTap: () => Navigator.of(context).pop(c.id),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ProductPicker extends StatefulWidget {
  const _ProductPicker({required this.products, required this.categories});

  final List<Product> products;
  final List categories; // List<Category>

  @override
  State<_ProductPicker> createState() => _ProductPickerState();
}

class _ProductPickerState extends State<_ProductPicker> {
  String _q = '';
  int? _cat;

  @override
  Widget build(BuildContext context) {
    final q = _q.trim().toLowerCase();
    final list = widget.products.where((p) {
      final matchName = q.isEmpty ||
          p.name.toLowerCase().contains(q) ||
          p.sku.toLowerCase().contains(q);
      final matchCat = _cat == null || p.categoryId == _cat;
      return matchName && matchCat;
    }).toList();

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.85,
        builder: (context, controller) => Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(12),
              child: TextField(
                autofocus: true,
                decoration: InputDecoration(
                  prefixIcon: const Icon(Icons.search),
                  hintText: context.tr('order.searchProduct'),
                ),
                onChanged: (v) => setState(() => _q = v),
              ),
            ),
            if (widget.categories.isNotEmpty)
              SizedBox(
                height: 42,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(right: 6),
                      child: ChoiceChip(
                        label: Text(context.tr('order.allCategories')),
                        selected: _cat == null,
                        onSelected: (_) => setState(() => _cat = null),
                      ),
                    ),
                    ...widget.categories.map((c) => Padding(
                          padding: const EdgeInsets.only(right: 6),
                          child: ChoiceChip(
                            label: Text(c.name as String),
                            selected: _cat == c.id,
                            onSelected: (_) => setState(() => _cat = c.id as int),
                          ),
                        )),
                  ],
                ),
              ),
            const Divider(height: 1),
            Expanded(
              child: ListView.separated(
                controller: controller,
                itemCount: list.length,
                separatorBuilder: (_, __) => const Divider(height: 1),
                itemBuilder: (context, i) {
                  final p = list[i];
                  return ListTile(
                    leading: _ProductThumb(product: p),
                    title: Text(p.name),
                    subtitle: Text(
                        '${p.salePrice.toStringAsFixed(2)} / ${p.unit}  ·  '
                        '${context.tr('product.stock')}: ${p.onHand.toStringAsFixed(0)}'),
                    onTap: () => Navigator.of(context).pop(p),
                  );
                },
              ),
            ),
          ],
        ),
      ),
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
    return Material(
      color: Colors.white,
      elevation: 8,
      shadowColor: Colors.black26,
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(context.tr('order.total'),
                        style: const TextStyle(
                            color: AppColors.neutral, fontSize: 12)),
                    Text(
                      money(total),
                      style: const TextStyle(
                          fontSize: 20, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ),
              FilledButton.icon(
                onPressed: canSubmit ? onSubmit : null,
                icon: submitting
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white),
                      )
                    : const Icon(Icons.send),
                label: Text(context.tr('order.submit')),
              ),
            ],
          ),
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
