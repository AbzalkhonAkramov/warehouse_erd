import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';

import '../../../../core/di/injection.dart';
import '../../../../core/format.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/widgets/state_views.dart';
import '../../../../core/widgets/status_pill.dart';
import '../../../../l10n/l10n_ext.dart';
import '../../domain/entities/invoice.dart';
import '../cubit/invoices_cubit.dart';
import 'invoice_detail_page.dart';

class InvoicesPage extends StatelessWidget {
  const InvoicesPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => sl<InvoicesCubit>()..load(),
      child: const _InvoicesView(),
    );
  }
}

class _InvoicesView extends StatelessWidget {
  const _InvoicesView();

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<InvoicesCubit, InvoicesState>(
      builder: (context, state) {
        if (state.status == InvoicesStatus.loading ||
            state.status == InvoicesStatus.initial) {
          return const LoadingView();
        }
        if (state.status == InvoicesStatus.error) {
          return ErrorView(
            message: state.error ?? context.tr('common.error'),
            onRetry: () => context.read<InvoicesCubit>().load(),
          );
        }
        final cubit = context.read<InvoicesCubit>();
        final items = state.visible;
        return Column(
          children: [
            _OutstandingHeader(total: state.totalOutstanding),
            _FilterRow(filter: state.filter, onChanged: cubit.setFilter),
            Expanded(
              child: RefreshIndicator(
                onRefresh: () => cubit.load(),
                child: items.isEmpty
                    ? ListView(children: [
                        const SizedBox(height: 60),
                        EmptyView(
                          message: context.tr('invoices.empty'),
                          icon: Icons.request_page_outlined,
                        ),
                      ])
                    : ListView.builder(
                        padding: const EdgeInsets.fromLTRB(12, 4, 12, 24),
                        itemCount: items.length,
                        itemBuilder: (context, i) {
                          final inv = items[i];
                          return _InvoiceCard(
                            invoice: inv,
                            customer: state.customerNames[inv.customerId],
                            onChanged: () => cubit.load(),
                          );
                        },
                      ),
              ),
            ),
          ],
        );
      },
    );
  }
}

class _OutstandingHeader extends StatelessWidget {
  const _OutstandingHeader({required this.total});

  final double total;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.fromLTRB(12, 12, 12, 8),
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 18),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.brand, AppColors.brandDark],
        ),
        boxShadow: [
          BoxShadow(
            color: AppColors.brand.withValues(alpha: 0.25),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.account_balance_wallet_outlined,
                  color: Colors.white70, size: 18),
              const SizedBox(width: 6),
              Text(context.tr('invoices.outstanding'),
                  style: const TextStyle(color: Colors.white70, fontSize: 13)),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            money(total),
            style: const TextStyle(
                color: Colors.white, fontSize: 30, fontWeight: FontWeight.w800),
          ),
        ],
      ),
    );
  }
}

class _FilterRow extends StatelessWidget {
  const _FilterRow({required this.filter, required this.onChanged});

  final InvoiceFilter filter;
  final ValueChanged<InvoiceFilter> onChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      child: Row(
        children: [
          ChoiceChip(
            label: Text(context.tr('invoices.filter.unpaid')),
            selected: filter == InvoiceFilter.unpaid,
            onSelected: (_) => onChanged(InvoiceFilter.unpaid),
          ),
          const SizedBox(width: 8),
          ChoiceChip(
            label: Text(context.tr('invoices.filter.all')),
            selected: filter == InvoiceFilter.all,
            onSelected: (_) => onChanged(InvoiceFilter.all),
          ),
        ],
      ),
    );
  }
}

class _InvoiceCard extends StatelessWidget {
  const _InvoiceCard({
    required this.invoice,
    required this.onChanged,
    this.customer,
  });

  final Invoice invoice;
  final String? customer;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    final df = DateFormat('d MMM, HH:mm');
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () async {
          await Navigator.of(context).push(MaterialPageRoute(
            builder: (_) => InvoiceDetailPage(
              invoiceId: invoice.id,
              customerName: customer ?? '#${invoice.customerId}',
            ),
          ));
          onChanged();
        },
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
                        Text(invoice.number,
                            style: const TextStyle(
                                fontWeight: FontWeight.bold, fontSize: 15)),
                        const SizedBox(width: 8),
                        StatusPill(
                          label: context.tr('invoiceStatus.${invoice.status}'),
                          color: AppColors.invoiceStatus(invoice.status),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${customer ?? '#${invoice.customerId}'} · ${df.format(invoice.createdAt)}',
                      style: const TextStyle(
                          color: AppColors.neutral, fontSize: 13),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(money(invoice.balance),
                      style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 15,
                          color: invoice.balance > 0
                              ? AppColors.danger
                              : AppColors.success)),
                  const SizedBox(height: 2),
                  Text('${context.tr('invoices.total')} ${money(invoice.total)}',
                      style: const TextStyle(
                          fontSize: 11, color: AppColors.neutral)),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
