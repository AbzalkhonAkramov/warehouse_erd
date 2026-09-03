import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../core/theme/app_colors.dart';
import '../../l10n/l10n_ext.dart';
import '../../l10n/language_switcher.dart';
import '../auth/presentation/bloc/auth_bloc.dart';
import '../customers/presentation/pages/customers_page.dart';
import '../orders/presentation/cubit/outbox_cubit.dart';
import '../orders/presentation/pages/create_order_page.dart';
import '../orders/presentation/pages/orders_page.dart';
import '../products/presentation/pages/catalog_page.dart';
import '../settings/presentation/pages/settings_page.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  int _index = 0;

  static const _pages = [
    CustomersPage(),
    CreateOrderPage(),
    CatalogPage(),
  ];

  @override
  Widget build(BuildContext context) {
    final agent = context.select((AuthBloc b) => b.state.agent);
    final titles = [
      context.tr('home.customers'),
      context.tr('home.order'),
      context.tr('home.catalog'),
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
                    fontSize: 14,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
      drawer: _AppDrawer(agentName: agent?.fullName),
      body: Column(
        children: [
          const _OfflineBanner(),
          Expanded(child: IndexedStack(index: _index, children: _pages)),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: [
          NavigationDestination(
              icon: const Icon(Icons.store_outlined), label: context.tr('tab.customers')),
          NavigationDestination(
              icon: const Icon(Icons.add_shopping_cart_outlined), label: context.tr('tab.order')),
          NavigationDestination(
              icon: const Icon(Icons.inventory_2_outlined), label: context.tr('tab.catalog')),
        ],
      ),
    );
  }
}

/// Hamburger drawer: quick access to the agent's cash handover page + settings.
class _AppDrawer extends StatelessWidget {
  const _AppDrawer({this.agentName});

  final String? agentName;

  @override
  Widget build(BuildContext context) {
    return Drawer(
      child: SafeArea(
        child: Column(
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(18, 22, 18, 20),
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [AppColors.brand, AppColors.brandDark],
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.warehouse_rounded, color: Colors.white, size: 30),
                  const SizedBox(height: 10),
                  Text(agentName ?? 'Agent',
                      style: const TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.bold)),
                ],
              ),
            ),
            ListTile(
              leading: const Icon(Icons.receipt_long_outlined),
              title: Text(context.tr('orders.drawerTitle')),
              onTap: () {
                Navigator.of(context).pop();
                Navigator.of(context).push(MaterialPageRoute(
                  builder: (_) => Scaffold(
                    appBar: AppBar(title: Text(context.tr('orders.drawerTitle'))),
                    body: const OrdersPage(),
                  ),
                ));
              },
            ),
            ListTile(
              leading: const Icon(Icons.settings_outlined),
              title: Text(context.tr('settings.title')),
              onTap: () {
                Navigator.of(context).pop();
                Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const SettingsPage()));
              },
            ),
            const Spacer(),
            const Divider(height: 1),
            ListTile(
              leading: const Icon(Icons.logout),
              title: Text(context.tr('common.signOut')),
              onTap: () =>
                  context.read<AuthBloc>().add(const AuthLogoutRequested()),
            ),
          ],
        ),
      ),
    );
  }
}

/// A thin bar under the app bar that appears when the device is offline or has
/// orders waiting to be sent; also toasts when the queue drains.
class _OfflineBanner extends StatelessWidget {
  const _OfflineBanner();

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<OutboxCubit, OutboxState>(
      listenWhen: (p, c) => p.syncedTick != c.syncedTick && c.justSynced > 0,
      listener: (context, state) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: AppColors.success,
            content: Text(context.tr('orders.syncedN', {'n': state.justSynced})),
          ),
        );
      },
      builder: (context, state) {
        final offline = !state.online;
        final hasPending = state.pending > 0;
        if (!offline && !hasPending) return const SizedBox.shrink();

        final Color bg = offline ? AppColors.warning : AppColors.brand;
        final IconData icon =
            offline ? Icons.cloud_off_rounded : Icons.cloud_sync_outlined;
        String text;
        if (offline && hasPending) {
          text = context.tr('offline.bannerPending', {'n': state.pending});
        } else if (offline) {
          text = context.tr('offline.banner');
        } else {
          // online with a queue → syncing
          text = context.tr('offline.syncing', {'n': state.pending});
        }
        return Material(
          color: bg,
          child: SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              child: Row(
                children: [
                  Icon(icon, color: Colors.white, size: 18),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(text,
                        style: const TextStyle(
                            color: Colors.white,
                            fontSize: 13,
                            fontWeight: FontWeight.w600)),
                  ),
                  if (state.syncing)
                    const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white),
                    ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
