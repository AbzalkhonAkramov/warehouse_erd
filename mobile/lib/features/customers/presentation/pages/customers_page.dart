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
              return DefaultTabController(
                length: 2,
                child: Column(
                  children: [
                    Material(
                      color: Theme.of(context).scaffoldBackgroundColor,
                      child: TabBar(
                        tabs: [
                          Tab(text: context.tr('markets.tabVisits')),
                          Tab(text: context.tr('markets.tabAll')),
                        ],
                      ),
                    ),
                    Expanded(
                      child: TabBarView(
                        children: [
                          _VisitsTab(customers: state.customers),
                          _AllMarketsTab(customers: state.customers),
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

/// Markets grouped by the weekday(s) they should be visited — today first.
class _VisitsTab extends StatelessWidget {
  const _VisitsTab({required this.customers});

  final List<Customer> customers;

  @override
  Widget build(BuildContext context) {
    // Order weekdays starting from today, then the rest of the week.
    final todayIdx = DateTime.now().weekday - 1; // 0=Mon .. 6=Sun
    final ordered = [
      for (var i = 0; i < 7; i++) kWeekdays[(todayIdx + i) % 7],
    ];
    final unscheduled = customers.where((c) => c.visitDays.isEmpty).toList();

    final sections = <Widget>[];
    for (final day in ordered) {
      final markets =
          customers.where((c) => c.visitDays.contains(day)).toList();
      if (markets.isEmpty) continue;
      final isToday = day == kWeekdays[todayIdx];
      sections.add(_DayHeader(
        label: context.tr('day.$day'),
        isToday: isToday,
        count: markets.length,
      ));
      sections.addAll(markets.map((c) => _CustomerCard(customer: c)));
    }
    if (unscheduled.isNotEmpty) {
      sections.add(_DayHeader(
        label: context.tr('market.noVisitDays'),
        isToday: false,
        count: unscheduled.length,
      ));
      sections.addAll(unscheduled.map((c) => _CustomerCard(customer: c)));
    }

    if (sections.isEmpty) {
      return RefreshableEmpty(
        onRefresh: () => context.read<CustomersCubit>().load(),
        message: context.tr('customers.empty'),
        icon: Icons.event_outlined,
      );
    }
    return RefreshIndicator(
      onRefresh: () => context.read<CustomersCubit>().load(),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 96),
        children: sections,
      ),
    );
  }
}

class _DayHeader extends StatelessWidget {
  const _DayHeader({required this.label, required this.isToday, required this.count});

  final String label;
  final bool isToday;
  final int count;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 14, 4, 6),
      child: Row(
        children: [
          Text(
            label,
            style: TextStyle(
              fontWeight: FontWeight.bold,
              fontSize: 15,
              color: isToday ? AppColors.brand : const Color(0xFF0F172A),
            ),
          ),
          const SizedBox(width: 6),
          if (isToday)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: AppColors.brand.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(context.tr('markets.today'),
                  style: const TextStyle(
                      color: AppColors.brand,
                      fontSize: 11,
                      fontWeight: FontWeight.w700)),
            ),
          const Spacer(),
          Text('$count',
              style: const TextStyle(color: AppColors.neutral, fontSize: 13)),
        ],
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
                children: [
                  Text('${context.tr('customers.debt')} ${money(customer.debt)}',
                      style: TextStyle(
                          color: debtColor,
                          fontWeight: FontWeight.bold,
                          fontSize: 14)),
                  const SizedBox(height: 2),
                  Text(
                    '${context.tr('customers.limit')} ${money(customer.creditLimit)}',
                    style:
                        const TextStyle(fontSize: 11, color: AppColors.neutral),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
