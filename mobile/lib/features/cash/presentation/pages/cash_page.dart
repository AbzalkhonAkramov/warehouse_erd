import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';

import '../../../../core/di/injection.dart';
import '../../../../core/format.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/widgets/state_views.dart';
import '../../../../core/widgets/status_pill.dart';
import '../../../../l10n/l10n_ext.dart';
import '../../domain/entities/cash_summary.dart';
import '../../domain/entities/remittance.dart';
import '../cubit/cash_cubit.dart';

class CashPage extends StatelessWidget {
  const CashPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => sl<CashCubit>()..load(),
      child: Scaffold(
        appBar: AppBar(title: Text(context.tr('cash.title'))),
        body: const _CashView(),
      ),
    );
  }
}

class _CashView extends StatelessWidget {
  const _CashView();

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<CashCubit, CashState>(
      listenWhen: (p, c) => p.error != c.error && c.error != null,
      listener: (context, state) => ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(state.error!))),
      builder: (context, state) {
        if (state.status == CashStatus.loading ||
            state.status == CashStatus.initial) {
          return const LoadingView();
        }
        if (state.status == CashStatus.error && state.summary == null) {
          return ErrorView(
            message: state.error ?? context.tr('common.error'),
            onRetry: () => context.read<CashCubit>().load(),
          );
        }
        final s = state.summary!;
        return RefreshIndicator(
          onRefresh: () => context.read<CashCubit>().load(),
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(12),
            children: [
              _BalanceCard(summary: s),
              if (s.agentSubmits) ...[
                const SizedBox(height: 12),
                _SubmitCard(summary: s),
              ],
              const SizedBox(height: 16),
              Text(context.tr('cash.history'),
                  style:
                      const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              const SizedBox(height: 8),
              if (state.history.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  child: Text(context.tr('cash.noHistory'),
                      style: const TextStyle(color: AppColors.neutral)),
                )
              else
                ...state.history.map((r) => _RemittanceTile(remittance: r)),
            ],
          ),
        );
      },
    );
  }
}

class _BalanceCard extends StatelessWidget {
  const _BalanceCard({required this.summary});

  final CashSummary summary;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 18),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.brand, AppColors.brandDark],
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(context.tr('cash.toHandOver'),
              style: const TextStyle(color: Colors.white70, fontSize: 13)),
          const SizedBox(height: 6),
          Text(money(summary.outstanding),
              style: const TextStyle(
                  color: Colors.white, fontSize: 30, fontWeight: FontWeight.w800)),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _mini(context.tr('cash.collected'), summary.collected),
              ),
              Expanded(
                child: _mini(context.tr('cash.handedOver'), summary.received),
              ),
              if (summary.pending > 0)
                Expanded(
                  child: _mini(context.tr('cash.pending'), summary.pending),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _mini(String label, double value) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(color: Colors.white60, fontSize: 11)),
          const SizedBox(height: 2),
          Text(money(value),
              style: const TextStyle(
                  color: Colors.white, fontSize: 14, fontWeight: FontWeight.w600)),
        ],
      );
}

class _SubmitCard extends StatefulWidget {
  const _SubmitCard({required this.summary});

  final CashSummary summary;

  @override
  State<_SubmitCard> createState() => _SubmitCardState();
}

class _SubmitCardState extends State<_SubmitCard> {
  final _amount = TextEditingController();
  final _note = TextEditingController();

  @override
  void dispose() {
    _amount.dispose();
    _note.dispose();
    super.dispose();
  }

  Future<void> _submit(BuildContext context) async {
    final amount = double.tryParse(_amount.text.replaceAll(',', '.')) ?? 0;
    if (amount <= 0) return;
    if (amount > widget.summary.available + 0.001) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(context.tr('cash.exceeds'))));
      return;
    }
    final ok = await context
        .read<CashCubit>()
        .submit(amount: amount, note: _note.text);
    if (ok && context.mounted) {
      _amount.clear();
      _note.clear();
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        backgroundColor: AppColors.success,
        content: Text(context.tr('cash.submitted')),
      ));
    }
  }

  @override
  Widget build(BuildContext context) {
    final submitting = context.select((CashCubit c) => c.state.submitting);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(context.tr('cash.submitTitle'),
                style: const TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            Text('${context.tr('cash.available')}: ${money(widget.summary.available)}',
                style: const TextStyle(color: AppColors.neutral, fontSize: 13)),
            const SizedBox(height: 12),
            TextField(
              controller: _amount,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              inputFormatters: [
                FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]')),
              ],
              decoration: InputDecoration(
                labelText: context.tr('cash.amount'),
                suffixIcon: TextButton(
                  onPressed: () => _amount.text =
                      widget.summary.available.toStringAsFixed(2),
                  child: Text(context.tr('cash.all')),
                ),
              ),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _note,
              decoration:
                  InputDecoration(labelText: context.tr('cash.note')),
              maxLines: 1,
            ),
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: submitting ? null : () => _submit(context),
                icon: submitting
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.send),
                label: Text(context.tr('cash.submit')),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RemittanceTile extends StatelessWidget {
  const _RemittanceTile({required this.remittance});

  final Remittance remittance;

  @override
  Widget build(BuildContext context) {
    final df = DateFormat('d MMM yyyy, HH:mm');
    final r = remittance;
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        leading: Icon(
          r.received ? Icons.check_circle : Icons.schedule,
          color: r.received ? AppColors.success : AppColors.warning,
        ),
        title: Text(money(r.amount),
            style: const TextStyle(fontWeight: FontWeight.bold)),
        subtitle: Text(
          '${df.format(r.receivedAt ?? r.createdAt)}'
          '${r.receivedByName != null ? ' · ${r.receivedByName}' : ''}',
          style: const TextStyle(fontSize: 12, color: AppColors.neutral),
        ),
        trailing: StatusPill(
          label: context.tr('cashStatus.${r.status}'),
          color: r.received ? AppColors.success : AppColors.warning,
        ),
      ),
    );
  }
}
