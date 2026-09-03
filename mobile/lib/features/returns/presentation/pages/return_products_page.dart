import 'package:flutter/material.dart';

import '../../../../core/di/injection.dart';
import '../../../../core/format.dart';
import '../../../../core/network/api_exception.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/widgets/state_views.dart';
import '../../../../l10n/l10n_ext.dart';
import '../../../orders/domain/entities/order.dart';
import '../../../orders/domain/repositories/order_repository.dart';
import '../../domain/repositories/returns_repository.dart';

/// Agent picks one of the market's shipped/delivered orders and the goods that
/// came back; submits a return request for a manager to approve.
class ReturnProductsPage extends StatefulWidget {
  const ReturnProductsPage({
    super.key,
    required this.customerId,
    required this.customerName,
  });

  final int customerId;
  final String customerName;

  @override
  State<ReturnProductsPage> createState() => _ReturnProductsPageState();
}

class _ReturnProductsPageState extends State<ReturnProductsPage> {
  bool _loading = true;
  String? _error;
  List<Order> _orders = const [];
  Order? _selected;

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
        // Only this market's already-shipped/delivered orders can be returned.
        _orders = all
            .where((o) => o.customerId == widget.customerId && o.shipped)
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
      appBar: AppBar(title: Text(context.tr('return.title'))),
      body: _loading
          ? const LoadingView()
          : _error != null
              ? ErrorView(message: _error!, onRetry: _load)
              : _selected != null
                  ? _ReturnForm(
                      order: _selected!,
                      onBack: () => setState(() => _selected = null),
                    )
                  : _orders.isEmpty
                      ? EmptyView(
                          message: context.tr('return.noOrders'),
                          icon: Icons.assignment_return_outlined,
                        )
                      : ListView(
                          padding: const EdgeInsets.all(12),
                          children: [
                            Padding(
                              padding: const EdgeInsets.fromLTRB(4, 4, 4, 8),
                              child: Text(context.tr('return.pickOrder'),
                                  style: const TextStyle(
                                      color: AppColors.neutral)),
                            ),
                            for (final o in _orders)
                              Card(
                                margin: const EdgeInsets.only(bottom: 8),
                                child: ListTile(
                                  shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(16)),
                                  title: Text('#${o.orderNo}',
                                      style: const TextStyle(
                                          fontWeight: FontWeight.w600)),
                                  subtitle: Text(
                                      '${o.lines.length} ${context.tr('return.items')} · ${money(o.total)}'),
                                  trailing: const Icon(Icons.chevron_right),
                                  onTap: () => setState(() => _selected = o),
                                ),
                              ),
                          ],
                        ),
    );
  }
}

class _ReturnForm extends StatefulWidget {
  const _ReturnForm({required this.order, required this.onBack});

  final Order order;
  final VoidCallback onBack;

  @override
  State<_ReturnForm> createState() => _ReturnFormState();
}

class _ReturnFormState extends State<_ReturnForm> {
  final Map<int, double> _qty = {}; // productId -> return qty
  bool _submitting = false;

  double _max(OrderItem l) => l.quantity;

  Future<void> _submit(BuildContext context) async {
    final lines = _qty.entries
        .where((e) => e.value > 0)
        .map((e) => (productId: e.key, quantity: e.value))
        .toList();
    if (lines.isEmpty) return;
    final messenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);
    final okText = context.tr('return.submitted');
    setState(() => _submitting = true);
    try {
      await sl<ReturnsRepository>()
          .submitReturn(salesOrderId: widget.order.id, lines: lines);
      messenger.showSnackBar(SnackBar(
        backgroundColor: AppColors.success,
        content: Text(okText),
      ));
      navigator.pop();
    } on ApiException catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final o = widget.order;
    final any = _qty.values.any((v) => v > 0);
    return Column(
      children: [
        ListTile(
          leading: IconButton(
              icon: const Icon(Icons.arrow_back), onPressed: widget.onBack),
          title: Text('#${o.orderNo}',
              style: const TextStyle(fontWeight: FontWeight.bold)),
          subtitle: Text(context.tr('return.pickGoods')),
        ),
        const Divider(height: 1),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(12),
            children: [
              for (final l in o.lines)
                Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(l.productName,
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w600)),
                              Text(
                                '${context.tr('return.sold')}: ${_fmt(l.quantity)}',
                                style: const TextStyle(
                                    color: AppColors.neutral, fontSize: 12),
                              ),
                            ],
                          ),
                        ),
                        _Stepper(
                          value: _qty[l.productId] ?? 0,
                          max: _max(l),
                          onChanged: (v) =>
                              setState(() => _qty[l.productId] = v),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
        SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: (!any || _submitting) ? null : () => _submit(context),
                icon: _submitting
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.assignment_return_outlined),
                label: Text(context.tr('return.submit')),
              ),
            ),
          ),
        ),
      ],
    );
  }

  static String _fmt(double q) =>
      q == q.roundToDouble() ? q.toStringAsFixed(0) : '$q';
}

class _Stepper extends StatelessWidget {
  const _Stepper({required this.value, required this.max, required this.onChanged});

  final double value;
  final double max;
  final ValueChanged<double> onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        IconButton(
          icon: const Icon(Icons.remove_circle_outline),
          onPressed: value <= 0 ? null : () => onChanged(value - 1),
        ),
        SizedBox(
          width: 28,
          child: Text(
            value == value.roundToDouble() ? value.toStringAsFixed(0) : '$value',
            textAlign: TextAlign.center,
            style: const TextStyle(fontWeight: FontWeight.bold),
          ),
        ),
        IconButton(
          icon: const Icon(Icons.add_circle_outline),
          onPressed: value >= max ? null : () => onChanged(value + 1),
        ),
      ],
    );
  }
}
