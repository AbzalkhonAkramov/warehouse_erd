import 'package:flutter/material.dart';

import '../../../../core/di/injection.dart';
import '../../../../core/format.dart';
import '../../../../core/network/api_exception.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/widgets/state_views.dart';
import '../../../../core/widgets/status_pill.dart';
import '../../../../l10n/l10n_ext.dart';
import '../../../finance/domain/entities/invoice.dart';
import '../../../finance/domain/repositories/finance_repository.dart';
import '../../../finance/presentation/pages/invoice_detail_page.dart';

/// This market's invoices. Used for both "order debts" (outstanding) and
/// "payment acceptance" — tapping an invoice opens the detail page where a
/// cash/transfer/card payment is recorded.
class MarketInvoicesPage extends StatefulWidget {
  const MarketInvoicesPage({
    super.key,
    required this.customerId,
    required this.customerName,
    required this.title,
    this.unpaidOnly = false,
  });

  final int customerId;
  final String customerName;
  final String title;
  final bool unpaidOnly;

  @override
  State<MarketInvoicesPage> createState() => _MarketInvoicesPageState();
}

class _MarketInvoicesPageState extends State<MarketInvoicesPage> {
  bool _loading = true;
  String? _error;
  List<Invoice> _invoices = const [];

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
      final all = await sl<FinanceRepository>().listInvoices();
      if (!mounted) return;
      setState(() {
        _invoices = all
            .where((inv) => inv.customerId == widget.customerId)
            .where((inv) => !widget.unpaidOnly || inv.balance > 0)
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

  Color _statusColor(String status) {
    switch (status) {
      case 'paid':
        return AppColors.success;
      case 'partial':
        return AppColors.warning;
      default:
        return AppColors.danger;
    }
  }

  double get _totalDue =>
      _invoices.fold(0, (sum, inv) => sum + inv.balance);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.title)),
      body: _loading
          ? const LoadingView()
          : _error != null
              ? ErrorView(message: _error!, onRetry: _load)
              : _invoices.isEmpty
                  ? RefreshableEmpty(
                      onRefresh: _load,
                      message: context.tr('market.noInvoices'),
                      icon: Icons.receipt_outlined,
                    )
                  : Column(
                      children: [
                        if (_totalDue > 0)
                          Container(
                            width: double.infinity,
                            color: AppColors.danger.withValues(alpha: 0.08),
                            padding: const EdgeInsets.all(14),
                            child: Text(
                              '${context.tr('market.totalDue')}: ${money(_totalDue)}',
                              style: const TextStyle(
                                  color: AppColors.danger,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 15),
                            ),
                          ),
                        Expanded(
                          child: RefreshIndicator(
                            onRefresh: _load,
                            child: ListView.builder(
                              padding: const EdgeInsets.all(12),
                              itemCount: _invoices.length,
                              itemBuilder: (context, i) {
                                final inv = _invoices[i];
                                return Card(
                                  margin: const EdgeInsets.only(bottom: 8),
                                  child: ListTile(
                                    shape: RoundedRectangleBorder(
                                        borderRadius:
                                            BorderRadius.circular(16)),
                                    title: Text(inv.number,
                                        style: const TextStyle(
                                            fontWeight: FontWeight.w600)),
                                    subtitle: Padding(
                                      padding: const EdgeInsets.only(top: 4),
                                      child: StatusPill(
                                        label: context
                                            .tr('invoiceStatus.${inv.status}'),
                                        color: _statusColor(inv.status),
                                      ),
                                    ),
                                    trailing: Column(
                                      mainAxisAlignment:
                                          MainAxisAlignment.center,
                                      crossAxisAlignment:
                                          CrossAxisAlignment.end,
                                      children: [
                                        Text(money(inv.balance),
                                            style: TextStyle(
                                                fontWeight: FontWeight.bold,
                                                color: inv.balance > 0
                                                    ? AppColors.danger
                                                    : AppColors.success)),
                                        Text(
                                          '${context.tr('market.of')} ${money(inv.total)}',
                                          style: const TextStyle(
                                              fontSize: 11,
                                              color: AppColors.neutral),
                                        ),
                                      ],
                                    ),
                                    onTap: () async {
                                      await Navigator.of(context).push(
                                          MaterialPageRoute(
                                              builder: (_) => InvoiceDetailPage(
                                                    invoiceId: inv.id,
                                                    customerName:
                                                        widget.customerName,
                                                  )));
                                      if (mounted) _load();
                                    },
                                  ),
                                );
                              },
                            ),
                          ),
                        ),
                      ],
                    ),
    );
  }
}
