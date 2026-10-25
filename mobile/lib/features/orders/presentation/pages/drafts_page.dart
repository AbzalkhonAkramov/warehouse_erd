import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/di/injection.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/widgets/state_views.dart';
import '../../../../l10n/l10n_ext.dart';
import '../../domain/entities/order_draft.dart';
import '../cubit/drafts_cubit.dart';
import 'create_order_page.dart';

/// List of saved (unsent) order drafts. Tapping one resumes it in the order
/// form; swiping or the delete icon removes it.
class DraftsPage extends StatelessWidget {
  const DraftsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => sl<DraftsCubit>()..load(),
      child: Scaffold(
        appBar: AppBar(title: Text(context.tr('drafts.title'))),
        body: const _DraftsView(),
      ),
    );
  }
}

class _DraftsView extends StatelessWidget {
  const _DraftsView();

  String _fmtDate(DateTime d) {
    final local = d.toLocal();
    String two(int n) => n.toString().padLeft(2, '0');
    return '${two(local.day)}.${two(local.month)}.${local.year} '
        '${two(local.hour)}:${two(local.minute)}';
  }

  Future<void> _open(BuildContext context, OrderDraft draft) async {
    await Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => CreateOrderPage(initialDraft: draft, standalone: true),
    ));
    if (context.mounted) context.read<DraftsCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<DraftsCubit, DraftsState>(
      builder: (context, state) {
        if (state.loading) return const LoadingView();
        final cubit = context.read<DraftsCubit>();
        if (state.drafts.isEmpty) {
          return RefreshableEmpty(
            onRefresh: cubit.load,
            message: context.tr('drafts.empty'),
            icon: Icons.drafts_outlined,
          );
        }
        return RefreshIndicator(
          onRefresh: cubit.load,
          child: ListView.builder(
            padding: const EdgeInsets.all(12),
            itemCount: state.drafts.length,
            itemBuilder: (context, i) {
              final d = state.drafts[i];
              final name = d.customerId == null
                  ? context.tr('drafts.noCustomer')
                  : (state.customerNames[d.customerId] ?? '#${d.customerId}');
              return Dismissible(
                key: ValueKey(d.localId),
                direction: DismissDirection.endToStart,
                background: Container(
                  alignment: Alignment.centerRight,
                  padding: const EdgeInsets.only(right: 20),
                  color: AppColors.danger,
                  child: const Icon(Icons.delete_outline, color: Colors.white),
                ),
                onDismissed: (_) => cubit.delete(d.localId),
                child: Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16)),
                    leading: const CircleAvatar(
                      backgroundColor: Color(0xFFEEF2FF),
                      child: Icon(Icons.edit_note_outlined, color: AppColors.brand),
                    ),
                    title: Text(name,
                        style: const TextStyle(fontWeight: FontWeight.w600)),
                    subtitle: Text(
                      '${context.tr('drafts.positions', {'n': d.lines.length})}'
                      ' · ${_fmtDate(d.createdAt)}',
                      style: const TextStyle(
                          color: AppColors.neutral, fontSize: 13),
                    ),
                    trailing: IconButton(
                      icon: const Icon(Icons.delete_outline),
                      color: AppColors.danger,
                      onPressed: () => cubit.delete(d.localId),
                    ),
                    onTap: () => _open(context, d),
                  ),
                ),
              );
            },
          ),
        );
      },
    );
  }
}
