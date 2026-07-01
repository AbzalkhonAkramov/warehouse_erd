import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/settings/settings_cubit.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../l10n/l10n_ext.dart';
import '../../../../l10n/locale_cubit.dart';
import '../../../../l10n/messages.dart';

class SettingsPage extends StatelessWidget {
  const SettingsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(context.tr('settings.title'))),
      body: ListView(
        padding: const EdgeInsets.all(12),
        children: [
          _SectionTitle(context.tr('settings.catalog')),
          Card(
            child: BlocBuilder<SettingsCubit, SettingsState>(
              builder: (context, state) => SwitchListTile(
                value: state.showCatalogStock,
                onChanged: (v) =>
                    context.read<SettingsCubit>().setShowCatalogStock(v),
                title: Text(context.tr('settings.showStock')),
                subtitle: Text(context.tr('settings.showStockDesc'),
                    style: const TextStyle(color: AppColors.neutral)),
                secondary: const Icon(Icons.inventory_2_outlined),
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              ),
            ),
          ),
          const SizedBox(height: 16),
          _SectionTitle(context.tr('settings.language')),
          Card(
            child: BlocBuilder<LocaleCubit, AppLang>(
              builder: (context, current) => RadioGroup<AppLang>(
                groupValue: current,
                onChanged: (v) {
                  if (v != null) context.read<LocaleCubit>().setLang(v);
                },
                child: Column(
                  children: [
                    for (final lang in AppLang.values)
                      RadioListTile<AppLang>(
                        value: lang,
                        title: Text(langLabels[lang]!),
                        contentPadding:
                            const EdgeInsets.symmetric(horizontal: 8),
                      ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(6, 6, 6, 8),
      child: Text(
        text.toUpperCase(),
        style: const TextStyle(
          color: AppColors.neutral,
          fontWeight: FontWeight.w700,
          fontSize: 12,
          letterSpacing: 0.6,
        ),
      ),
    );
  }
}
