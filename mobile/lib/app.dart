import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'core/di/injection.dart';
import 'core/settings/settings_cubit.dart';
import 'core/theme/app_theme.dart';
import 'features/auth/presentation/bloc/auth_bloc.dart';
import 'features/auth/presentation/pages/login_page.dart';
import 'features/home/home_page.dart';
import 'features/orders/presentation/cubit/outbox_cubit.dart';
import 'l10n/locale_cubit.dart';
import 'l10n/messages.dart';

class AgentApp extends StatelessWidget {
  const AgentApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider.value(value: sl<AuthBloc>()..add(const AuthCheckRequested())),
        BlocProvider.value(value: sl<LocaleCubit>()..load()),
        BlocProvider.value(value: sl<SettingsCubit>()..load()),
        BlocProvider.value(value: sl<OutboxCubit>()..start()),
      ],
      // Rebuild the whole app when the language changes so every `context.tr`
      // (which reads the current locale) re-resolves.
      child: BlocBuilder<LocaleCubit, AppLang>(
        builder: (context, _) {
          return MaterialApp(
            title: 'Warehouse ERP — Agent',
            debugShowCheckedModeBanner: false,
            theme: AppTheme.light,
            home: BlocBuilder<AuthBloc, AuthState>(
              builder: (context, state) {
                switch (state.status) {
                  case AuthStatus.authenticated:
                    return const HomePage();
                  case AuthStatus.initial:
                  case AuthStatus.loading:
                    return const Scaffold(
                      body: Center(child: CircularProgressIndicator()),
                    );
                  case AuthStatus.unauthenticated:
                    return const LoginPage();
                }
              },
            ),
          );
        },
      ),
    );
  }
}
