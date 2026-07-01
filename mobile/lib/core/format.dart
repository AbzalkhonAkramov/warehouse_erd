import 'package:intl/intl.dart';

/// Display helpers so large sums are readable in the field (e.g. 150 000.00).
final NumberFormat _moneyGrouped = NumberFormat('#,##0.00');
final NumberFormat _qtyFmt = NumberFormat('#,##0.###');

/// Money with thousands separators (space) and 2 decimals: `150 000.00`.
String money(num value) => _moneyGrouped.format(value).replaceAll(',', ' ');

/// Quantity without trailing zeros: `12`, `1.5`.
String qty(num value) => _qtyFmt.format(value).replaceAll(',', ' ');
