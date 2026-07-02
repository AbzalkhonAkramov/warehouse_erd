import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../l10n/l10n_ext.dart';
import '../../l10n/language_switcher.dart';
import '../auth/presentation/bloc/auth_bloc.dart';
import '../cash/presentation/pages/cash_page.dart';
import '../finance/presentation/pages/invoices_page.dart';
import '../orders/presentation/pages/orders_page.dart';
import '../settings/presentation/pages/settings_page.dart';

/// Home for the DELIVERER role: their assigned deliveries, money collection
/// (invoices/payments), and cash handover to the manager.
class DelivererHomePage extends StatefulWidget {
  const DelivererHomePage({super.key});

  @override
  State<DelivererHomePage> createState() => _DelivererHomePageState();
}

class _DelivererHomePageState extends State<DelivererHomePage> {
  int _index = 0;

  // Deliveries reuses the orders list (backend returns only this deliverer's
  // orders); Invoices = payment collection; Cash = handover to the manager.
  static const _pages = [OrdersPage(), InvoicesPage(), CashPage()];

  @override
  Widget build(BuildContext context) {
    final agent = context.select((AuthBloc b) => b.state.agent);
    final titles = [
      context.tr('deliverer.deliveries'),
      context.tr('home.finance'),
      context.tr('cash.title'),
    ];
    return Scaffold(
      appBar: AppBar(
        title: Text(titles[_index]),
        actions: [
          const LanguageSwitcher(),
          IconButton(
            icon: const Icon(Icons.settings_outlined),
            tooltip: context.tr('settings.title'),
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const SettingsPage()),
            ),
          ),
          PopupMenuButton<String>(
            offset: const Offset(0, 48),
            onSelected: (_) =>
                context.read<AuthBloc>().add(const AuthLogoutRequested()),
            itemBuilder: (_) => [
              PopupMenuItem(
                enabled: false,
                child: Text(agent?.fullName ?? '',
                    style: const TextStyle(fontWeight: FontWeight.w600)),
              ),
              const PopupMenuDivider(),
              PopupMenuItem(
                value: 'logout',
                child: Row(
                  children: [
                    const Icon(Icons.logout, size: 18),
                    const SizedBox(width: 10),
                    Text(context.tr('common.signOut')),
                  ],
                ),
              ),
            ],
            child: Padding(
              padding: const EdgeInsets.only(right: 12, left: 4),
              child: CircleAvatar(
                radius: 16,
                backgroundColor: Colors.indigo.withValues(alpha: 0.12),
                child: Text(
                  (agent?.fullName.trim().isNotEmpty ?? false)
                      ? agent!.fullName.trim().characters.first.toUpperCase()
                      : '?',
                  style: const TextStyle(
                      color: Colors.indigo,
                      fontWeight: FontWeight.bold,
                      fontSize: 14),
                ),
              ),
            ),
          ),
        ],
      ),
      body: IndexedStack(index: _index, children: _pages),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: [
          NavigationDestination(
              icon: const Icon(Icons.local_shipping_outlined),
              label: context.tr('deliverer.deliveries')),
          NavigationDestination(
              icon: const Icon(Icons.account_balance_wallet_outlined),
              label: context.tr('tab.finance')),
          NavigationDestination(
              icon: const Icon(Icons.payments_outlined),
              label: context.tr('cash.drawer')),
        ],
      ),
    );
  }
}
