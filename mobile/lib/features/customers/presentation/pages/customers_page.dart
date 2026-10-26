import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/di/injection.dart';
import '../../../../core/format.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/widgets/state_views.dart';
import '../../../../l10n/l10n_ext.dart';
import '../../domain/entities/customer.dart';
import '../cubit/customers_cubit.dart';
import '../widgets/visit_day_picker.dart';
import 'create_shop_page.dart';
import 'market_profile_page.dart';

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
              final todayIdx = DateTime.now().weekday - 1; // 0=Mon .. 6=Sun
              return DefaultTabController(
                // All + 7 weekdays; land on today's tab by default.
                length: 1 + kWeekdays.length,
                initialIndex: todayIdx + 1,
                child: Column(
                  children: [
                    Material(
                      color: Theme.of(context).scaffoldBackgroundColor,
                      child: TabBar(
                        isScrollable: true,
                        tabAlignment: TabAlignment.start,
                        tabs: [
                          Tab(text: context.tr('markets.tabAll')),
                          for (final day in kWeekdays)
                            Tab(text: context.tr('day.$day')),
                        ],
                      ),
                    ),
                    Expanded(
                      child: TabBarView(
                        children: [
                          _AllMarketsTab(customers: state.customers),
                          for (final day in kWeekdays)
                            _DayTab(day: day, customers: state.customers),
                        ],
                      ),
                    ),
                  ],
                ),
              );
          }
        },
      ),
    );
  }
}

/// Markets scheduled for one weekday.
class _DayTab extends StatelessWidget {
  const _DayTab({required this.day, required this.customers});

  final String day;
  final List<Customer> customers;

  @override
  Widget build(BuildContext context) {
    final markets =
        customers.where((c) => c.visitDays.contains(day)).toList();
    if (markets.isEmpty) {
      return RefreshableEmpty(
        onRefresh: () => context.read<CustomersCubit>().load(),
        message: context.tr('customers.empty'),
        icon: Icons.event_outlined,
      );
    }
    return RefreshIndicator(
      onRefresh: () => context.read<CustomersCubit>().load(),
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(12, 12, 12, 96),
        itemCount: markets.length,
        itemBuilder: (context, i) => _CustomerCard(customer: markets[i]),
      ),
    );
  }
}

/// Flat list of every market.
class _AllMarketsTab extends StatelessWidget {
  const _AllMarketsTab({required this.customers});

  final List<Customer> customers;

  @override
  Widget build(BuildContext context) {
    if (customers.isEmpty) {
      return RefreshableEmpty(
        onRefresh: () => context.read<CustomersCubit>().load(),
        message: context.tr('customers.empty'),
        icon: Icons.storefront_outlined,
      );
    }
    return RefreshIndicator(
      onRefresh: () => context.read<CustomersCubit>().load(),
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(12, 12, 12, 96),
        itemCount: customers.length,
        itemBuilder: (context, i) => _CustomerCard(customer: customers[i]),
      ),
    );
  }
}

class _CustomerCard extends StatelessWidget {
  const _CustomerCard({required this.customer});

  final Customer customer;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => Navigator.of(context).push(MaterialPageRoute(
          builder: (_) => MarketProfilePage(customer: customer),
        )),
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
                      style: const TextStyle(
                          color: AppColors.neutral, fontSize: 13),
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (customer.visitDays.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 3),
                        child: Row(
                          children: [
                            const Icon(Icons.event_outlined,
                                size: 13, color: AppColors.brand),
                            const SizedBox(width: 4),
                            Expanded(
                              child: Text(
                                visitDaysLabel(context, customer.visitDays),
                                style: const TextStyle(
                                    color: AppColors.brand, fontSize: 12),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    context.tr('customers.debt'),
                    style: const TextStyle(
                        color: AppColors.neutral, fontSize: 11),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    money(customer.debt),
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 14,
                      color: customer.debt > 0
                          ? AppColors.danger
                          : AppColors.neutral,
                    ),
                  ),
                ],
              ),
              const SizedBox(width: 4),
              const Icon(Icons.chevron_right, color: AppColors.neutral),
            ],
          ),
        ),
      ),
    );
  }
}
