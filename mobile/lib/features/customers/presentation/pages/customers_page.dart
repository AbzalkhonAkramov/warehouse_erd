import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/di/injection.dart';
import '../../../../l10n/l10n_ext.dart';
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
              return const Center(child: CircularProgressIndicator());
            case CustomersStatus.error:
              return _ErrorView(
                message: state.error ?? context.tr('common.error'),
                onRetry: () => context.read<CustomersCubit>().load(),
              );
            case CustomersStatus.loaded:
              if (state.customers.isEmpty) {
                return Center(child: Text(context.tr('customers.empty')));
              }
              return RefreshIndicator(
                onRefresh: () => context.read<CustomersCubit>().load(),
                child: ListView.separated(
                  itemCount: state.customers.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (context, i) {
                    final c = state.customers[i];
                    final overLimit = c.creditLimit > 0 && c.debt > c.creditLimit;
                    return ListTile(
                      leading: CircleAvatar(child: Text(c.name.characters.first)),
                      title: Text(c.name),
                      subtitle: Text(c.phone ?? c.address ?? '—'),
                      trailing: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            '${context.tr('customers.debt')} ${c.debt.toStringAsFixed(2)}',
                            style: TextStyle(
                              color: overLimit ? Colors.red : Colors.black87,
                              fontWeight: overLimit ? FontWeight.bold : FontWeight.normal,
                            ),
                          ),
                          Text(
                            '${context.tr('customers.limit')} ${c.creditLimit.toStringAsFixed(0)}',
                            style: const TextStyle(fontSize: 12, color: Colors.black54),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              );
          }
        },
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(message, style: const TextStyle(color: Colors.red)),
          const SizedBox(height: 12),
          OutlinedButton(onPressed: onRetry, child: Text(context.tr('common.retry'))),
        ],
      ),
    );
  }
}
