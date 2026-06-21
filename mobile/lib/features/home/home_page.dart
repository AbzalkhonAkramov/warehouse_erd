import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../l10n/l10n_ext.dart';
import '../../l10n/language_switcher.dart';
import '../auth/presentation/bloc/auth_bloc.dart';
import '../customers/presentation/pages/customers_page.dart';
import '../orders/presentation/pages/create_order_page.dart';
import '../photo_report/presentation/pages/photo_report_page.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  int _index = 0;

  static const _pages = [CustomersPage(), CreateOrderPage(), PhotoReportPage()];

  @override
  Widget build(BuildContext context) {
    final agent = context.select((AuthBloc b) => b.state.agent);
    final titles = [
      context.tr('home.customers'),
      context.tr('home.order'),
      context.tr('home.photos'),
    ];
    return Scaffold(
      appBar: AppBar(
        title: Text(titles[_index]),
        actions: [
          const LanguageSwitcher(),
          PopupMenuButton<String>(
            onSelected: (_) =>
                context.read<AuthBloc>().add(const AuthLogoutRequested()),
            itemBuilder: (_) => [
              PopupMenuItem(enabled: false, child: Text(agent?.fullName ?? '')),
              PopupMenuItem(value: 'logout', child: Text(context.tr('common.signOut'))),
            ],
          ),
        ],
      ),
      body: IndexedStack(index: _index, children: _pages),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: [
          NavigationDestination(
              icon: const Icon(Icons.store_outlined), label: context.tr('tab.customers')),
          NavigationDestination(
              icon: const Icon(Icons.add_shopping_cart_outlined), label: context.tr('tab.order')),
          NavigationDestination(
              icon: const Icon(Icons.camera_alt_outlined), label: context.tr('tab.photos')),
        ],
      ),
    );
  }
}
