import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../l10n/l10n_ext.dart';
import '../../../../l10n/language_switcher.dart';
import '../bloc/auth_bloc.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _email = TextEditingController(text: 'agent@erp.local');
  final _password = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  void _submit() {
    if (_formKey.currentState?.validate() ?? false) {
      context.read<AuthBloc>().add(
            AuthLoginRequested(_email.text.trim(), _password.text),
          );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            const Align(
              alignment: Alignment.centerRight,
              child: Padding(
                padding: EdgeInsets.only(right: 8, top: 4),
                child: LanguageSwitcher(),
              ),
            ),
            Expanded(
              child: Center(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(24),
                  child: BlocConsumer<AuthBloc, AuthState>(
                    listener: (context, state) {
                      if (state.status == AuthStatus.unauthenticated &&
                          state.error != null) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text(state.error!)),
                        );
                      }
                    },
                    builder: (context, state) {
                      final loading = state.status == AuthStatus.loading;
                      return Form(
                        key: _formKey,
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Center(
                              child: Container(
                                width: 78,
                                height: 78,
                                decoration: BoxDecoration(
                                  gradient: const LinearGradient(
                                    begin: Alignment.topLeft,
                                    end: Alignment.bottomRight,
                                    colors: [AppColors.brand, AppColors.brandDark],
                                  ),
                                  borderRadius: BorderRadius.circular(22),
                                  boxShadow: [
                                    BoxShadow(
                                      color: AppColors.brand.withValues(alpha: 0.35),
                                      blurRadius: 18,
                                      offset: const Offset(0, 8),
                                    ),
                                  ],
                                ),
                                child: const Icon(Icons.warehouse_rounded,
                                    size: 40, color: Colors.white),
                              ),
                            ),
                            const SizedBox(height: 18),
                            Text(
                              'Warehouse ERP',
                              textAlign: TextAlign.center,
                              style: Theme.of(context)
                                  .textTheme
                                  .headlineSmall
                                  ?.copyWith(fontWeight: FontWeight.bold),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              context.tr('login.subtitle'),
                              textAlign: TextAlign.center,
                              style: const TextStyle(color: AppColors.neutral),
                            ),
                            const SizedBox(height: 28),
                            Card(
                              child: Padding(
                                padding: const EdgeInsets.all(18),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.stretch,
                                  children: [
                                    TextFormField(
                                      controller: _email,
                                      keyboardType: TextInputType.emailAddress,
                                      decoration: InputDecoration(
                                        labelText: context.tr('login.email'),
                                        prefixIcon: const Icon(Icons.mail_outline),
                                      ),
                                      validator: (v) =>
                                          (v == null || v.isEmpty) ? '—' : null,
                                    ),
                                    const SizedBox(height: 14),
                                    TextFormField(
                                      controller: _password,
                                      obscureText: true,
                                      decoration: InputDecoration(
                                        labelText: context.tr('login.password'),
                                        prefixIcon: const Icon(Icons.lock_outline),
                                      ),
                                      validator: (v) =>
                                          (v == null || v.isEmpty) ? '—' : null,
                                      onFieldSubmitted: (_) => _submit(),
                                    ),
                                    const SizedBox(height: 20),
                                    FilledButton(
                                      onPressed: loading ? null : _submit,
                                      child: loading
                                          ? const SizedBox(
                                              height: 20,
                                              width: 20,
                                              child: CircularProgressIndicator(
                                                  strokeWidth: 2,
                                                  color: Colors.white),
                                            )
                                          : Text(context.tr('login.signIn')),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
