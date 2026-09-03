import 'package:flutter/material.dart';

import '../../../../l10n/l10n_ext.dart';

/// Canonical weekday codes in display order (matches backend visit_days storage).
const List<String> kWeekdays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

/// A row of Mon–Sun toggle chips for choosing visit days.
class VisitDayPicker extends StatelessWidget {
  const VisitDayPicker({super.key, required this.selected, required this.onChanged});

  final Set<String> selected;
  final ValueChanged<Set<String>> onChanged;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (final day in kWeekdays)
          FilterChip(
            label: Text(context.tr('day.$day')),
            selected: selected.contains(day),
            onSelected: (on) {
              final next = Set<String>.from(selected);
              on ? next.add(day) : next.remove(day);
              onChanged(next);
            },
          ),
      ],
    );
  }
}

/// Human-readable summary of visit days, e.g. "Mon, Wed, Fri" or "Any day".
String visitDaysLabel(BuildContext context, List<String> days) {
  if (days.isEmpty) return context.tr('market.noVisitDays');
  final ordered = kWeekdays.where(days.contains);
  return ordered.map((d) => context.tr('day.$d')).join(', ');
}
