import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'locale_cubit.dart';
import 'messages.dart';

/// Globe icon that lets the user switch between ru / uz / en.
class LanguageSwitcher extends StatelessWidget {
  const LanguageSwitcher({super.key});

  @override
  Widget build(BuildContext context) {
    final current = context.watch<LocaleCubit>().state;
    return PopupMenuButton<AppLang>(
      icon: const Icon(Icons.language),
      tooltip: 'Language',
      initialValue: current,
      onSelected: (lang) => context.read<LocaleCubit>().setLang(lang),
      itemBuilder: (_) => AppLang.values
          .map((l) => PopupMenuItem(value: l, child: Text(langLabels[l]!)))
          .toList(),
    );
  }
}
