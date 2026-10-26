import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../l10n/l10n_ext.dart';
import '../../l10n/language_switcher.dart';
import '../auth/presentation/bloc/auth_bloc.dart';
import '../orders/presentation/pages/orders_page.dart';
import '../settings/presentation/pages/settings_page.dart';

/// Home for the DELIVERER role: their assigned deliveries. The backend returns
/// only this deliverer's orders. (Finance/cash were removed from the project.)
class DelivererHomePage extends StatelessWidget {
  const DelivererHomePage({super.key});

  @override
  Widget build(BuildContext context) {
    final agent = context.select((AuthBloc b) => b.state.agent);
    return Scaffold(
      appBar: AppBar(
        title: Text(context.tr('deliverer.deliveries')),
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
      body: const OrdersPage(),
    );
  }
}
