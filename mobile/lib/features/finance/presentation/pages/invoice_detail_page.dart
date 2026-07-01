import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';

import '../../../../core/di/injection.dart';
import '../../../../core/format.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/widgets/status_pill.dart';
import '../../../../l10n/l10n_ext.dart';
import '../../domain/entities/invoice.dart';
import '../../domain/repositories/finance_repository.dart';
import '../cubit/invoice_detail_cubit.dart';

class InvoiceDetailPage extends StatelessWidget {
  const InvoiceDetailPage({
    super.key,
    required this.invoiceId,
    required this.customerName,
  });

  final int invoiceId;
  final String customerName;

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) =>
          InvoiceDetailCubit(sl<FinanceRepository>(), invoiceId, customerName)
            ..load(),
      child: const _InvoiceDetailView(),
    );
  }
}

class _InvoiceDetailView extends StatelessWidget {
  const _InvoiceDetailView();

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<InvoiceDetailCubit, InvoiceDetailState>(
      listenWhen: (p, c) =>
          p.paidJustNow != c.paidJustNow || p.error != c.error,
      listener: (context, state) {
        if (state.paidJustNow) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              backgroundColor: Colors.green,
              content: Text(context.tr('payment.recorded')),
            ),
          );
        } else if (state.error != null) {
          ScaffoldMessenger.of(context)
              .showSnackBar(SnackBar(content: Text(state.error!)));
        }
      },
      builder: (context, state) {
        final cubit = context.read<InvoiceDetailCubit>();
        final inv = state.invoice;
        return Scaffold(
          appBar: AppBar(
            title: Text(inv?.number ?? context.tr('invoices.title')),
          ),
          floatingActionButton: (inv != null && inv.balance > 0)
              ? FloatingActionButton.extended(
                  onPressed: () => _openPaymentSheet(context, cubit, inv),
                  icon: const Icon(Icons.payments_outlined),
                  label: Text(context.tr('payment.record')),
                )
              : null,
          body: state.status == DetailStatus.loading ||
                  state.status == DetailStatus.initial
              ? const Center(child: CircularProgressIndicator())
              : inv == null
                  ? Center(child: Text(state.error ?? context.tr('common.error')))
                  : RefreshIndicator(
                      onRefresh: () => cubit.load(),
                      child: ListView(
                        padding: const EdgeInsets.all(16),
                        children: [
                          _SummaryCard(invoice: inv, customerName: cubit.customerName),
                          const SizedBox(height: 16),
                          Text(context.tr('payment.history'),
                              style: const TextStyle(
                                  fontWeight: FontWeight.bold, fontSize: 16)),
                          const SizedBox(height: 8),
                          if (inv.payments.isEmpty)
                            Padding(
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              child: Text(context.tr('payment.none'),
                                  style: const TextStyle(color: Colors.black54)),
                            )
                          else
                            ...inv.payments.map((p) => _PaymentTile(payment: p)),
                          const SizedBox(height: 80),
                        ],
                      ),
                    ),
        );
      },
    );
  }

  Future<void> _openPaymentSheet(
      BuildContext context, InvoiceDetailCubit cubit, Invoice inv) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (_) => BlocProvider.value(
        value: cubit,
        child: _PaymentSheet(invoice: inv),
      ),
    );
  }
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({required this.invoice, required this.customerName});

  final Invoice invoice;
  final String customerName;

  @override
  Widget build(BuildContext context) {
    final df = DateFormat('d MMM yyyy, HH:mm');
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(customerName,
                      style: const TextStyle(
                          fontSize: 18, fontWeight: FontWeight.bold)),
                ),
                StatusPill(
                  label: context.tr('invoiceStatus.${invoice.status}'),
                  color: AppColors.invoiceStatus(invoice.status),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text('${context.tr('invoices.order')} #${invoice.salesOrderId}  ·  ${df.format(invoice.createdAt)}',
                style: const TextStyle(color: AppColors.neutral, fontSize: 13)),
            const Divider(height: 24),
            _row(context, context.tr('invoices.total'), invoice.total),
            _row(context, context.tr('invoices.paid'), invoice.paidAmount),
            _row(context, context.tr('invoices.balance'), invoice.balance,
                highlight: true),
          ],
        ),
      ),
    );
  }

  Widget _row(BuildContext context, String label, double value,
      {bool highlight = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: TextStyle(
                  fontWeight: highlight ? FontWeight.bold : FontWeight.normal)),
          Text(money(value),
              style: TextStyle(
                fontWeight: highlight ? FontWeight.bold : FontWeight.normal,
                color: highlight && value > 0 ? AppColors.danger : null,
                fontSize: highlight ? 18 : 14,
              )),
        ],
      ),
    );
  }
}

class _PaymentTile extends StatelessWidget {
  const _PaymentTile({required this.payment});

  final Payment payment;

  @override
  Widget build(BuildContext context) {
    final df = DateFormat('d MMM yyyy, HH:mm');
    return ListTile(
      dense: true,
      contentPadding: EdgeInsets.zero,
      leading: const Icon(Icons.check_circle, color: AppColors.success),
      title: Text(money(payment.amount),
          style: const TextStyle(fontWeight: FontWeight.bold)),
      subtitle: Text(
        '${context.tr('payment.method.${payment.method}')}'
        '${payment.collectedByName != null ? ' · ${payment.collectedByName}' : ''}'
        '${payment.note != null && payment.note!.isNotEmpty ? '\n${payment.note}' : ''}',
      ),
      trailing: Text(df.format(payment.collectedAt),
          style: const TextStyle(fontSize: 11, color: Colors.black54)),
    );
  }
}

class _PaymentSheet extends StatefulWidget {
  const _PaymentSheet({required this.invoice});

  final Invoice invoice;

  @override
  State<_PaymentSheet> createState() => _PaymentSheetState();
}

class _PaymentSheetState extends State<_PaymentSheet> {
  final _amount = TextEditingController();
  final _note = TextEditingController();
  String _method = 'cash';

  @override
  void dispose() {
    _amount.dispose();
    _note.dispose();
    super.dispose();
  }

  Future<void> _submit(BuildContext context) async {
    final amount = double.tryParse(_amount.text.replaceAll(',', '.')) ?? 0;
    if (amount <= 0) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(context.tr('payment.invalidAmount'))));
      return;
    }
    if (amount > widget.invoice.balance + 0.001) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(context.tr('payment.exceeds'))));
      return;
    }
    final ok = await context.read<InvoiceDetailCubit>().recordPayment(
          amount: amount,
          method: _method,
          note: _note.text,
        );
    if (ok && context.mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final submitting =
        context.select((InvoiceDetailCubit c) => c.state.submitting);
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 16, 16, 16 + bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(context.tr('payment.record'),
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          Text('${context.tr('invoices.balance')} ${money(widget.invoice.balance)}',
              style: const TextStyle(color: AppColors.neutral)),
          const SizedBox(height: 14),
          TextField(
            controller: _amount,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: [
              FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]')),
            ],
            decoration: InputDecoration(
              labelText: context.tr('payment.amount'),
              border: const OutlineInputBorder(),
              suffixIcon: TextButton(
                onPressed: () =>
                    _amount.text = widget.invoice.balance.toStringAsFixed(2),
                child: Text(context.tr('payment.full')),
              ),
            ),
          ),
          const SizedBox(height: 12),
          SegmentedButton<String>(
            segments: [
              ButtonSegment(value: 'cash', label: Text(context.tr('payment.method.cash'))),
              ButtonSegment(value: 'transfer', label: Text(context.tr('payment.method.transfer'))),
              ButtonSegment(value: 'card', label: Text(context.tr('payment.method.card'))),
            ],
            selected: {_method},
            onSelectionChanged: (s) => setState(() => _method = s.first),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _note,
            decoration: InputDecoration(
              labelText: context.tr('payment.note'),
              border: const OutlineInputBorder(),
            ),
            maxLines: 2,
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: submitting ? null : () => _submit(context),
              icon: submitting
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.check),
              label: Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Text(submitting
                    ? context.tr('common.saving')
                    : context.tr('payment.confirm')),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
