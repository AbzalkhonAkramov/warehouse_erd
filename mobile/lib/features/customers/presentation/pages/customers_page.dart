import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/di/injection.dart';
import '../../../../core/format.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/widgets/state_views.dart';
import '../../../../l10n/l10n_ext.dart';
import '../../domain/entities/customer.dart';
import '../cubit/customers_cubit.dart';
import 'create_shop_page.dart';

class CustomersPage extends StatelessWidget {
  const CustomersPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => sl<CustomersCubit>()..load(),
      child: const _CustomersView(),
    );
  }
}

class _CustomersView extends StatelessWidget {
  const _CustomersView();

  Future<void> _openCreate(BuildContext context) async {
    final created = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => const CreateShopPage()),
    );
    if (created == true && context.mounted) {
      context.read<CustomersCubit>().load();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openCreate(context),
        icon: const Icon(Icons.add),
        label: Text(context.tr('customers.newShop')),
      ),
      body: BlocBuilder<CustomersCubit, CustomersState>(
        builder: (context, state) {
          switch (state.status) {
            case CustomersStatus.loading:
            case CustomersStatus.initial:
              return const LoadingView();
            case CustomersStatus.error:
              return ErrorView(
                message: state.error ?? context.tr('common.error'),
                onRetry: () => context.read<CustomersCubit>().load(),
              );
            case CustomersStatus.loaded:
              if (state.customers.isEmpty) {
                return EmptyView(
                  message: context.tr('customers.empty'),
                  icon: Icons.storefront_outlined,
                );
              }
              return RefreshIndicator(
                onRefresh: () => context.read<CustomersCubit>().load(),
                child: ListView.builder(
                  padding: const EdgeInsets.fromLTRB(12, 12, 12, 96),
                  itemCount: state.customers.length,
                  itemBuilder: (context, i) =>
                      _CustomerCard(customer: state.customers[i]),
                ),
              );
          }
        },
      ),
    );
  }
}

class _CustomerCard extends StatelessWidget {
  const _CustomerCard({required this.customer});

  final Customer customer;

  @override
  Widget build(BuildContext context) {
    final overLimit =
        customer.creditLimit > 0 && customer.debt > customer.creditLimit;
    final debtColor = overLimit
        ? AppColors.danger
        : (customer.debt > 0 ? const Color(0xFF0F172A) : AppColors.success);
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            CircleAvatar(
              radius: 22,
              backgroundColor: AppColors.brand.withValues(alpha: 0.12),
              child: Text(
                customer.name.characters.isEmpty
                    ? '?'
                    : customer.name.characters.first.toUpperCase(),
                style: const TextStyle(
                    color: AppColors.brand, fontWeight: FontWeight.bold),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(customer.name,
                      style: const TextStyle(
                          fontWeight: FontWeight.w600, fontSize: 15)),
                  const SizedBox(height: 2),
                  Text(
                    customer.phone ?? customer.address ?? '—',
                    style:
                        const TextStyle(color: AppColors.neutral, fontSize: 13),
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text('${context.tr('customers.debt')} ${money(customer.debt)}',
                    style: TextStyle(
                        color: debtColor,
                        fontWeight: FontWeight.bold,
                        fontSize: 14)),
                const SizedBox(height: 2),
                Text(
                  '${context.tr('customers.limit')} ${money(customer.creditLimit)}',
                  style: const TextStyle(fontSize: 11, color: AppColors.neutral),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
